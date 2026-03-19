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

interface CrossRefAuthor {
  given?: string;
  family?: string;
}

interface CrossRefWork {
  title?: string[];
  author?: CrossRefAuthor[];
  published?: { 'date-parts'?: number[][] };
  DOI?: string;
  URL?: string;
  abstract?: string;
  type?: string;
}

interface CrossRefResponse {
  message?: {
    items?: CrossRefWork[];
  };
}

interface ArticleCrossRef {
  titre: string;
  auteurs: string;
  annee: string;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  type: string | null;
}

// ─── Appel CrossRef ──────────────────────────────────────────────────────────

async function rechercherCrossRef(query: string, nb: number = 5): Promise<ArticleCrossRef[]> {
  const nbClamped = Math.min(nb, 8);
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.crossref.org/works?query=${encodedQuery}&rows=${nbClamped}&select=title,author,published,DOI,URL,abstract,type`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'MaThese/1.0 (contact@mathese.org)' },
  });

  if (!res.ok) return [];

  const data: CrossRefResponse = await res.json();
  const items = data?.message?.items ?? [];

  return items.map((item: CrossRefWork) => {
    const titre = item.title?.[0] ?? 'Sans titre';
    const auteurs = (item.author ?? [])
      .slice(0, 4)
      .map((a: CrossRefAuthor) => [a.given, a.family].filter(Boolean).join(' '))
      .join(', ') + ((item.author ?? []).length > 4 ? ' et al.' : '');
    const annee = String(item.published?.['date-parts']?.[0]?.[0] ?? '');
    const doi = item.DOI ?? null;
    const articleUrl = item.URL ?? (doi ? `https://doi.org/${doi}` : null);
    const abstract = item.abstract
      ? item.abstract.replace(/<[^>]+>/g, '').slice(0, 400)
      : null;
    const type = item.type ?? null;

    return { titre, auteurs, annee, doi, url: articleUrl, abstract, type };
  });
}

// ─── Handler ─────────────────────────────────────────────────────────────────

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

  const systemPrompt = `Tu es l'Agent IA de MaThèse, un assistant académique personnel et bienveillant, spécialisé dans l'accompagnement des étudiants en recherche doctorale.
${sujetThese ? `Le sujet de thèse de l'étudiant est : "${sujetThese}".` : ''}
${biblioContext}

Tes missions :
- Aider à comprendre des concepts et théories complexes
- Exploiter et recommander des références de la bibliothèque personnelle de l'étudiant
- Rechercher automatiquement des articles académiques quand l'étudiant en a besoin (utilise l'outil rechercher_articles)
- Structurer des arguments, des plans, des hypothèses
- Suggérer des pistes méthodologiques
- Donner des retours constructifs sur des textes soumis

Règles :
- Réponds toujours en français sauf si l'étudiant écrit dans une autre langue
- Utilise le markdown pour structurer tes réponses (titres ##, listes -, **gras**, tableaux si utile)
- Quand tu recommandes une référence de la bibliothèque, cite-la avec son numéro [X] et son titre
- Quand l'étudiant demande de trouver des articles, des références ou de la littérature sur un sujet, utilise TOUJOURS l'outil rechercher_articles
- Sois précis, encourageant, et adapte ton niveau au contexte académique
- Si on te demande qui tu es : tu es "l'Agent IA de MaThèse", un assistant dédié à la réussite de cette thèse
- Quand tu rédiges une réponse longue et structurée (rapport, synthèse, revue de littérature, analyse, plan détaillé), propose à la fin de télécharger le document en ajoutant exactement cette ligne sur une ligne séparée : __PROPOSE_WORD__`;

  const tools: Anthropic.Tool[] = [
    {
      name: 'rechercher_articles',
      description:
        "Recherche des articles académiques sur CrossRef. Utilise cet outil quand l'étudiant demande de trouver des articles, des références, ou de la littérature sur un sujet.",
      input_schema: {
        type: 'object' as const,
        properties: {
          query: {
            type: 'string',
            description: 'Mots-clés de recherche en anglais de préférence',
          },
          nb: {
            type: 'number',
            description: 'Nombre de résultats (max 8)',
          },
        },
        required: ['query'],
      },
    },
  ];

  // ── Agentic loop : on gère les tool_use jusqu'à end_turn ──────────────────

  const readableStream = new ReadableStream({
    async start(controller) {
      const encode = (text: string) => controller.enqueue(new TextEncoder().encode(text));

      let currentMessages: Anthropic.MessageParam[] = messages;
      let foundArticles: ArticleCrossRef[] = [];

      // Boucle : on relance si l'IA veut utiliser un outil
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // Premier passage : on peut streamer le texte final
        // Passages suivants (après outil) : pareil
        let finalText = '';
        const toolUses: { id: string; name: string; input: Record<string, unknown> }[] = [];

        let stopReason: string | null = null;

        const stream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          system: systemPrompt,
          tools,
          messages: currentMessages,
        });

        // Collecter texte et tool_use blocs
        const contentBlocks: Anthropic.ContentBlock[] = [];
        let currentToolInput = '';
        let currentToolId = '';
        let currentToolName = '';
        let insideTool = false;

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
            }
          } else if (chunk.type === 'message_delta') {
            stopReason = chunk.delta.stop_reason ?? null;
          } else if (chunk.type === 'message_stop') {
            stopReason = stopReason ?? 'end_turn';
          }
        }

        // Récupérer les blocs finaux via la méthode finalMessage pour avoir content
        const finalMsg = await stream.finalMessage();
        contentBlocks.push(...finalMsg.content);

        // Si pas de tool_use ou stop_reason = end_turn → on a fini
        if (stopReason !== 'tool_use' || toolUses.length === 0) {
          break;
        }

        // ── Exécuter les outils ──────────────────────────────────────────────
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUses) {
          if (toolUse.name === 'rechercher_articles') {
            const query = String(toolUse.input.query ?? '');
            const nb = typeof toolUse.input.nb === 'number' ? toolUse.input.nb : 5;

            const articles = await rechercherCrossRef(query, nb);
            foundArticles = [...foundArticles, ...articles];

            const resultText = articles.length > 0
              ? articles
                  .map(
                    (a, i) =>
                      `[${i + 1}] **${a.titre}**\n` +
                      `   Auteurs : ${a.auteurs || 'Inconnu'} · Année : ${a.annee || '?'}\n` +
                      (a.doi ? `   DOI : ${a.doi}\n` : '') +
                      (a.abstract ? `   Résumé : ${a.abstract}\n` : '')
                  )
                  .join('\n')
              : 'Aucun article trouvé pour cette requête.';

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: resultText,
            });
          }
        }

        // Mettre à jour le fil de messages avec la réponse de l'IA + résultats d'outils
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: contentBlocks },
          { role: 'user', content: toolResults },
        ];
      }

      // ── Émettre les résultats de recherche à la fin du stream ───────────
      if (foundArticles.length > 0) {
        encode('\n\n__SEARCH_RESULTS__' + JSON.stringify(foundArticles));
      }

      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
