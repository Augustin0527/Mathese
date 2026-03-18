import { NextRequest, NextResponse } from 'next/server';
import { claude, MODEL } from '@/lib/claude/client';

interface SemanticPaper {
  paperId: string;
  title: string;
  authors: { name: string }[];
  abstract: string | null;
  year: number | null;
  citationCount: number;
  externalIds: { DOI?: string } | null;
  openAccessPdf: { url: string } | null;
}

export async function POST(req: NextRequest) {
  const { sujet } = await req.json();
  if (!sujet?.trim()) {
    return NextResponse.json({ error: 'Sujet requis' }, { status: 400 });
  }

  // 1. Recherche Semantic Scholar (gratuit, sans clé)
  const fields = 'title,authors,abstract,year,citationCount,externalIds,openAccessPdf';
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(sujet)}&fields=${fields}&limit=30`;

  let papers: SemanticPaper[] = [];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MaThese-App/1.0' },
    });
    const data = await res.json();
    papers = (data.data ?? []) as SemanticPaper[];
  } catch {
    return NextResponse.json({ error: 'Erreur lors de la recherche Semantic Scholar' }, { status: 502 });
  }

  // 2. Filtrer les articles récents (2018+) avec un abstract
  const recent = papers
    .filter((p) => p.abstract && (p.year ?? 0) >= 2018)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 12);

  if (recent.length === 0) {
    return NextResponse.json({ articles: [], synthese: 'Aucun article récent trouvé pour ce sujet.' });
  }

  // 3. Demander à Claude de classer et synthétiser
  const listeTexte = recent
    .map((p, i) => {
      const auteurs = p.authors?.slice(0, 3).map((a) => a.name).join(', ') ?? 'N/A';
      return `[${i + 1}] "${p.title}" (${p.year ?? '?'}) — ${auteurs}
Résumé: ${p.abstract?.slice(0, 400) ?? 'N/A'}
Citations: ${p.citationCount ?? 0}`;
    })
    .join('\n\n');

  const prompt = `Tu es un assistant de recherche académique. L'étudiant cherche : "${sujet}"

Voici ${recent.length} articles récents trouvés sur Semantic Scholar :

${listeTexte}

Pour chaque article, donne :
1. "priorite" : "haute" si très pertinent pour le sujet, "moyenne" si partiellement pertinent, "basse" si peu pertinent
2. "resume" : résumé en 2-3 phrases en français
3. "apport" : en 1-2 phrases, l'apport spécifique de cet article pour la recherche sur "${sujet}"

Puis donne une "synthese" globale en 3-4 paragraphes sur l'état actuel de la recherche sur ce sujet d'après ces articles.

Réponds UNIQUEMENT en JSON valide avec ce format exact :
{
  "articles": [
    { "index": 1, "priorite": "haute", "resume": "...", "apport": "..." }
  ],
  "synthese": "..."
}`;

  let analysis: { articles: { index: number; priorite: string; resume: string; apport: string }[]; synthese: string } = {
    articles: [],
    synthese: '',
  };

  try {
    const response = await claude.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Si Claude échoue, on retourne quand même les articles sans analyse
  }

  // 4. Fusionner les données
  const prioriteOrdre: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
  const enriched = recent.map((paper, i) => {
    const ai = analysis.articles.find((a) => a.index === i + 1) ?? {
      priorite: 'moyenne',
      resume: paper.abstract?.slice(0, 300) ?? '',
      apport: '',
    };
    return {
      id: paper.paperId,
      titre: paper.title,
      auteurs: paper.authors?.map((a) => a.name).join(', ') ?? '',
      annee: paper.year?.toString() ?? '',
      citationCount: paper.citationCount ?? 0,
      doi: paper.externalIds?.DOI ?? null,
      urlPdf: paper.openAccessPdf?.url ?? null,
      priorite: ai.priorite,
      resume: ai.resume,
      apport: ai.apport,
    };
  });

  enriched.sort((a, b) => (prioriteOrdre[a.priorite] ?? 1) - (prioriteOrdre[b.priorite] ?? 1));

  return NextResponse.json({ articles: enriched, synthese: analysis.synthese });
}
