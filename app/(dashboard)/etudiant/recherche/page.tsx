'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Loader2, Sparkles, BookOpen, ExternalLink,
  Plus, CheckCircle2, Copy, Check, FileSearch,
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

// ─── Page principale ──────────────────────────────────────────────────────────

export default function RecherchePage() {
  const { user, profile } = useAuth();

  // ── Bibliothèque existante ──
  const [biblioExistante, setBiblioExistante] = useState<ArticleBiblio[]>([]);

  // ── Chat ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Résultats de recherche IA ──
  const [articlesIA, setArticlesIA] = useState<ArticleCrossRef[]>([]);
  const [ajoutesIA, setAjoutesIA] = useState<Set<number>>(new Set());

  // Charger la bibliothèque existante
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

  // ── Envoi d'un message ────────────────────────────────────────────────────
  async function envoyerMessage() {
    if (!input.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Ajouter le message assistant vide avant de streamer
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

        // Extraire le texte visible (avant __SEARCH_RESULTS__)
        const separatorIdx = fullText.indexOf('\n\n__SEARCH_RESULTS__');
        const visibleText = separatorIdx >= 0 ? fullText.slice(0, separatorIdx) : fullText;

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: visibleText };
          return updated;
        });
      }

      // Après la réception complète : extraire les articles de recherche
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

      // S'assurer que le texte final affiché est propre
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

  // ── Ajouter un article CrossRef à la bibliothèque ────────────────────────
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
      <div className="flex flex-col w-full lg:w-[55%] min-h-0 border-r border-gray-100 flex-shrink-0">

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
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
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
                  <div className="w-4 h-4 bg-gradient-to-br from-indigo-500 to-violet-600 rounded flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-gray-500">Agent IA</span>
                </div>
              )}
              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div
                  className={`max-w-[90%] rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white px-4 py-2.5 rounded-br-sm shadow-sm'
                      : 'bg-white border border-gray-100 px-4 py-3 rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : msg.content ? (
                    <div className="prose prose-sm max-w-none
                      prose-headings:font-semibold prose-headings:text-gray-900 prose-headings:mt-3 prose-headings:mb-1
                      prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                      prose-p:text-gray-800 prose-p:my-1 prose-p:leading-relaxed
                      prose-li:text-gray-800 prose-li:my-0.5
                      prose-strong:text-gray-900 prose-strong:font-semibold
                      prose-table:text-xs prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 prose-th:bg-indigo-50
                      prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded prose-code:text-xs
                      prose-pre:bg-gray-50 prose-pre:rounded-xl prose-pre:p-3 prose-pre:border prose-pre:border-gray-100
                      prose-blockquote:border-l-indigo-400 prose-blockquote:bg-indigo-50 prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:text-indigo-800
                      prose-hr:border-gray-100">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Réflexion...
                    </span>
                  )}
                </div>
                {msg.role === 'assistant' && msg.content && (
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(msg.content);
                      setCopiedId(i);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className="mb-1 p-1 text-gray-300 hover:text-gray-500 transition-colors flex-shrink-0"
                    title="Copier"
                  >
                    {copiedId === i ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-gray-100 px-4 py-3 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage(); }
              }}
              placeholder="Votre question ou demande de recherche..."
              disabled={chatLoading}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
            />
            <button
              onClick={envoyerMessage}
              disabled={!input.trim() || chatLoading}
              className="flex items-center justify-center w-9 h-9 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {chatLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />
              }
            </button>
          </div>
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

          {/* État vide */}
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

          {/* Liste des articles trouvés par l'IA */}
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

        {/* Actions */}
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
