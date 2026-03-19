import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ArticleBiblio {
  titre: string;
  auteurs?: string[];
  annee?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  const { messages, sujetThese, bibliotheque } = await req.json();

  const biblioContext = bibliotheque?.length
    ? `\n\n---\nBibliothèque personnelle de l'étudiant (${bibliotheque.length} références) :\n${
        (bibliotheque as ArticleBiblio[])
          .map((a, i) =>
            `[${i + 1}] "${a.titre}"` +
            (a.auteurs?.length ? ` — ${a.auteurs.slice(0, 2).join(', ')}${a.auteurs.length > 2 ? ' et al.' : ''}` : '') +
            (a.annee ? ` (${a.annee})` : '') +
            (a.doi ? ` · DOI: ${a.doi}` : '') +
            (a.abstract ? `\n    Résumé: ${a.abstract.slice(0, 300)}` : '') +
            (a.notes ? `\n    Notes de l'étudiant: ${a.notes}` : '')
          )
          .join('\n')
      }\n---`
    : '';

  const stream = anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `Tu es l'Agent IA de MaThèse, un assistant académique personnel et bienveillant, spécialisé dans l'accompagnement des étudiants en recherche doctorale.
${sujetThese ? `Le sujet de thèse de l'étudiant est : "${sujetThese}".` : ''}
${biblioContext}

Tes missions :
- Aider à comprendre des concepts et théories complexes
- Exploiter et recommander des références de la bibliothèque personnelle de l'étudiant
- Structurer des arguments, des plans, des hypothèses
- Suggérer des pistes méthodologiques
- Donner des retours constructifs sur des textes soumis

Règles :
- Réponds toujours en français sauf si l'étudiant écrit dans une autre langue
- Utilise le markdown pour structurer tes réponses (titres ##, listes -, **gras**, tableaux si utile)
- Quand tu recommandes une référence de la bibliothèque, cite-la avec son numéro [X] et son titre
- Sois précis, encourageant, et adapte ton niveau au contexte académique
- Si on te demande qui tu es : tu es "l'Agent IA de MaThèse", un assistant dédié à la réussite de cette thèse`,
    messages,
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
