'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Presentation, Sparkles, Loader2, Copy, Check, BookOpen,
  ChevronDown, Users, Clock, Mic, Download,
} from 'lucide-react';

interface ArticleBiblio {
  id: string;
  titre: string;
  auteurs: string[];
  annee: number | null;
  doi?: string;
  abstract?: string;
}

const TYPES = [
  { value: 'conférence', label: 'Conférence académique' },
  { value: 'séminaire', label: 'Séminaire de recherche' },
  { value: 'soutenance', label: 'Soutenance de thèse' },
  { value: 'webinaire', label: 'Webinaire / Présentation en ligne' },
  { value: 'vulgarisation', label: 'Vulgarisation scientifique' },
];

const DUREES = ['5 minutes', '10 minutes', '15 minutes', '20 minutes', '30 minutes', '45 minutes', '1 heure'];

const AUDIENCES = [
  'Jury de thèse',
  'Chercheurs spécialistes',
  'Chercheurs non spécialistes',
  'Étudiants de master',
  'Grand public',
  'Décideurs / professionnels',
];

export default function CommunicationPage() {
  const { user, profile } = useAuth();
  const [bibliotheque, setBibliotheque] = useState<ArticleBiblio[]>([]);

  // Formulaire
  const [sujet, setSujet] = useState('');
  const [type, setType] = useState(TYPES[0].value);
  const [duree, setDuree] = useState(DUREES[2]);
  const [audience, setAudience] = useState(AUDIENCES[0]);
  const [refsSelectionnees, setRefsSelectionnees] = useState<Set<string>>(new Set());
  const [showBiblio, setShowBiblio] = useState(false);

  // Génération
  const [generating, setGenerating] = useState(false);
  const [contenu, setContenu] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('articles')
      .select('id, titre, auteurs, annee, doi, abstract')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setBibliotheque(data as ArticleBiblio[]);
      });
  }, [user]);

  useEffect(() => {
    if (contenu) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [contenu]);

  function toggleRef(id: string) {
    setRefsSelectionnees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toutSelectionner() {
    if (refsSelectionnees.size === bibliotheque.length) {
      setRefsSelectionnees(new Set());
    } else {
      setRefsSelectionnees(new Set(bibliotheque.map((a) => a.id)));
    }
  }

  async function generer() {
    if (!sujet.trim() || generating) return;
    setGenerating(true);
    setContenu('');

    const refs = bibliotheque.filter((a) => refsSelectionnees.has(a.id));
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/ai/communication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          sujet,
          type,
          duree,
          audience,
          sujetThese: profile?.sujet_recherche ?? '',
          bibliotheque: refs,
        }),
      });

      if (!res.ok || !res.body) throw new Error();

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setContenu(text);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setContenu('Erreur lors de la génération. Réessayez.');
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }

  async function copier() {
    await navigator.clipboard.writeText(contenu);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function telechargerWord() {
    if (!contenu || exporting) return;
    setExporting(true);
    try {
      const res = await fetch('/api/ai/export-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenu,
          titre: `Plan de présentation — ${sujet || 'Communication'}`,
          sujet,
          auteur: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'communication-mathese.docx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de la génération du document Word. Réessayez.');
    } finally {
      setExporting(false);
    }
  }

  async function telechargerPPTX() {
    if (!contenu || exporting) return;
    setExporting(true);
    try {
      const res = await fetch('/api/ai/export-pptx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenu,
          sujet,
          auteur: [profile?.prenom, profile?.nom].filter(Boolean).join(' ') || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'presentation-mathese.pptx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erreur lors de la génération du PowerPoint. Réessayez.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
            <Presentation className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Préparer une communication</h1>
            <p className="text-sm text-gray-500">L&apos;Agent IA génère votre plan de présentation et vos notes de discours</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Formulaire */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Paramètres</h2>

            {/* Sujet */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Sujet de la présentation *</label>
              <textarea
                rows={3}
                value={sujet}
                onChange={(e) => setSujet(e.target.value)}
                placeholder="Ex: L'impact des inégalités scolaires sur la mobilité sociale..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                <span className="flex items-center gap-1.5"><Mic className="w-3.5 h-3.5" /> Type</span>
              </label>
              <select
                value={type} onChange={(e) => setType(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Durée + Audience */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Durée</span>
                </label>
                <select
                  value={duree} onChange={(e) => setDuree(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {DUREES.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Audience</span>
                </label>
                <select
                  value={audience} onChange={(e) => setAudience(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {AUDIENCES.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* Références */}
            <div>
              <button
                onClick={() => setShowBiblio(!showBiblio)}
                className="w-full flex items-center justify-between text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-xl px-3 py-2.5 transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Références à intégrer
                  {refsSelectionnees.size > 0 && (
                    <span className="bg-violet-600 text-white text-xs px-1.5 py-0.5 rounded-full font-semibold">
                      {refsSelectionnees.size}
                    </span>
                  )}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showBiblio ? 'rotate-180' : ''}`} />
              </button>

              {showBiblio && (
                <div className="mt-2 border border-gray-100 rounded-xl overflow-hidden">
                  {bibliotheque.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Bibliothèque vide</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs text-gray-500">{bibliotheque.length} références</span>
                        <button onClick={toutSelectionner} className="text-xs text-violet-600 hover:text-violet-700 font-medium">
                          {refsSelectionnees.size === bibliotheque.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {bibliotheque.map((a) => (
                          <label key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                            <input
                              type="checkbox"
                              checked={refsSelectionnees.has(a.id)}
                              onChange={() => toggleRef(a.id)}
                              className="mt-0.5 w-4 h-4 rounded accent-violet-600 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-800 line-clamp-1">{a.titre}</p>
                              <p className="text-xs text-gray-400">
                                {(a.auteurs ?? []).slice(0, 2).join(', ')}{(a.auteurs ?? []).length > 2 ? ' et al.' : ''}
                                {a.annee ? ` · ${a.annee}` : ''}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Bouton générer */}
            <button
              onClick={generer}
              disabled={!sujet.trim() || generating}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-3 rounded-xl text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 transition-all shadow-sm"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Générer la présentation</>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="bg-violet-50 rounded-xl p-4 border border-violet-100">
            <p className="text-xs font-semibold text-violet-800 mb-1">Ce que l&apos;Agent IA génère :</p>
            <ul className="text-xs text-violet-700 space-y-1">
              <li>• Plan détaillé diapositive par diapositive</li>
              <li>• Points clés pour chaque slide</li>
              <li>• Intégration automatique de vos références</li>
              <li>• Notes de discours complètes</li>
              <li>• Conseils adaptés à votre audience</li>
            </ul>
          </div>
        </div>

        {/* Résultat */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm min-h-[500px] flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-900">Agent IA de MaThèse</span>
                {generating && (
                  <span className="flex items-center gap-1 text-xs text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-pulse" />
                    En cours...
                  </span>
                )}
              </div>
              {contenu && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copier}
                    className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                  <button
                    onClick={telechargerPPTX}
                    disabled={exporting}
                    className="flex items-center gap-1.5 text-xs bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {exporting ? 'Export...' : 'Télécharger PPTX'}
                  </button>
                  <button
                    onClick={telechargerWord}
                    disabled={exporting}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {exporting ? 'Export...' : 'Télécharger Word'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {!contenu && !generating && (
                <div className="flex flex-col items-center justify-center h-full text-center py-16 text-gray-400">
                  <Presentation className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p className="text-sm font-medium">Votre présentation apparaîtra ici</p>
                  <p className="text-xs mt-1.5 max-w-xs leading-relaxed">
                    Remplissez le formulaire, sélectionnez vos références et cliquez sur Générer
                  </p>
                </div>
              )}

              {contenu && (
                <div className="prose prose-sm max-w-none
                  prose-headings:font-bold prose-headings:text-gray-900
                  prose-h1:text-lg prose-h1:border-b prose-h1:border-gray-100 prose-h1:pb-2 prose-h1:mb-4
                  prose-h2:text-base prose-h2:text-violet-800 prose-h2:mt-5 prose-h2:mb-2
                  prose-h3:text-sm prose-h3:text-gray-700 prose-h3:mt-3 prose-h3:mb-1
                  prose-p:text-gray-700 prose-p:my-1.5 prose-p:leading-relaxed
                  prose-li:text-gray-700 prose-li:my-0.5 prose-li:leading-relaxed
                  prose-strong:text-gray-900 prose-strong:font-semibold
                  prose-hr:border-violet-100 prose-hr:my-5
                  prose-blockquote:border-l-violet-400 prose-blockquote:bg-violet-50 prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:rounded-r-lg prose-blockquote:text-violet-800
                  prose-code:text-violet-700 prose-code:bg-violet-50 prose-code:px-1 prose-code:rounded prose-code:text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {contenu}
                  </ReactMarkdown>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
