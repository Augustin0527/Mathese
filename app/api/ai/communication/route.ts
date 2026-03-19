import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ArticleBiblio {
  titre: string;
  auteurs?: string[];
  annee?: number | null;
  doi?: string;
  abstract?: string;
}

export async function POST(req: NextRequest) {
  const { sujet, audience, duree, type, sujetThese, bibliotheque } = await req.json();

  const biblioFormatee = (bibliotheque as ArticleBiblio[] | undefined)?.length
    ? (bibliotheque as ArticleBiblio[])
        .map((a, i) =>
          `[${i + 1}] "${a.titre}"` +
          (a.auteurs?.length ? ` — ${a.auteurs.slice(0, 2).join(', ')}${a.auteurs.length > 2 ? ' et al.' : ''}` : '') +
          (a.annee ? ` (${a.annee})` : '')
        )
        .join('\n')
    : 'Aucune référence disponible';

  const prompt = `Tu es l'Agent IA de MaThèse, expert en communication académique.

**Contexte :**
- Sujet de la thèse : ${sujetThese || 'Non précisé'}
- Sujet de la présentation : ${sujet}
- Type : ${type}
- Durée : ${duree}
- Audience : ${audience}

**Bibliothèque de références disponibles :**
${biblioFormatee}

---

Génère une présentation complète et structurée. Intègre naturellement les références numérotées ci-dessus là où elles sont pertinentes (format : [Auteur, année] ou [numéro] dans le corps des slides).

Respecte exactement ce format markdown :

# Plan de présentation

## Diapositive 1 — [Titre de la diapositive]
**Contenu :**
- Point clé 1
- Point clé 2
- Point clé 3

**Références à intégrer :** [Références si applicable]

---

[Répète pour chaque diapositive. Adapte le nombre de slides à la durée : ~1 slide/2min]

---

# Notes pour le discours

## Introduction (Diapositive 1)
[Texte de discours détaillé pour cette diapositive, environ 150-200 mots, avec les transitions]

## [Section suivante]
[...]

---

# Conseils de présentation
- [3 à 5 conseils spécifiques à l'audience et au type de communication]`;

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  });

  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
