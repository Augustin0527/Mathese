'use client';

import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search, Send, Loader2, Sparkles, BookOpen, ExternalLink,
  Plus, CheckCircle2, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ArticleResultat {
  id: string;
  titre: string;
  auteurs: string;
  annee: string;
  citationCount: number;
  doi: string | null;
  urlPdf: string | null;
  priorite: 'haute' | 'moyenne' | 'basse';
  resume: string;
  apport: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PRIORITE_CONFIG = {
  haute:   { label: 'Haute priorité',   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500' },
  moyenne: { label: 'Priorité moyenne', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400' },
  basse:   { label: 'Priorité basse',   color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400'  },
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function RecherchePage() {
  const { user, profile } = useAuth();

  // ── Chat ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Recherche d'articles ──
  const [sujetRecherche, setSujetRecherche] = useState('');
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleResultat[]>([]);
  const [synthese, setSynthese] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<Set<string>>(new Set());
  const [tableVisible, setTableVisible] = useState(true);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Envoi d'un message chat ──────────────────────────────────────────────
  async function envoyerMessage() {
    if (!input.trim() || chatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setChatLoading(true);

    // Abort controller pour pouvoir annuler
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: newMessages,
          sujetThese: profile?.sujetRecherche ?? '',
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Erreur serveur: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: text };
          return updated;
        });
      }
    } catch (err: unknown) {
      // Ne pas montrer d'erreur si l'utilisateur a annulé
      if ((err as Error).name === 'AbortError') return;
      setMessages((prev) => {
        const updated = [...prev];
        // Remplacer le dernier message vide ou ajouter un message d'erreur
        const last = updated[updated.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'Une erreur est survenue. Réessayez.',
          };
        } else {
          updated.push({ role: 'assistant', content: 'Une erreur est survenue. Réessayez.' });
        }
        return updated;
      });
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }

  // ── Recherche d'articles ─────────────────────────────────────────────────
  async function lancerRecherche() {
    if (!sujetRecherche.trim() || articlesLoading) return;
    setArticlesLoading(true);
    setArticles([]);
    setSynthese('');

    try {
      const res = await fetch('/api/recherche/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujet: sujetRecherche }),
      });
      const data = await res.json();
      setArticles(data.articles ?? []);
      setSynthese(data.synthese ?? '');
    } catch {
      setSynthese('Erreur lors de la recherche. Vérifiez votre connexion et réessayez.');
    } finally {
      setArticlesLoading(false);
    }
  }

  // ── Ajouter à la bibliothèque ────────────────────────────────────────────
  async function ajouterABibliotheque(article: ArticleResultat) {
    if (!user || ajoutes.has(article.id)) return;
    await addDoc(collection(db, 'utilisateurs', user.uid, 'articles'), {
      titre: article.titre,
      auteurs: article.auteurs,
      annee: article.annee,
      doi: article.doi ?? '',
      url: article.urlPdf ?? '',
      notes: article.apport,
      tags: [],
      lu: false,
      createdAt: serverTimestamp(),
    });
    setAjoutes((prev) => new Set(prev).add(article.id));
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">

      {/* ══ Panneau gauche : Chat IA ══════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-h-0 border-r border-gray-100">
        {/* En-tête chat */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Chat IA</h2>
              <p className="text-xs text-gray-400">Posez vos questions de recherche</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <p className="text-sm text-gray-400 max-w-xs">
                Discutez avec l&apos;IA sur votre sujet de thèse, explorez des concepts ou demandez de l&apos;aide pour structurer vos idées.
              </p>
              <div className="flex flex-col gap-2 mt-5 w-full max-w-sm">
                {[
                  'Comment structurer ma revue de littérature ?',
                  'Quelles méthodes qualitatives pour mon sujet ?',
                  'Quels cadres théoriques mobiliser ?',
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[90%] rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white px-4 py-2.5 rounded-br-sm'
                    : 'bg-gray-50 border border-gray-100 px-4 py-3 rounded-bl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                ) : msg.content ? (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:mb-1 prose-p:text-gray-800 prose-p:my-1 prose-li:text-gray-800 prose-li:my-0 prose-strong:text-gray-900 prose-table:text-xs prose-td:px-2 prose-td:py-1 prose-th:px-2 prose-th:py-1 prose-code:text-indigo-700 prose-code:bg-indigo-50 prose-code:px-1 prose-code:rounded">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Réflexion en cours...
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input chat */}
        <div className="flex-shrink-0 border-t border-gray-100 px-5 py-3 bg-white">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerMessage(); } }}
              placeholder="Votre question..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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

      {/* ══ Panneau droit : Recherche d'articles ═════════════════════════════ */}
      <div className="flex flex-col flex-1 min-h-0 lg:max-w-[55%]">
        {/* En-tête recherche */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Recherche d&apos;articles</h2>
              <p className="text-xs text-gray-400">Semantic Scholar · Classement IA · Ajout à la bibliothèque</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={sujetRecherche}
              onChange={(e) => setSujetRecherche(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') lancerRecherche(); }}
              placeholder="Entrez votre sujet (ex: IMSE inégalités scolaires)"
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={lancerRecherche}
              disabled={!sujetRecherche.trim() || articlesLoading}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {articlesLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
              {articlesLoading ? 'Analyse...' : 'Rechercher'}
            </button>
          </div>
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">

          {/* État de chargement */}
          {articlesLoading && (
            <div className="text-center py-12">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">Recherche en cours...</p>
              <p className="text-xs text-gray-400 mt-1">Analyse et classement des articles par l&apos;IA</p>
            </div>
          )}

          {/* Cartes articles */}
          {!articlesLoading && articles.length > 0 && (
            <>
              {(['haute', 'moyenne', 'basse'] as const).map((prio) => {
                const group = articles.filter((a) => a.priorite === prio);
                if (!group.length) return null;
                const cfg = PRIORITE_CONFIG[prio];
                return (
                  <div key={prio}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        {cfg.label} ({group.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          expanded={expandedId === article.id}
                          onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
                          onAjouter={() => ajouterABibliotheque(article)}
                          ajoute={ajoutes.has(article.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Tableau récapitulatif */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <button
                  onClick={() => setTableVisible(!tableVisible)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <span className="text-sm font-semibold text-gray-900">Tableau récapitulatif ({articles.length})</span>
                  {tableVisible ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {tableVisible && (
                  <div className="overflow-x-auto border-t border-gray-50">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Titre · Auteurs · Année</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500 w-28">Priorité</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Résumé</th>
                          <th className="text-left px-3 py-2 font-semibold text-gray-500">Apport</th>
                          <th className="px-3 py-2 w-16" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {articles.map((a) => {
                          const cfg = PRIORITE_CONFIG[a.priorite];
                          const auteursCourts = a.auteurs.split(',').slice(0, 2).join(', ') + (a.auteurs.split(',').length > 2 ? ' et al.' : '');
                          return (
                            <tr key={a.id} className="hover:bg-gray-50 align-top">
                              <td className="px-3 py-2.5 max-w-[180px]">
                                <p className="font-medium text-gray-900 leading-snug mb-0.5 line-clamp-2">{a.titre}</p>
                                <p className="text-gray-400">{auteursCourts} · {a.annee}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  {a.priorite}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 max-w-[200px]">
                                <p className="line-clamp-3">{a.resume}</p>
                              </td>
                              <td className="px-3 py-2.5 text-indigo-700 max-w-[200px]">
                                <p className="line-clamp-3">{a.apport}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1.5 items-center">
                                  {(a.doi || a.urlPdf) && (
                                    <a href={a.urlPdf ?? `https://doi.org/${a.doi}`} target="_blank" rel="noopener noreferrer"
                                      className="text-gray-400 hover:text-indigo-600 transition-colors" title="Lire l'article">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <button onClick={() => ajouterABibliotheque(a)} disabled={ajoutes.has(a.id)}
                                    title={ajoutes.has(a.id) ? 'Déjà ajouté' : 'Ajouter à la bibliothèque'}
                                    className={`transition-colors ${ajoutes.has(a.id) ? 'text-green-500' : 'text-gray-400 hover:text-green-600'}`}>
                                    {ajoutes.has(a.id) ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Synthèse */}
              {synthese && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-sm font-semibold text-indigo-800">Synthèse de la recherche</span>
                  </div>
                  <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">{synthese}</div>
                </div>
              )}
            </>
          )}

          {/* État vide */}
          {!articlesLoading && articles.length === 0 && !synthese && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <BookOpen className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Entrez un sujet pour trouver des articles</p>
              <p className="text-xs text-gray-300 mt-1">Sources : Semantic Scholar · Classement par Claude</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Carte article ────────────────────────────────────────────────────────────

function ArticleCard({ article, expanded, onToggle, onAjouter, ajoute }: {
  article: ArticleResultat;
  expanded: boolean;
  onToggle: () => void;
  onAjouter: () => void;
  ajoute: boolean;
}) {
  const cfg = PRIORITE_CONFIG[article.priorite];
  const auteursCourts = article.auteurs.split(',').slice(0, 3).join(', ') + (article.auteurs.split(',').length > 3 ? ' et al.' : '');

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${cfg.border}`}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">{article.titre}</p>
            <p className="text-xs text-gray-400 mt-0.5">{auteursCourts} · {article.annee}
              {article.citationCount > 0 && <span className="ml-2 text-gray-300">{article.citationCount} citations</span>}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
              {article.priorite}
            </span>
            {(article.doi || article.urlPdf) && (
              <a href={article.urlPdf ?? `https://doi.org/${article.doi}`} target="_blank" rel="noopener noreferrer"
                className="p-1 text-gray-300 hover:text-indigo-600 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onAjouter} disabled={ajoute}
              className={`p-1 transition-colors ${ajoute ? 'text-green-500' : 'text-gray-300 hover:text-green-600'}`}>
              {ajoute ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onToggle} className="p-1 text-gray-300 hover:text-gray-600 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-3 pt-2.5 space-y-2">
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Résumé</p>
            <p className="text-sm text-gray-700 leading-relaxed">{article.resume}</p>
          </div>
          {article.apport && (
            <div className="bg-indigo-50 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-indigo-700 mb-0.5">Apport pour votre recherche</p>
              <p className="text-sm text-indigo-900 leading-relaxed">{article.apport}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
