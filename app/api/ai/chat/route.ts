import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ArticleBiblio {
  titre: string;
  auteurs?: string[];
  annee?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
}

interface ArticleResult {
  titre: string;
  auteurs: string;
  annee: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  type: string | null;
  source: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Exclut les titres qui sont en réalité des légendes de tableau/figure */
function isTitleFigureOrTable(titre: string): boolean {
  return /^(table|figure|fig\.|tab\.|appendix|annexe|supplement)/i.test(titre.trim());
}

/** Types CrossRef acceptables (articles, chapitres, préprints, rapports) */
const VALID_TYPES = new Set([
  'journal-article', 'proceedings-article', 'book-chapter', 'book',
  'monograph', 'report', 'dissertation', 'posted-content', 'preprint',
]);

// ─── CrossRef ────────────────────────────────────────────────────────────────

interface CrossRefAuthor { given?: string; family?: string }
interface CrossRefWork {
  title?: string[];
  author?: CrossRefAuthor[];
  published?: { 'date-parts'?: number[][] };
  DOI?: string;
  URL?: string;
  abstract?: string;
  type?: string;
}
interface CrossRefResponse { message?: { items?: CrossRefWork[] } }

async function rechercherCrossRef(query: string, nb = 6): Promise<ArticleResult[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${Math.min(nb, 10)}&select=title,author,published,DOI,URL,abstract,type`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MaThese/1.0 (contact@mathese.org)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data: CrossRefResponse = await res.json();
    return (data?.message?.items ?? [])
      .filter((item) => {
        if (!item.title?.[0]) return false;
        if (item.type && !VALID_TYPES.has(item.type)) return false;
        if (isTitleFigureOrTable(item.title[0])) return false;
        return true;
      })
      .map((item) => {
        const titre = item.title![0];
        const auteurs = (item.author ?? []).slice(0, 4)
          .map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', ')
          + ((item.author ?? []).length > 4 ? ' et al.' : '');
        const annee = String(item.published?.['date-parts']?.[0]?.[0] ?? '');
        const doi = item.DOI ?? null;
        const articleUrl = item.URL ?? (doi ? `https://doi.org/${doi}` : null);
        const abstract = item.abstract
          ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 400) : null;
        return { titre, auteurs, annee, doi, url: articleUrl, abstract, type: item.type ?? null, source: 'CrossRef' };
      });
  } catch {
    return [];
  }
}

// ─── Semantic Scholar ─────────────────────────────────────────────────────────

interface S2Paper {
  title?: string;
  authors?: { name: string }[];
  year?: number | null;
  externalIds?: { DOI?: string };
  abstract?: string | null;
  openAccessPdf?: { url: string } | null;
}

async function rechercherSemanticScholar(query: string, nb = 6): Promise<ArticleResult[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,externalIds,abstract,openAccessPdf&limit=${Math.min(nb, 10)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MaThese/1.0 (contact@mathese.org)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? [])
      .filter((p: S2Paper) => p.title && !isTitleFigureOrTable(p.title))
      .map((p: S2Paper) => {
        const auteurs = (p.authors ?? []).slice(0, 4).map((a) => a.name).join(', ')
          + ((p.authors ?? []).length > 4 ? ' et al.' : '');
        const doi = p.externalIds?.DOI ?? null;
        const articleUrl = p.openAccessPdf?.url ?? (doi ? `https://doi.org/${doi}` : null);
        const abstract = p.abstract ? p.abstract.slice(0, 400) : null;
        return { titre: p.title!, auteurs, annee: String(p.year ?? ''), doi, url: articleUrl, abstract, type: 'journal-article', source: 'Semantic Scholar' };
      });
  } catch {
    return [];
  }
}

// ─── OpenAlex ────────────────────────────────────────────────────────────────

interface OpenAlexWork {
  title?: string;
  authorships?: { author: { display_name: string } }[];
  publication_year?: number | null;
  doi?: string | null;
  open_access?: { oa_url?: string | null };
  abstract_inverted_index?: Record<string, number[]> | null;
}

function reconstructAbstract(inv: Record<string, number[]>): string {
  const positions: [number, string][] = [];
  for (const [word, pos] of Object.entries(inv)) {
    for (const p of pos) positions.push([p, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, w]) => w).join(' ').slice(0, 400);
}

async function rechercherOpenAlex(query: string, nb = 6): Promise<ArticleResult[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=type:article&per-page=${Math.min(nb, 10)}&select=title,authorships,publication_year,doi,open_access,abstract_inverted_index`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MaThese/1.0 (contact@mathese.org)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results ?? [])
      .filter((w: OpenAlexWork) => w.title && !isTitleFigureOrTable(w.title))
      .map((w: OpenAlexWork) => {
        const auteurs = (w.authorships ?? []).slice(0, 4).map((a) => a.author.display_name).join(', ')
          + ((w.authorships ?? []).length > 4 ? ' et al.' : '');
        const doi = w.doi ? w.doi.replace('https://doi.org/', '') : null;
        const articleUrl = w.open_access?.oa_url ?? (doi ? `https://doi.org/${doi}` : null);
        const abstract = w.abstract_inverted_index ? reconstructAbstract(w.abstract_inverted_index) : null;
        return { titre: w.title!, auteurs, annee: String(w.publication_year ?? ''), doi, url: articleUrl, abstract, type: 'journal-article', source: 'OpenAlex' };
      });
  } catch {
    return [];
  }
}

// ─── Fusion + dédoublonnage ───────────────────────────────────────────────────

async function rechercherArticles(query: string, nb = 6): Promise<ArticleResult[]> {
  const perSource = Math.min(Math.ceil(nb / 2) + 2, 8);
  const [crossref, semantic, openalex] = await Promise.all([
    rechercherCrossRef(query, perSource),
    rechercherSemanticScholar(query, perSource),
    rechercherOpenAlex(query, perSource),
  ]);

  const seen = new Set<string>();
  const results: ArticleResult[] = [];
  for (const article of [...crossref, ...semantic, ...openalex]) {
    const key = article.doi
      ? article.doi.toLowerCase()
      : article.titre.toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      results.push(article);
    }
  }
  return results.slice(0, nb);
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages, sujetThese, bibliotheque } = await req.json();

  const biblioContext = bibliotheque?.length
    ? `\n\n---\nBibliothèque personnelle de l'étudiant (${bibliotheque.length} références) :\n${
        (bibliotheque as ArticleBiblio[]).map((a, i) =>
          `[${i + 1}] "${a.titre}"` +
          (a.auteurs?.length ? ` — ${a.auteurs.slice(0, 2).join(', ')}${a.auteurs.length > 2 ? ' et al.' : ''}` : '') +
          (a.annee ? ` (${a.annee})` : '') +
          (a.doi ? ` · DOI: ${a.doi}` : '') +
          (a.abstract ? `\n    Résumé: ${a.abstract.slice(0, 250)}` : '') +
          (a.notes ? `\n    Notes: ${a.notes.slice(0, 150)}` : '')
        ).join('\n')
      }\n---`
    : '';

  const systemPrompt = `Tu es l'Agent IA de MaThèse, un assistant académique personnel et bienveillant, spécialisé dans l'accompagnement des étudiants en recherche doctorale.
${sujetThese ? `Le sujet de thèse de l'étudiant est : "${sujetThese}".` : ''}
${biblioContext}

Tes missions :
- Aider à comprendre des concepts et théories complexes
- Exploiter et recommander des références de la bibliothèque personnelle
- Rechercher automatiquement des articles académiques (utilise l'outil rechercher_articles)
- Rédiger des synthèses, rapports, revues de littérature bien structurés
- Structurer des arguments, plans, hypothèses
- Suggérer des pistes méthodologiques

Règles :
- Réponds toujours en français sauf si l'étudiant écrit dans une autre langue
- Utilise le markdown : titres ##, listes -, **gras**, tableaux si utile
- Quand tu recommandes une référence de la bibliothèque, cite-la avec son numéro [X]
- Quand l'étudiant demande des articles ou de la littérature, utilise TOUJOURS l'outil rechercher_articles
- Sois précis, encourageant, et adapte ton niveau au contexte académique
- Si on te demande qui tu es : tu es "l'Agent IA de MaThèse"


⚠️ RÈGLE ABSOLUE — GÉNÉRATION DE DOCUMENT WORD :
Si l'étudiant demande : un rapport, un document Word, une synthèse, "reprends le document", "génère le fichier", "avec plus de références"...
Tu DOIS obligatoirement DANS CET ORDRE :
1. Si des références supplémentaires sont demandées : appeler rechercher_articles AVANT de générer le document
2. Écrire UNIQUEMENT cette phrase : "Je génère votre document Word, veuillez patienter un instant... 📄"
3. Appeler generer_document_word avec :
   - titre : un VRAI TITRE ACADÉMIQUE COURT ET DESCRIPTIF du sujet traité
     ✅ Exemples valides : "L'IMSE au Bénin : Défis et Perspectives", "Analyse des systèmes éducatifs en Afrique subsaharienne"
     ❌ INTERDIT : la demande de l'étudiant comme titre ("reprends le document", "avec plus de références", etc.)
     ❌ INTERDIT : une phrase de plus de 80 caractères
   - contenu : un NOUVEAU DOCUMENT COMPLET rédigé en markdown incluant :
     * Introduction, sections structurées (##), conclusion, références bibliographiques
     * Les articles trouvés via rechercher_articles intégrés dans le corps et les références
     * NE PAS copier-coller les messages précédents du chat — RÉDIGER un nouveau document complet et cohérent

Tu NE DOIS PAS écrire le contenu du document dans le chat. Si tu ne génères pas le fichier Word via l'outil, le document ne sera JAMAIS créé.`;

  const tools: Anthropic.Tool[] = [
    {
      name: 'rechercher_articles',
      description: "Recherche des articles académiques sur CrossRef, Semantic Scholar et OpenAlex en parallèle. À utiliser quand l'étudiant demande des articles, références ou littérature.",
      input_schema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'Mots-clés en anglais de préférence' },
          nb: { type: 'number', description: 'Nombre de résultats souhaités (max 12)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'generer_document_word',
      description: "Génère un document Word (.docx) complet et structuré. À utiliser UNIQUEMENT quand l'étudiant demande un rapport, une synthèse, un document complet à télécharger. Le contenu en markdown est transmis directement au système de génération sans être affiché dans le chat.",
      input_schema: {
        type: 'object' as const,
        properties: {
          titre: { type: 'string', description: 'Titre du document' },
          contenu: { type: 'string', description: 'Contenu complet du document en markdown (titres ##, listes, tableaux, références)' },
        },
        required: ['titre', 'contenu'],
      },
    },
  ];

  const readableStream = new ReadableStream({
    async start(controller) {
      const encode = (text: string) => controller.enqueue(new TextEncoder().encode(text));

      const cleanMessages: Anthropic.MessageParam[] = (
        messages as Array<{ role: string; content: string; isError?: boolean }>
      )
        .filter((m) => !m.isError && m.content && m.content.trim() !== '')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      let currentMessages: Anthropic.MessageParam[] = cleanMessages;
      let foundArticles: ArticleResult[] = [];

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let finalText = '';
          const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];
          let stopReason: string | null = null;

          let currentToolId = '';
          let currentToolName = '';
          let currentToolInput = '';
          let insideTool = false;

          const stream = anthropic.messages.stream({
            model: 'claude-sonnet-4-6',
            max_tokens: 2500,
            system: systemPrompt,
            tools,
            messages: currentMessages,
          });

          for await (const chunk of stream) {
            if (chunk.type === 'content_block_start') {
              if (chunk.content_block.type === 'text') {
                insideTool = false;
              } else if (chunk.content_block.type === 'tool_use') {
                insideTool = true;
                currentToolId = chunk.content_block.id;
                currentToolName = chunk.content_block.name;
                currentToolInput = '';
              }
            } else if (chunk.type === 'content_block_delta') {
              if (chunk.delta.type === 'text_delta' && !insideTool) {
                encode(chunk.delta.text);
                finalText += chunk.delta.text;
              } else if (chunk.delta.type === 'input_json_delta') {
                currentToolInput += chunk.delta.partial_json;
              }
            } else if (chunk.type === 'content_block_stop') {
              if (insideTool && currentToolId) {
                let parsedInput: Record<string, unknown> = {};
                try { parsedInput = JSON.parse(currentToolInput); } catch { /* ignore */ }
                toolUses.push({ id: currentToolId, name: currentToolName, input: parsedInput });
                insideTool = false;
                currentToolId = '';
              }
            } else if (chunk.type === 'message_delta') {
              stopReason = chunk.delta.stop_reason ?? null;
            } else if (chunk.type === 'message_stop') {
              stopReason = stopReason ?? 'end_turn';
            }
          }

          const contentBlocks: Anthropic.MessageParam['content'] = [];
          if (finalText) contentBlocks.push({ type: 'text', text: finalText });
          for (const tu of toolUses) {
            contentBlocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
          }

          if (stopReason !== 'tool_use' || toolUses.length === 0) break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUses) {
            if (toolUse.name === 'rechercher_articles') {
              const query = String(toolUse.input.query ?? '');
              const nb = typeof toolUse.input.nb === 'number' ? toolUse.input.nb : 6;

              encode(`\n__STATUS__Recherche dans CrossRef, Semantic Scholar et OpenAlex : "${query}"...__STATUS_END__\n`);

              const articles = await rechercherArticles(query, nb);
              foundArticles = [...foundArticles, ...articles];

              const resultText = articles.length > 0
                ? articles.map((a, i) =>
                    `[${i + 1}] **${a.titre}** (${a.source})\n` +
                    `   Auteurs : ${a.auteurs || 'Inconnu'} · Année : ${a.annee || '?'}\n` +
                    (a.doi ? `   DOI : ${a.doi}\n` : '') +
                    (a.abstract ? `   Résumé : ${a.abstract}\n` : '')
                  ).join('\n')
                : 'Aucun article trouvé pour cette requête.';

              toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: resultText });

            } else if (toolUse.name === 'generer_document_word') {
              let titre = String(toolUse.input.titre ?? 'Document');
              const contenu = String(toolUse.input.contenu ?? '');
              // Sanitize : si le titre ressemble à une demande utilisateur (trop long ou commence par un verbe d'action),
              // extraire un titre depuis le contenu markdown (première ligne H1/H2) ou utiliser un titre générique
              if (titre.length > 100 || /^(reprends|génère|crée|fais|donne|avec|update|écris)/i.test(titre.trim())) {
                const h1Match = contenu.match(/^#{1,2}\s+(.+)/m);
                titre = h1Match ? h1Match[1].slice(0, 80) : 'Rapport académique';
              }

              encode(`\n__WORD_DOC__${JSON.stringify({ titre, contenu })}__WORD_DOC_END__\n`);

              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Document Word "${titre}" transmis au client pour téléchargement.`,
              });
            }
          }

          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: contentBlocks },
            { role: 'user', content: toolResults },
          ];
        }

        if (foundArticles.length > 0) {
          encode('\n\n__SEARCH_RESULTS__' + JSON.stringify(foundArticles));
        }
      } catch (err) {
        console.error('[chat/route] Error:', err);
        encode('\n\n__ERROR__');
      }

      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
