'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import {
  Send, Loader2, Sparkles, BookOpen, ExternalLink,
  Plus, CheckCircle2, Copy, Check, FileSearch, FileDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArticleBiblio {
  id: string;
  titre: string;
  auteurs?: string[];
  annee?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
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

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Composant table avec copie ───────────────────────────────────────────────

function CopyableTable({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  function copyTable() {
    if (!tableRef.current) return;
    const rows = Array.from(tableRef.current.querySelectorAll('tr'));
    const text = rows
      .map((row) =>
        Array.from(row.querySelectorAll('th, td'))
          .map((cell) => cell.textContent?.trim() ?? '')
          .join('\t')
      )
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="relative my-4 group">
      <button
        onClick={copyTable}
        className="absolute -top-2 right-0 z-10 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 bg-white border border-gray-200 hover:border-indigo-300 px-2 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-all shadow-sm"
        title="Copier le tableau"
      >
        {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copié !' : 'Copier'}
      </button>
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table ref={tableRef} className="w-full text-sm border-collapse">
          {children}
        </table>
      </div>
    </div>
  );
}

// ─── Composant markdown riche ─────────────────────────────────────────────────

function MarkdownMessage({ content }: { content: string }) {
  const components: Components = {
    // Titres
    h1: ({ children }) => (
      <h1 className="text-base font-bold text-gray-900 mt-5 mb-2 pb-1 border-b border-gray-100">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-sm font-bold text-gray-900 mt-4 mb-2 flex items-center gap-2">
        <span className="w-1 h-4 bg-indigo-500 rounded-full inline-block flex-shrink-0" />
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1.5">{children}</h3>
    ),

    // Paragraphes
    p: ({ children }) => (
      <p className="text-sm text-gray-800 leading-relaxed my-2">{children}</p>
    ),

    // Listes à puces
    ul: ({ children }) => (
      <ul className="my-2 space-y-1.5 pl-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="my-2 space-y-1.5 pl-1 list-decimal list-inside">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-sm text-gray-800 leading-relaxed flex items-start gap-2">
        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
        <span>{children}</span>
      </li>
    ),

    // Code inline
    code: ({ className, children, ...props }) => {
      const isBlock = className?.includes('language-');
      if (isBlock) {
        return (
          <code className="block w-full text-xs text-indigo-800 font-mono leading-relaxed whitespace-pre-wrap">
            {children}
          </code>
        );
      }
      return (
        <code className="text-xs text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded font-mono" {...props}>
          {children}
        </code>
      );
    },

    // Bloc de code
    pre: ({ children }) => (
      <pre className="my-3 bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto border border-gray-700 leading-relaxed">
        {children}
      </pre>
    ),

    // Citation
    blockquote: ({ children }) => (
      <blockquote className="my-3 border-l-4 border-indigo-400 bg-indigo-50 pl-4 pr-3 py-2 rounded-r-xl text-sm text-indigo-800 italic">
        {children}
      </blockquote>
    ),

    // Séparateur
    hr: () => <hr className="my-4 border-gray-100" />,

    // Gras / italique
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-700">{children}</em>
    ),

    // Lien
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800 transition-colors"
      >
        {children}
      </a>
    ),

    // ── Tableau avec bordures visibles + bouton copie ──
    table: ({ children }) => <CopyableTable>{children}</CopyableTable>,
    thead: ({ children }) => (
      <thead className="bg-indigo-600 text-white">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-indigo-50/40 transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="text-left text-xs font-semibold px-4 py-2.5 border-r border-indigo-500 last:border-r-0 whitespace-nowrap">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="text-sm text-gray-700 px-4 py-2.5 border-r border-gray-100 last:border-r-0 align-top leading-relaxed">
        {children}
      </td>
    ),
  };

  return (
    <div className="min-w-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function RecherchePage() {
  const { user, profile } = useAuth();

  const [biblioExistante, setBiblioExistante] = useState<ArticleBiblio[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [articlesIA, setArticlesIA] = useState<ArticleCrossRef[]>([]);
  const [ajoutesIA, setAjoutesIA] = useState<Set<number>>(new Set());
  const [exportingWord, setExportingWord] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('articles')
      .select('id, titre, auteurs, annee, doi, abstract, notes')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setBiblioExistante(data as ArticleBiblio[]);
      });
  }, [user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function envoyerMessage() {
    if (!input.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages,
          sujetThese: profile?.sujet_recherche ?? '',
          bibliotheque: biblioExistante,
        }),
      });

      if (!res.ok || !res.body) throw new Error(`Erreur ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });

        const separatorIdx = fullText.indexOf('\n\n__SEARCH_RESULTS__');
        const visibleText = separatorIdx >= 0 ? fullText.slice(0, separatorIdx) : fullText;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: visibleText };
          return updated;
        });
      }

      const separatorIdx = fullText.indexOf('\n\n__SEARCH_RESULTS__');
      if (separatorIdx >= 0) {
        const jsonStr = fullText.slice(separatorIdx + '\n\n__SEARCH_RESULTS__'.length);
        try {
          const articles: ArticleCrossRef[] = JSON.parse(jsonStr);
          if (articles.length > 0) {
            setArticlesIA(articles);
            setAjoutesIA(new Set());
          }
        } catch {
          // JSON mal formé : on ignore
        }
      }

      const visibleFinal = separatorIdx >= 0 ? fullText.slice(0, separatorIdx) : fullText;
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: visibleFinal };
        return updated;
      });

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        const errorMsg: ChatMessage = { role: 'assistant', content: 'Erreur de connexion. Réessayez.' };
        if (last?.role === 'assistant' && !last.content) updated[updated.length - 1] = errorMsg;
        else updated.push(errorMsg);
        return updated;
      });
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }

  async function exporterWord(content: string, index: number) {
    if (exportingWord !== null) return;
    setExportingWord(index);
    try {
      const res = await fetch('/api/ai/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenu: content,
          titre: profile?.sujet_recherche ? `Rapport — ${profile.sujet_recherche}` : 'Rapport Agent IA',
          auteur: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || undefined,
          sujet: profile?.sujet_recherche ?? '',
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-ia-${Date.now()}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de la génération Word. Réessayez.');
    } finally {
      setExportingWord(null);
    }
  }

  async function ajouterArticleIA(article: ArticleCrossRef, index: number) {
    if (!user || ajoutesIA.has(index)) return;
    await supabase.from('articles').insert({
      user_id: user.id,
      titre: article.titre,
      auteurs: article.auteurs ? article.auteurs.split(',').map((a) => a.trim()) : [],
      annee: article.annee ? Number(article.annee) : null,
      doi: article.doi ?? '',
      url: article.url ?? '',
      notes: article.abstract ?? '',
      tags: [],
      lu: false,
    });
    setAjoutesIA((prev) => new Set(prev).add(index));
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 overflow-hidden">

      {/* ══ Panneau gauche : Chat IA ════════════════════════════════════════ */}
      <div className="flex flex-col w-full lg:w-[60%] min-h-0 border-r border-gray-100 flex-shrink-0">

        {/* En-tête */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Agent IA de MaThèse</p>
              <p className="text-xs text-gray-400">
                {biblioExistante.length > 0
                  ? `Accès à votre bibliothèque · ${biblioExistante.length} référence${biblioExistante.length > 1 ? 's' : ''} · Recherche CrossRef intégrée`
                  : 'Posez vos questions · Recherche d\'articles automatique'}
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 bg-gray-50/30">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8 px-4">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center mb-3 shadow-sm">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <p className="text-sm font-medium text-gray-700 mb-0.5">Agent IA de MaThèse</p>
              <p className="text-xs text-gray-400 max-w-xs leading-relaxed mb-5">
                Votre assistant a accès à votre bibliothèque et peut rechercher automatiquement des articles sur CrossRef.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {[
                  'Trouve-moi des articles sur les inégalités scolaires et le milieu socio-économique',
                  'Quelles références de ma bibliothèque sont liées à ma problématique ?',
                  'Comment structurer ma revue de littérature ?',
                  'Recherche des articles sur le changement climatique et l\'adaptation urbaine',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2.5 rounded-xl transition-colors border border-indigo-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 px-1">
                  <div className="w-5 h-5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Agent IA</span>
                </div>
              )}
              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} w-full`}>
                <div
                  className={`rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'max-w-[80%] bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-br-sm shadow-sm'
                      : 'w-full bg-white border border-gray-200 px-5 py-4 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</span>
                  ) : msg.content ? (
                    <MarkdownMessage content={msg.content} />
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-400 text-xs py-1">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Réflexion en cours...
                    </span>
                  )}
                </div>
                {msg.role === 'assistant' && msg.content && (
                  <div className="flex flex-col gap-1 mb-1 flex-shrink-0">
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(msg.content);
                        setCopiedId(i);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                      title="Copier la réponse"
                    >
                      {copiedId === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => exporterWord(msg.content, i)}
                      disabled={exportingWord === i}
                      className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors disabled:opacity-50"
                      title="Exporter en Word (.docx)"
                    >
                      {exportingWord === i
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        : <FileDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage(); }
              }}
              placeholder="Votre question ou demande de recherche... (Entrée pour envoyer, Maj+Entrée pour sauter une ligne)"
              disabled={chatLoading}
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 resize-none leading-relaxed"
            />
            <button
              onClick={envoyerMessage}
              disabled={!input.trim() || chatLoading}
              className="flex items-center justify-center w-10 h-10 self-end bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {chatLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
          <p className="text-xs text-gray-300 mt-1.5 px-1">Maj+Entrée pour sauter une ligne</p>
        </div>
      </div>

      {/* ══ Panneau droit : Documents & Recherches ══════════════════════════ */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* En-tête */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <FileSearch className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Documents & Recherches</p>
              <p className="text-xs text-gray-400">
                {articlesIA.length > 0
                  ? `${articlesIA.length} article${articlesIA.length > 1 ? 's' : ''} trouvé${articlesIA.length > 1 ? 's' : ''} par l'Agent IA`
                  : 'Résultats de recherche de l\'Agent IA'}
              </p>
            </div>
          </div>
        </div>

        {/* Corps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">

          {articlesIA.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
              <div className="w-14 h-14 bg-gray-50 border border-gray-100 rounded-2xl flex items-center justify-center mb-4">
                <BookOpen className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">
                Les recherches effectuées par l&apos;Agent IA apparaîtront ici
              </p>
              <p className="text-xs text-gray-300 max-w-xs leading-relaxed">
                Demandez à l&apos;Agent IA de trouver des articles sur un sujet — il interrogera CrossRef automatiquement.
              </p>
              <div className="mt-6 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 max-w-xs">
                <p className="text-xs text-indigo-600 font-medium mb-1">Exemple</p>
                <p className="text-xs text-indigo-500 italic">
                  &ldquo;Trouve-moi des articles sur la méthodologie qualitative en sciences de l&apos;éducation&rdquo;
                </p>
              </div>
            </div>
          )}

          {articlesIA.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-400 font-medium">
                  Source : CrossRef · {articlesIA.length} résultat{articlesIA.length > 1 ? 's' : ''}
                </p>
                <span className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-medium border border-indigo-100">
                  Via Agent IA
                </span>
              </div>

              {articlesIA.map((article, idx) => (
                <ArticleCardIA
                  key={idx}
                  article={article}
                  ajoute={ajoutesIA.has(idx)}
                  onAjouter={() => ajouterArticleIA(article, idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carte article CrossRef ───────────────────────────────────────────────────

function ArticleCardIA({
  article,
  ajoute,
  onAjouter,
}: {
  article: ArticleCrossRef;
  ajoute: boolean;
  onAjouter: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">{article.titre}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {article.auteurs && (
                <span className="text-xs text-gray-400">{article.auteurs}</span>
              )}
              {article.annee && (
                <span className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{article.annee}</span>
              )}
              {article.type && (
                <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded capitalize">{article.type}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {ajoute ? (
            <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ajouté à la bibliothèque
            </span>
          ) : (
            <button
              onClick={onAjouter}
              className="flex items-center gap-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter à ma bibliothèque
            </button>
          )}

          {(article.doi || article.url) && (
            <a
              href={article.url ?? `https://doi.org/${article.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Voir
            </a>
          )}

          {article.abstract && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors ml-auto"
            >
              {expanded ? 'Masquer résumé' : 'Voir résumé'}
            </button>
          )}
        </div>
      </div>

      {expanded && article.abstract && (
        <div className="border-t border-gray-50 px-4 py-3 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-500 mb-1">Résumé</p>
          <p className="text-xs text-gray-600 leading-relaxed">{article.abstract}</p>
          {article.doi && (
            <p className="text-xs text-gray-300 mt-2">DOI : {article.doi}</p>
          )}
        </div>
      )}
    </div>
  );
}
