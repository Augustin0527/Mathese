import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI, SchemaType, type Content, type Part, type FunctionDeclaration } from '@google/generative-ai';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const genai = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

function isTitleFigureOrTable(titre: string): boolean {
  return /^(table|figure|fig\.|tab\.|appendix|annexe|supplement)/i.test(titre.trim());
}

const VALID_TYPES = new Set([
  'journal-article', 'proceedings-article', 'book-chapter', 'book',
  'monograph', 'report', 'dissertation', 'posted-content', 'preprint',
]);

// ─── CrossRef ────────────────────────────────────────────────────────────────

interface CrossRefAuthor { given?: string; family?: string }
interface CrossRefWork {
  title?: string[]; author?: CrossRefAuthor[];
  published?: { 'date-parts'?: number[][] }; DOI?: string; URL?: string; abstract?: string; type?: string;
}
interface CrossRefResponse { message?: { items?: CrossRefWork[] } }

async function rechercherCrossRef(query: string, nb = 6): Promise<ArticleResult[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${Math.min(nb, 10)}&select=title,author,published,DOI,URL,abstract,type`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MaThese/1.0' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data: CrossRefResponse = await res.json();
    return (data?.message?.items ?? [])
      .filter((item) => item.title?.[0] && (!item.type || VALID_TYPES.has(item.type)) && !isTitleFigureOrTable(item.title[0]))
      .map((item) => {
        const titre = item.title![0];
        const auteurs = (item.author ?? []).slice(0, 4).map((a) => [a.given, a.family].filter(Boolean).join(' ')).join(', ') + ((item.author ?? []).length > 4 ? ' et al.' : '');
        const doi = item.DOI ?? null;
        return { titre, auteurs, annee: String(item.published?.['date-parts']?.[0]?.[0] ?? ''), doi, url: item.URL ?? (doi ? `https://doi.org/${doi}` : null), abstract: item.abstract ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 400) : null, type: item.type ?? null, source: 'CrossRef' };
      });
  } catch { return []; }
}

// ─── Semantic Scholar ─────────────────────────────────────────────────────────

interface S2Paper { title?: string; authors?: { name: string }[]; year?: number | null; externalIds?: { DOI?: string }; abstract?: string | null; openAccessPdf?: { url: string } | null }

async function rechercherSemanticScholar(query: string, nb = 6): Promise<ArticleResult[]> {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=title,authors,year,externalIds,abstract,openAccessPdf&limit=${Math.min(nb, 10)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MaThese/1.0' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? []).filter((p: S2Paper) => p.title && !isTitleFigureOrTable(p.title)).map((p: S2Paper) => {
      const doi = p.externalIds?.DOI ?? null;
      return { titre: p.title!, auteurs: (p.authors ?? []).slice(0, 4).map((a) => a.name).join(', ') + ((p.authors ?? []).length > 4 ? ' et al.' : ''), annee: String(p.year ?? ''), doi, url: p.openAccessPdf?.url ?? (doi ? `https://doi.org/${doi}` : null), abstract: p.abstract ? p.abstract.slice(0, 400) : null, type: 'journal-article', source: 'Semantic Scholar' };
    });
  } catch { return []; }
}

// ─── OpenAlex ────────────────────────────────────────────────────────────────

interface OpenAlexWork { title?: string; authorships?: { author: { display_name: string } }[]; publication_year?: number | null; doi?: string | null; open_access?: { oa_url?: string | null }; abstract_inverted_index?: Record<string, number[]> | null }

function reconstructAbstract(inv: Record<string, number[]>): string {
  const pos: [number, string][] = [];
  for (const [word, positions] of Object.entries(inv)) for (const p of positions) pos.push([p, word]);
  return pos.sort((a, b) => a[0] - b[0]).map(([, w]) => w).join(' ').slice(0, 400);
}

async function rechercherOpenAlex(query: string, nb = 6): Promise<ArticleResult[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=type:article&per-page=${Math.min(nb, 10)}&select=title,authorships,publication_year,doi,open_access,abstract_inverted_index`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MaThese/1.0' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.results ?? []).filter((w: OpenAlexWork) => w.title && !isTitleFigureOrTable(w.title)).map((w: OpenAlexWork) => {
      const doi = w.doi ? w.doi.replace('https://doi.org/', '') : null;
      return { titre: w.title!, auteurs: (w.authorships ?? []).slice(0, 4).map((a) => a.author.display_name).join(', ') + ((w.authorships ?? []).length > 4 ? ' et al.' : ''), annee: String(w.publication_year ?? ''), doi, url: w.open_access?.oa_url ?? (doi ? `https://doi.org/${doi}` : null), abstract: w.abstract_inverted_index ? reconstructAbstract(w.abstract_inverted_index) : null, type: 'journal-article', source: 'OpenAlex' };
    });
  } catch { return []; }
}

async function rechercherArticles(query: string, nb = 6): Promise<ArticleResult[]> {
  const perSource = Math.min(Math.ceil(nb / 2) + 2, 8);
  const [crossref, semantic, openalex] = await Promise.all([rechercherCrossRef(query, perSource), rechercherSemanticScholar(query, perSource), rechercherOpenAlex(query, perSource)]);
  const seen = new Set<string>();
  const results: ArticleResult[] = [];
  for (const article of [...crossref, ...semantic, ...openalex]) {
    const key = article.doi ? article.doi.toLowerCase() : article.titre.toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    if (!seen.has(key)) { seen.add(key); results.push(article); }
  }
  return results.slice(0, nb);
}

// ─── Outils communs ───────────────────────────────────────────────────────────

function encodeResult(encode: (t: string) => void, articles: ArticleResult[]): void {
  if (articles.length > 0) encode('\n\n__SEARCH_RESULTS__' + JSON.stringify(articles));
}

// ─── Handler Claude ───────────────────────────────────────────────────────────

async function handleClaude(
  systemPrompt: string,
  rawMessages: Array<{ role: string; content: string }>,
  encode: (t: string) => void,
) {
  const tools: Anthropic.Tool[] = [
    {
      name: 'rechercher_articles',
      description: "Recherche des articles académiques sur CrossRef, Semantic Scholar et OpenAlex.",
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
      description: "Déclenche la génération d'un document Word. Fournir UNIQUEMENT le titre.",
      input_schema: {
        type: 'object' as const,
        properties: {
          titre: { type: 'string', description: 'Titre académique court et descriptif' },
        },
        required: ['titre'],
      },
    },
  ];

  let foundArticles: ArticleResult[] = [];
  let currentMessages: Anthropic.MessageParam[] = rawMessages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      tools,
      messages: currentMessages,
    });

    let fullText = '';
    const toolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
    let currentToolId = '';
    let currentToolName = '';
    let currentInputJson = '';

    for await (const event of stream) {
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        currentToolId = event.content_block.id;
        currentToolName = event.content_block.name;
        currentInputJson = '';
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') { encode(event.delta.text); fullText += event.delta.text; }
        else if (event.delta.type === 'input_json_delta') { currentInputJson += event.delta.partial_json; }
      } else if (event.type === 'content_block_stop' && currentToolId) {
        try { toolUses.push({ id: currentToolId, name: currentToolName, input: JSON.parse(currentInputJson || '{}') }); } catch { /* ignore */ }
        currentToolId = ''; currentToolName = ''; currentInputJson = '';
      }
    }

    if (toolUses.length === 0) break;

    const assistantContent: Anthropic.ContentBlock[] = [];
    if (fullText) assistantContent.push({ type: 'text', text: fullText });
    for (const tu of toolUses) assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
    currentMessages = [...currentMessages, { role: 'assistant', content: assistantContent }];

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      if (tu.name === 'rechercher_articles') {
        const query = String(tu.input.query ?? '');
        const nb = typeof tu.input.nb === 'number' ? tu.input.nb : 6;
        encode(`\n__STATUS__Recherche dans CrossRef, Semantic Scholar et OpenAlex : "${query}"...__STATUS_END__\n`);
        const articles = await rechercherArticles(query, nb);
        foundArticles = [...foundArticles, ...articles];
        const resultText = articles.length > 0
          ? articles.map((a, i) => `[${i + 1}] **${a.titre}** (${a.source})\n   Auteurs : ${a.auteurs || 'Inconnu'} · Année : ${a.annee || '?'}\n${a.doi ? `   DOI : ${a.doi}\n` : ''}${a.abstract ? `   Résumé : ${a.abstract}\n` : ''}`).join('\n')
          : 'Aucun article trouvé.';
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: resultText });
      } else if (tu.name === 'generer_document_word') {
        let titre = String(tu.input.titre ?? 'Rapport académique');
        if (titre.length > 100 || /^(reprends|génère|crée|fais|donne|avec|update|écris)/i.test(titre.trim())) titre = 'Rapport académique';
        encode(`\n__WORD_DOC__${JSON.stringify({ titre })}__WORD_DOC_END__\n`);
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: `Document "${titre}" transmis.` });
      }
    }
    currentMessages = [...currentMessages, { role: 'user', content: toolResults }];
  }

  encodeResult(encode, foundArticles);
}

// ─── Handler Gemini ───────────────────────────────────────────────────────────

const geminiTools: FunctionDeclaration[] = [
  {
    name: 'rechercher_articles',
    description: "Recherche des articles académiques sur CrossRef, Semantic Scholar et OpenAlex. À utiliser quand l'étudiant demande des articles, références ou littérature.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: { type: SchemaType.STRING, description: 'Mots-clés en anglais de préférence' },
        nb: { type: SchemaType.NUMBER, description: 'Nombre de résultats souhaités (max 12)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'generer_document_word',
    description: "Déclenche la génération d'un document Word. À utiliser UNIQUEMENT quand l'étudiant demande un rapport, une synthèse ou un document. Ne fournir QUE le titre.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        titre: { type: SchemaType.STRING, description: 'Titre académique court et descriptif' },
      },
      required: ['titre'],
    },
  },
];

async function handleGemini(
  modelName: string,
  systemPrompt: string,
  rawMessages: Array<{ role: string; content: string }>,
  encode: (t: string) => void,
) {
  let geminiHistory: Content[] = rawMessages.slice(0, -1).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const lastMsg = rawMessages[rawMessages.length - 1];
  let currentParts: Part[] = [{ text: lastMsg?.content ?? '' }];

  const model = genai.getGenerativeModel({
    model: modelName,
    systemInstruction: systemPrompt,
    tools: [{ functionDeclarations: geminiTools }],
    generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
  });

  let foundArticles: ArticleResult[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(currentParts);

    let fullText = '';
    const functionCalls: { name: string; args: Record<string, unknown> }[] = [];

    for await (const chunk of result.stream) {
      for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
        if ('text' in part && part.text) { encode(part.text); fullText += part.text; }
        if ('functionCall' in part && part.functionCall) {
          functionCalls.push({ name: part.functionCall.name ?? '', args: (part.functionCall.args ?? {}) as Record<string, unknown> });
        }
      }
    }

    // Vérifier aussi la réponse finale pour les function calls manqués
    try {
      const finalRes = await result.response;
      for (const part of finalRes.candidates?.[0]?.content?.parts ?? []) {
        if ('functionCall' in part && part.functionCall) {
          if (!functionCalls.some((fc) => fc.name === part.functionCall?.name)) {
            functionCalls.push({ name: part.functionCall.name ?? '', args: (part.functionCall.args ?? {}) as Record<string, unknown> });
          }
        }
      }
    } catch { /* ignore */ }

    if (functionCalls.length === 0) break;

    const modelParts: Part[] = [];
    if (fullText) modelParts.push({ text: fullText });
    for (const fc of functionCalls) modelParts.push({ functionCall: { name: fc.name, args: fc.args } });
    geminiHistory = [...geminiHistory, { role: 'user', parts: currentParts }, { role: 'model', parts: modelParts }];

    const functionResponseParts: Part[] = [];
    for (const fc of functionCalls) {
      if (fc.name === 'rechercher_articles') {
        const query = String(fc.args.query ?? '');
        const nb = typeof fc.args.nb === 'number' ? fc.args.nb : 6;
        encode(`\n__STATUS__Recherche dans CrossRef, Semantic Scholar et OpenAlex : "${query}"...__STATUS_END__\n`);
        const articles = await rechercherArticles(query, nb);
        foundArticles = [...foundArticles, ...articles];
        const resultText = articles.length > 0
          ? articles.map((a, i) => `[${i + 1}] **${a.titre}** (${a.source})\n   Auteurs : ${a.auteurs || 'Inconnu'} · Année : ${a.annee || '?'}\n${a.doi ? `   DOI : ${a.doi}\n` : ''}${a.abstract ? `   Résumé : ${a.abstract}\n` : ''}`).join('\n')
          : 'Aucun article trouvé.';
        functionResponseParts.push({ functionResponse: { name: fc.name, response: { result: resultText } } });
      } else if (fc.name === 'generer_document_word') {
        let titre = String(fc.args.titre ?? 'Rapport académique');
        if (titre.length > 100 || /^(reprends|génère|crée|fais|donne|avec|update|écris)/i.test(titre.trim())) titre = 'Rapport académique';
        encode(`\n__WORD_DOC__${JSON.stringify({ titre })}__WORD_DOC_END__\n`);
        functionResponseParts.push({ functionResponse: { name: fc.name, response: { result: `Document "${titre}" transmis.` } } });
      }
    }
    currentParts = functionResponseParts;
  }

  encodeResult(encode, foundArticles);
}

// ─── Route principale ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { messages, sujetThese, bibliotheque, model: modelParam } = await req.json();
  const selectedModel: string = modelParam || 'gemini-2.0-flash';

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
Si l'étudiant demande : un rapport, un document Word, une synthèse, "reprends le document", "génère le fichier"...
Tu DOIS obligatoirement DANS CET ORDRE :
1. Si des références sont demandées : appeler rechercher_articles AVANT
2. Écrire UNIQUEMENT : "Je génère votre document Word, veuillez patienter un instant... 📄"
3. Appeler generer_document_word avec UNIQUEMENT le titre académique court
   ✅ Le contenu est généré AUTOMATIQUEMENT — ne pas l'écrire dans le chat
   ❌ INTERDIT : utiliser la demande de l'étudiant comme titre`;

  const readableStream = new ReadableStream({
    async start(controller) {
      const encode = (text: string) => controller.enqueue(new TextEncoder().encode(text));

      const rawMessages = (messages as Array<{ role: string; content: string; isError?: boolean }>)
        .filter((m) => !m.isError && m.content && m.content.trim() !== '');

      try {
        if (selectedModel.startsWith('claude')) {
          await handleClaude(systemPrompt, rawMessages, encode);
        } else {
          await handleGemini(selectedModel, systemPrompt, rawMessages, encode);
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
