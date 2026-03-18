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
  tldr: { text: string } | null;
}

export async function POST(req: NextRequest) {
  const { sujet, titresExistants = [] } = await req.json();
  if (!sujet?.trim()) {
    return NextResponse.json({ error: 'Sujet requis' }, { status: 400 });
  }

  // 1. Recherche Semantic Scholar
  const fields = 'title,authors,abstract,year,citationCount,externalIds,openAccessPdf,tldr';
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(sujet)}&fields=${fields}&limit=30`;

  let papers: SemanticPaper[] = [];
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json({
        articles: [],
        synthese: `Erreur Semantic Scholar (${res.status}). Réessayez dans quelques instants.`,
      });
    }
    const data = await res.json();
    papers = (data.data ?? []) as SemanticPaper[];
  } catch {
    return NextResponse.json({
      articles: [],
      synthese: 'Impossible de joindre Semantic Scholar. Vérifiez votre connexion.',
    });
  }

  if (papers.length === 0) {
    return NextResponse.json({
      articles: [],
      synthese: 'Aucun article trouvé pour ce sujet. Essayez en anglais ou avec des termes plus généraux.',
    });
  }

  // 2. Garder les plus récents (avec ou sans abstract), max 12
  const recent = papers
    .filter((p) => (p.year ?? 0) >= 2015 && p.title)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 12);

  const selectionnes = recent.length > 0 ? recent : papers.slice(0, 10);

  // 3. Demander à Claude de classer et synthétiser
  const listeTexte = selectionnes
    .map((p, i) => {
      const auteurs = p.authors?.slice(0, 3).map((a) => a.name).join(', ') ?? 'N/A';
      const resume = p.abstract?.slice(0, 400) ?? p.tldr?.text ?? 'Pas de résumé disponible';
      return `[${i + 1}] "${p.title}" (${p.year ?? '?'}) — ${auteurs}
Résumé: ${resume}
Citations: ${p.citationCount ?? 0}`;
    })
    .join('\n\n');

  const bibliographieExistante = titresExistants.length > 0
    ? `\n\nBibliographie déjà disponible de l'étudiant:\n${titresExistants.map((t: string, i: number) => `- ${t}`).join('\n')}`
    : '';

  const prompt = `Tu es un assistant de recherche académique. L'étudiant cherche : "${sujet}"${bibliographieExistante}

Voici ${selectionnes.length} articles trouvés :

${listeTexte}

Pour chaque article (numéro [1] à [${selectionnes.length}]), donne :
- "priorite": "haute" (très pertinent), "moyenne" (partiellement pertinent), "basse" (peu pertinent)
- "resume": résumé en 2-3 phrases en français
- "apport": en 1-2 phrases, apport spécifique pour la recherche sur "${sujet}"
- "dejaDisponible": true si l'article est dans la bibliographie existante de l'étudiant, false sinon

Puis une "synthese" en 3-4 paragraphes sur l'état de la recherche sur ce sujet, en mentionnant ce que l'étudiant possède déjà dans sa bibliothèque s'il y a lieu.

Réponds UNIQUEMENT en JSON valide :
{
  "articles": [
    { "index": 1, "priorite": "haute", "resume": "...", "apport": "...", "dejaDisponible": false }
  ],
  "synthese": "..."
}`;

  let analysis: {
    articles: { index: number; priorite: string; resume: string; apport: string; dejaDisponible: boolean }[];
    synthese: string;
  } = { articles: [], synthese: '' };

  try {
    const response = await claude.messages.create({
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) analysis = JSON.parse(jsonMatch[0]);
  } catch {
    // Claude failed — on retourne quand même les articles sans analyse
  }

  const prioriteOrdre: Record<string, number> = { haute: 0, moyenne: 1, basse: 2 };
  const enriched = selectionnes.map((paper, i) => {
    const ai = analysis.articles.find((a) => a.index === i + 1);
    return {
      id: paper.paperId,
      titre: paper.title,
      auteurs: paper.authors?.map((a) => a.name).join(', ') ?? '',
      annee: paper.year?.toString() ?? '',
      citationCount: paper.citationCount ?? 0,
      doi: paper.externalIds?.DOI ?? null,
      urlPdf: paper.openAccessPdf?.url ?? null,
      priorite: (ai?.priorite ?? 'moyenne') as 'haute' | 'moyenne' | 'basse',
      resume: ai?.resume ?? paper.abstract?.slice(0, 300) ?? paper.tldr?.text ?? '',
      apport: ai?.apport ?? '',
      dejaDisponible: ai?.dejaDisponible ?? false,
    };
  });

  enriched.sort((a, b) => (prioriteOrdre[a.priorite] ?? 1) - (prioriteOrdre[b.priorite] ?? 1));

  return NextResponse.json({ articles: enriched, synthese: analysis.synthese });
}
