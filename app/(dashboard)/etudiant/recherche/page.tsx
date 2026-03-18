'use client';

import { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, Send, Loader2, Sparkles, BookOpen, ExternalLink,
  Plus, CheckCircle2, ChevronDown, ChevronUp, MessageSquare,
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
  haute: { label: 'Priorité haute', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' },
  moyenne: { label: 'Priorité moyenne', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-400' },
  basse: { label: 'Priorité basse', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-400' },
};

// ─── Composant principal ─────────────────────────────────────────────────────

export default function RecherchePage() {
  const { user, profile } = useAuth();

  // Mode actif : chat ou recherche
  const [mode, setMode] = useState<'chat' | 'recherche'>('chat');

  // ── Chat IA ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Recherche d'articles ──
  const [sujet, setSujet] = useState('');
  const [rechercheLoading, setRechercheLoading] = useState(false);
  const [articles, setArticles] = useState<ArticleResultat[]>([]);
  const [synthese, setSynthese] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [ajoutes, setAjoutes] = useState<Set<string>>(new Set());
  const [tableVisible, setTableVisible] = useState(true);

  // Scroll automatique dans le chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Envoi d'un message au chat ──────────────────────────────────────────
  async function envoyerMessage() {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          sujetThese: profile?.sujetRecherche ?? '',
        }),
      });

      if (!res.ok || !res.body) throw new Error('Erreur serveur');

      // Streaming : on lit la réponse au fur et à mesure
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';

      setChatMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: assistantText };
          return updated;
        });
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Désolé, une erreur est survenue. Réessayez.' },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // ── Recherche d'articles ──────────────────────────────────────────────────
  async function lancerRecherche() {
    if (!sujet.trim() || rechercheLoading) return;
    setRechercheLoading(true);
    setArticles([]);
    setSynthese('');

    try {
      const res = await fetch('/api/recherche/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sujet }),
      });
      const data = await res.json();
      setArticles(data.articles ?? []);
      setSynthese(data.synthese ?? '');
    } catch {
      setSynthese('Erreur lors de la recherche. Vérifiez votre connexion et réessayez.');
    } finally {
      setRechercheLoading(false);
    }
  }

  // ── Ajouter un article à la bibliothèque ────────────────────────────────
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

  return (
    <div className="flex flex-col h-full">
      {/* En-tête avec tabs */}
      <div className="flex-shrink-0 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Assistant de recherche</h1>
            <p className="text-gray-500 text-xs mt-0.5">Chat IA + recherche d&apos;articles académiques</p>
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setMode('chat')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'chat' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Chat IA
            </button>
            <button
              onClick={() => setMode('recherche')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'recherche' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Articles
            </button>
          </div>
        </div>
      </div>

      {/* ── Mode Chat ── */}
      {mode === 'chat' && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                  <Sparkles className="w-7 h-7 text-indigo-600" />
                </div>
                <h2 className="font-semibold text-gray-900 mb-1">Assistant de thèse</h2>
                <p className="text-sm text-gray-400 max-w-xs">
                  Posez vos questions sur votre sujet de recherche, demandez des explications de concepts, ou explorez des pistes.
                </p>
                <div className="grid grid-cols-1 gap-2 mt-6 w-full max-w-sm">
                  {[
                    'Quelles sont les méthodes qualitatives les plus utilisées ?',
                    'Comment structurer ma revue de littérature ?',
                    'Quelles hypothèses pourrais-je formuler ?',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => { setChatInput(suggestion); }}
                      className="text-left text-sm text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.content || (
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      En train de réfléchir...
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-gray-100 px-6 py-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && envoyerMessage()}
                placeholder="Posez votre question..."
                disabled={chatLoading}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
              <button
                onClick={envoyerMessage}
                disabled={!chatInput.trim() || chatLoading}
                className="flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mode Recherche d'articles ── */}
      {mode === 'recherche' && (
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Barre de recherche */}
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lancerRecherche()}
              placeholder="Ex: machine learning in medical imaging, climate change adaptation..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={lancerRecherche}
              disabled={!sujet.trim() || rechercheLoading}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {rechercheLoading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Recherche...</>
              ) : (
                <><Search className="w-4 h-4" />Rechercher</>
              )}
            </button>
          </div>

          {/* État de chargement */}
          {rechercheLoading && (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-indigo-600 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-gray-700">Recherche en cours...</p>
              <p className="text-xs text-gray-400 mt-1">Analyse des articles et classement par priorité avec l&apos;IA</p>
            </div>
          )}

          {/* Résultats */}
          {!rechercheLoading && articles.length > 0 && (
            <div className="space-y-6">
              {/* Cards d'articles par priorité */}
              {(['haute', 'moyenne', 'basse'] as const).map((prio) => {
                const group = articles.filter((a) => a.priorite === prio);
                if (group.length === 0) return null;
                const cfg = PRIORITE_CONFIG[prio];
                return (
                  <div key={prio}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      <h2 className="text-sm font-semibold text-gray-700">{cfg.label} ({group.length})</h2>
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
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    Tableau récapitulatif ({articles.length} articles)
                  </span>
                  {tableVisible ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {tableVisible && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-t border-b border-gray-100">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-8">#</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Titre</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-32">Auteurs</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-12">Année</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Résumé</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Apport</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-20">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {articles.map((article, i) => {
                          const cfg = PRIORITE_CONFIG[article.priorite];
                          return (
                            <tr key={article.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                              <td className="px-4 py-3">
                                <div className="font-medium text-gray-900 leading-snug mb-1">{article.titre}</div>
                                <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-500 leading-snug">
                                {article.auteurs.split(',').slice(0, 2).join(', ')}
                                {article.auteurs.split(',').length > 2 && ' et al.'}
                              </td>
                              <td className="px-4 py-3 text-gray-500">{article.annee}</td>
                              <td className="px-4 py-3 text-gray-600 leading-relaxed max-w-xs">
                                {article.resume}
                              </td>
                              <td className="px-4 py-3 text-indigo-700 leading-relaxed max-w-xs">
                                {article.apport}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  {(article.doi || article.urlPdf) && (
                                    <a
                                      href={article.urlPdf ?? `https://doi.org/${article.doi}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Lire
                                    </a>
                                  )}
                                  <button
                                    onClick={() => ajouterABibliotheque(article)}
                                    disabled={ajoutes.has(article.id)}
                                    className="flex items-center gap-1 text-gray-400 hover:text-green-600 disabled:text-green-500 transition-colors"
                                  >
                                    {ajoutes.has(article.id)
                                      ? <><CheckCircle2 className="w-3 h-3" />Ajouté</>
                                      : <><Plus className="w-3 h-3" />Ajouter</>
                                    }
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
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <h2 className="text-sm font-semibold text-indigo-800">Synthèse de la recherche</h2>
                  </div>
                  <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">{synthese}</div>
                </div>
              )}
            </div>
          )}

          {/* État vide */}
          {!rechercheLoading && articles.length === 0 && !synthese && (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500">Entrez un sujet de recherche pour trouver des articles pertinents</p>
              <p className="text-xs text-gray-400 mt-1">Sources : Semantic Scholar · Analyse par Claude</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant carte article ─────────────────────────────────────────────────

function ArticleCard({
  article, expanded, onToggle, onAjouter, ajoute,
}: {
  article: ArticleResultat;
  expanded: boolean;
  onToggle: () => void;
  onAjouter: () => void;
  ajoute: boolean;
}) {
  const cfg = PRIORITE_CONFIG[article.priorite];
  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden ${cfg.border}`}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                {cfg.label}
              </span>
              {article.citationCount > 0 && (
                <span className="text-xs text-gray-400">{article.citationCount} citations</span>
              )}
              <span className="text-xs text-gray-400">{article.annee}</span>
            </div>
            <p className="text-sm font-medium text-gray-900 leading-snug">{article.titre}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {article.auteurs.split(',').slice(0, 3).join(', ')}
              {article.auteurs.split(',').length > 3 && ' et al.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(article.doi || article.urlPdf) && (
              <a
                href={article.urlPdf ?? `https://doi.org/${article.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onAjouter}
              disabled={ajoute}
              title={ajoute ? 'Déjà dans la bibliothèque' : 'Ajouter à la bibliothèque'}
              className={`p-1.5 transition-colors ${ajoute ? 'text-green-500' : 'text-gray-400 hover:text-green-600'}`}
            >
              {ajoute ? <CheckCircle2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
            <button onClick={onToggle} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-2.5">
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
