'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Search, Send, Loader2, Sparkles, BookOpen, ExternalLink,
  Plus, CheckCircle2, ChevronDown, ChevronUp, LibraryBig, AlertCircle, Copy, Check,
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
  dejaDisponible: boolean;
}

interface ArticleBiblio {
  id: string;
  titre: string;
  auteurs?: string[];
  annee?: number | null;
  doi?: string;
  abstract?: string;
  notes?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const PRIORITE_CONFIG = {
  haute:   { label: 'Haute',   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  dot: 'bg-green-500' },
  moyenne: { label: 'Moyenne', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400' },
  basse:   { label: 'Basse',   color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200',   dot: 'bg-gray-400'  },
};

// ─── Page principale ─────────────────────────────────────────────────────────

export default function RecherchePage() {
  const { user, profile } = useAuth();

  // ── Bibliothèque existante de l'étudiant ──
  const [biblioExistante, setBiblioExistante] = useState<ArticleBiblio[]>([]);

  // ── Chat ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Recherche d'articles ──
  const [sujet, setSujet] = useState('');
  const [rechercheLoading, setRechercheLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleResultat[]>([]);
  const [synthese, setSynthese] = useState('');
  const [erreurRecherche, setErreurRecherche] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<Set<string>>(new Set());
  const [ajoutTousLoading, setAjoutTousLoading] = useState(false);
  const [tableVisible, setTableVisible] = useState(true);

  // Charger la bibliothèque existante depuis Supabase
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

  // ── Vérifier si un article est dans la bibliothèque (comparaison de titre) ──
  const estDansBiblio = useCallback((titre: string): boolean => {
    const t = titre.toLowerCase().trim();
    return biblioExistante.some((a) => {
      const existing = a.titre.toLowerCase().trim();
      // Correspondance si >70% des mots clés sont communs
      const mots = t.split(/\s+/).filter((m) => m.length > 4);
      if (!mots.length) return existing.includes(t.slice(0, 20));
      const matches = mots.filter((m) => existing.includes(m));
      return matches.length / mots.length > 0.6;
    });
  }, [biblioExistante]);

  // ── Envoi d'un message chat ──────────────────────────────────────────────
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
      let text = '';

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
      if ((err as Error).name === 'AbortError') return;
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        const errorMsg = { role: 'assistant' as const, content: 'Erreur de connexion. Réessayez.' };
        if (last?.role === 'assistant' && !last.content) updated[updated.length - 1] = errorMsg;
        else updated.push(errorMsg);
        return updated;
      });
    } finally {
      setChatLoading(false);
      abortRef.current = null;
    }
  }

  // ── Recherche d'articles ─────────────────────────────────────────────────
  async function lancerRecherche() {
    if (!sujet.trim() || rechercheLoading) return;
    setRechercheLoading(true);
    setArticles([]);
    setSynthese('');
    setErreurRecherche('');
    setAjoutes(new Set());

    try {
      const res = await fetch('/api/recherche/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sujet,
          titresExistants: biblioExistante.map((a) => a.titre),
        }),
      });

      if (!res.ok) throw new Error(`Erreur ${res.status}`);

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Marquer les articles déjà dans la bibliothèque
      const articlesAvecStatut: ArticleResultat[] = (data.articles ?? []).map((a: ArticleResultat) => ({
        ...a,
        dejaDisponible: a.dejaDisponible || estDansBiblio(a.titre),
      }));

      setArticles(articlesAvecStatut);
      setSynthese(data.synthese ?? '');

      if (articlesAvecStatut.length === 0 && !data.synthese) {
        setErreurRecherche('Aucun résultat. Essayez en anglais ou avec des termes plus généraux.');
      }
    } catch (err: unknown) {
      setErreurRecherche((err as Error).message || 'Erreur lors de la recherche.');
    } finally {
      setRechercheLoading(false);
    }
  }

  // ── Ajouter un article à la bibliothèque ────────────────────────────────
  async function ajouterArticle(article: ArticleResultat) {
    if (!user || ajoutes.has(article.id) || article.dejaDisponible) return;
    await supabase.from('articles').insert({
      user_id: user.id,
      titre: article.titre,
      auteurs: article.auteurs ? [article.auteurs] : [],
      annee: article.annee ? Number(article.annee) : null,
      doi: article.doi ?? '',
      url: article.urlPdf ?? '',
      notes: article.apport,
      tags: [],
      lu: false,
    });
    setAjoutes((prev) => new Set(prev).add(article.id));
  }

  // ── Ajouter tous les articles non déjà présents ──────────────────────────
  async function ajouterTousLesArticles() {
    if (!user || ajoutTousLoading) return;
    const aNouveaux = articles.filter((a) => !a.dejaDisponible && !ajoutes.has(a.id));
    if (!aNouveaux.length) return;
    setAjoutTousLoading(true);
    for (const article of aNouveaux) {
      await ajouterArticle(article);
    }
    setAjoutTousLoading(false);
  }

  const nouveauxArticles = articles.filter((a) => !a.dejaDisponible && !ajoutes.has(a.id));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0 overflow-hidden">

      {/* ══ Panneau gauche : Chat IA ══════════════════════════════════════════ */}
      <div className="flex flex-col w-full lg:w-[42%] min-h-0 border-r border-gray-100 flex-shrink-0">
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
                  ? `Accès à votre bibliothèque · ${biblioExistante.length} référence${biblioExistante.length > 1 ? 's' : ''}`
                  : 'Posez vos questions de recherche'}
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
                Votre assistant personnel a accès à votre bibliothèque et peut vous recommander des références.
              </p>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                {[
                  'Quelles références de ma bibliothèque sont liées à ma problématique ?',
                  'Comment structurer ma revue de littérature ?',
                  'Quels cadres théoriques mobiliser pour mon sujet ?',
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
              placeholder="Votre question..."
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

      {/* ══ Panneau droit : Recherche d'articles ═════════════════════════════ */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* En-tête recherche */}
        <div className="flex-shrink-0 px-5 py-3.5 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Recherche d&apos;articles</p>
              <p className="text-xs text-gray-400">Semantic Scholar · Classement IA · L&apos;IA vérifie votre bibliothèque</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') lancerRecherche(); }}
              placeholder="Ex: IMSE inégalités scolaires, climate change adaptation..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={lancerRecherche}
              disabled={!sujet.trim() || rechercheLoading}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {rechercheLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Search className="w-4 h-4" />
              }
              {rechercheLoading ? 'Analyse...' : 'Rechercher'}
            </button>
          </div>
        </div>

        {/* Corps résultats */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">

          {/* Chargement */}
          {rechercheLoading && (
            <div className="text-center py-16">
              <Sparkles className="w-8 h-8 text-indigo-400 animate-pulse mx-auto mb-3" />
              <p className="text-sm text-gray-600 font-medium">Recherche + analyse IA en cours...</p>
              <p className="text-xs text-gray-400 mt-1">Comparaison avec votre bibliothèque</p>
            </div>
          )}

          {/* Erreur */}
          {!rechercheLoading && erreurRecherche && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{erreurRecherche}</p>
            </div>
          )}

          {/* Résultats */}
          {!rechercheLoading && articles.length > 0 && (
            <>
              {/* Barre d'actions globales */}
              <div className="flex items-center justify-between py-1">
                <p className="text-xs text-gray-500">
                  {articles.length} articles · {articles.filter((a) => a.dejaDisponible || ajoutes.has(a.id)).length} déjà dans votre bibliothèque
                </p>
                {nouveauxArticles.length > 0 && (
                  <button
                    onClick={ajouterTousLesArticles}
                    disabled={ajoutTousLoading}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {ajoutTousLoading
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <LibraryBig className="w-3.5 h-3.5" />
                    }
                    Tout ajouter ({nouveauxArticles.length})
                  </button>
                )}
              </div>

              {/* Cartes par priorité */}
              {(['haute', 'moyenne', 'basse'] as const).map((prio) => {
                const group = articles.filter((a) => a.priorite === prio);
                if (!group.length) return null;
                const cfg = PRIORITE_CONFIG[prio];
                return (
                  <div key={prio}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {cfg.label} priorité ({group.length})
                      </span>
                    </div>
                    <div className="space-y-2">
                      {group.map((article) => (
                        <ArticleCard
                          key={article.id}
                          article={article}
                          expanded={expandedId === article.id}
                          onToggle={() => setExpandedId(expandedId === article.id ? null : article.id)}
                          onAjouter={() => ajouterArticle(article)}
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
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900">Tableau récapitulatif</span>
                  {tableVisible ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {tableVisible && (
                  <div className="overflow-x-auto border-t border-gray-50">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Titre · Auteurs · Année</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500 w-24">Priorité</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Résumé</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-gray-500">Apport</th>
                          <th className="px-3 py-2.5 w-24 font-semibold text-gray-500 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {articles.map((a) => {
                          const cfg = PRIORITE_CONFIG[a.priorite];
                          const auteursCourts = a.auteurs.split(',').slice(0, 2).join(', ') + (a.auteurs.split(',').length > 2 ? ' et al.' : '');
                          const estAjoute = ajoutes.has(a.id) || a.dejaDisponible;
                          return (
                            <tr key={a.id} className="hover:bg-gray-50 align-top">
                              <td className="px-3 py-2.5 max-w-[160px]">
                                <p className="font-medium text-gray-900 leading-snug mb-0.5 line-clamp-2">{a.titre}</p>
                                <p className="text-gray-400">{auteursCourts} · {a.annee}</p>
                                {a.citationCount > 0 && <p className="text-gray-300 mt-0.5">{a.citationCount} citations</p>}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  {a.priorite}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-gray-600 max-w-[180px]">
                                <p className="line-clamp-3 leading-relaxed">{a.resume}</p>
                              </td>
                              <td className="px-3 py-2.5 text-indigo-700 max-w-[180px]">
                                <p className="line-clamp-3 leading-relaxed">{a.apport}</p>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-col gap-1.5 items-center">
                                  {(a.doi || a.urlPdf) && (
                                    <a
                                      href={a.urlPdf ?? `https://doi.org/${a.doi}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Lire
                                    </a>
                                  )}
                                  {estAjoute ? (
                                    <span className="flex items-center gap-1 text-green-600 font-medium">
                                      <CheckCircle2 className="w-3 h-3" />
                                      {a.dejaDisponible && !ajoutes.has(a.id) ? 'Déjà là' : 'Ajouté'}
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => ajouterArticle(a)}
                                      className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                                    >
                                      <Plus className="w-3 h-3" /> Ajouter
                                    </button>
                                  )}
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
                  <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">{synthese}</p>
                </div>
              )}
            </>
          )}

          {/* État vide initial */}
          {!rechercheLoading && articles.length === 0 && !erreurRecherche && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <BookOpen className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-sm text-gray-400">Entrez un sujet pour trouver des articles</p>
              <p className="text-xs text-gray-300 mt-1">Sources : Semantic Scholar · Analyse par Agent IA de MaThèse</p>
              {biblioExistante.length > 0 && (
                <p className="text-xs text-indigo-400 mt-2">
                  L&apos;IA connaît vos {biblioExistante.length} articles existants
                </p>
              )}
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
  const estDispo = article.dejaDisponible || ajoute;

  return (
    <div className={`bg-white border rounded-xl overflow-hidden ${estDispo ? 'border-green-200 bg-green-50/30' : cfg.border}`}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 leading-snug">{article.titre}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {auteursCourts} · {article.annee}
              {article.citationCount > 0 && <span className="ml-2 text-gray-300">{article.citationCount} citations</span>}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
              {cfg.label}
            </span>

            {/* Statut bibliothèque */}
            {estDispo ? (
              <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {article.dejaDisponible && !ajoute ? 'Dans votre bibliothèque' : 'Ajouté'}
              </span>
            ) : (
              <button
                onClick={onAjouter}
                className="flex items-center gap-1 text-xs text-white bg-indigo-600 hover:bg-indigo-700 px-2.5 py-0.5 rounded-full font-medium transition-colors"
              >
                <Plus className="w-3 h-3" />
                Ajouter
              </button>
            )}

            {(article.doi || article.urlPdf) && (
              <a
                href={article.urlPdf ?? `https://doi.org/${article.doi}`}
                target="_blank" rel="noopener noreferrer"
                className="p-1 text-gray-300 hover:text-indigo-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button onClick={onToggle} className="p-1 text-gray-300 hover:text-gray-600 transition-colors">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-4 pb-3 pt-2.5 space-y-2">
          {article.resume && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1">Résumé</p>
              <p className="text-sm text-gray-700 leading-relaxed">{article.resume}</p>
            </div>
          )}
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
