'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Search, BookOpen, Tag, ExternalLink, FileText,
  ChevronDown, ChevronUp, Trash2, Loader2, Sparkles,
  Plus, X, Check, PenLine, Upload, Languages,
} from 'lucide-react';

interface Article {
  id: string;
  titre: string;
  auteurs: string[];
  annee: number | null;
  doi?: string;
  url?: string;
  notes?: string;
  tags: string[];
  resume_ia?: string;
  abstract?: string;
  source?: string;
  lu: boolean;
}

interface CrossRefItem {
  titre: string;
  auteurs: string[];
  annee: number | null;
  doi?: string;
  url?: string;
  abstract?: string;
  journal?: string;
  publisher?: string;
  pdfUrl?: string;
  type?: string;
}

const TYPE_LABELS: Record<string, string> = {
  'journal-article': 'Article',
  'proceedings-article': 'Actes',
  'book-chapter': 'Chapitre',
  'book': 'Livre',
  'report': 'Rapport',
  'monograph': 'Monographie',
  'edited-book': 'Ouvrage',
  'dissertation': 'Thèse',
};

const TYPES_EXCLUS = new Set(['component', 'dataset']);

function parseCrossRefItem(work: Record<string, unknown>): CrossRefItem | null {
  if (TYPES_EXCLUS.has(work.type as string)) return null;
  const title = (work.title as string[] | undefined)?.[0] ?? '';
  // Exclure les figures, tableaux et graphiques
  if (/^(Figure|Graphique|Tableau|Table|Fig\.|Tab\.)\s/i.test(title)) return null;
  if (!title) return null;

  const links = work.link as Array<Record<string, string>> | undefined;
  const pdfLink = links?.find((l) => l['content-type'] === 'application/pdf');
  const authors = (work.author as Array<Record<string, string>> | undefined) ?? [];
  const published = work.published as { 'date-parts': number[][] } | undefined;
  const containerTitle = work['container-title'] as string[] | undefined;
  const abstractRaw = work.abstract as string | undefined;

  return {
    titre: title,
    auteurs: authors.map((a) => `${a.given ?? ''} ${a.family ?? ''}`.trim()).filter(Boolean),
    annee: published?.['date-parts']?.[0]?.[0] ?? null,
    doi: work.DOI as string | undefined,
    url: work.URL as string | undefined,
    abstract: abstractRaw?.replace(/<[^>]+>/g, '') ?? undefined,
    journal: containerTitle?.[0],
    publisher: work.publisher as string | undefined,
    pdfUrl: pdfLink?.URL,
    type: work.type as string | undefined,
  };
}

function parseBibtex(raw: string) {
  const title = raw.match(/title\s*=\s*[{"](.*?)[}"]/is)?.[1] ?? '';
  const year = raw.match(/year\s*=\s*[{"']?(\d{4})[}"']?/i)?.[1];
  const doi = raw.match(/doi\s*=\s*[{"](.*?)[}"]/i)?.[1];
  const url = raw.match(/url\s*=\s*[{"](.*?)[}"]/i)?.[1];
  const authorRaw = raw.match(/author\s*=\s*[{"](.*?)[}"]/is)?.[1] ?? '';
  const auteurs = authorRaw.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean);
  const abstract = raw.match(/abstract\s*=\s*[{"](.*?)[}"]/is)?.[1];
  return { titre: title, auteurs, annee: year ? Number(year) : null, doi, url, abstract };
}

type Mode = 'recherche' | 'doi' | 'bibtex' | 'manuel';

export default function BibliothequePage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [mode, setMode] = useState<Mode>('recherche');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chargementIA, setChargementIA] = useState<string | null>(null);
  const [contenuIA, setContenuIA] = useState<Record<string, string>>({});
  const [filtreLu, setFiltreLu] = useState<'tous' | 'lu' | 'non_lu'>('tous');
  const [filtreTag, setFiltreTag] = useState('');
  const [searchLib, setSearchLib] = useState('');

  // Modal détail article
  const [modalItem, setModalItem] = useState<CrossRefItem | null>(null);
  const [modalSource, setModalSource] = useState<string>('crossref');
  const [modalAbstractFr, setModalAbstractFr] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [notesModal, setNotesModal] = useState('');
  const [tagsModal, setTagsModal] = useState('');
  const [ajoutModalEnCours, setAjoutModalEnCours] = useState(false);

  // Recherche CrossRef
  const [query, setQuery] = useState('');
  const [resultats, setResultats] = useState<CrossRefItem[]>([]);
  const [searching, setSearching] = useState(false);

  // DOI
  const [doiInput, setDoiInput] = useState('');
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiError, setDoiError] = useState('');

  // BibTeX
  const [bibtexInput, setBibtexInput] = useState('');
  const [bibtexPreview, setBibtexPreview] = useState<ReturnType<typeof parseBibtex> | null>(null);

  // Manuel
  const [titre, setTitre] = useState('');
  const [auteurs, setAuteurs] = useState('');
  const [annee, setAnnee] = useState('');
  const [doi, setDoi] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  async function loadArticles() {
    if (!user) return;
    const { data } = await supabase
      .from('articles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setArticles(data as Article[]);
    setLoading(false);
  }

  useEffect(() => {
    if (user) loadArticles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function isDejaAjoute(doi?: string) {
    return !!doi && articles.some((a) => a.doi === doi);
  }

  async function insertArticle(payload: Omit<Article, 'id' | 'lu' | 'resume_ia'>) {
    if (!user) return;
    await supabase.from('articles').insert({ user_id: user.id, ...payload, lu: false });
    await loadArticles();
  }

  // --- Recherche CrossRef ---
  async function searchCrossRef() {
    if (!query.trim()) return;
    setSearching(true);
    setResultats([]);
    try {
      const res = await fetch(
        `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=15&select=title,author,published,DOI,URL,abstract,type,container-title,publisher,link`
      );
      const json = await res.json();
      const items = (json.message?.items ?? [])
        .map(parseCrossRefItem)
        .filter(Boolean) as CrossRefItem[];
      setResultats(items);
    } catch { /* silently */ }
    finally { setSearching(false); }
  }

  // --- DOI ---
  async function resolveDOI() {
    if (!doiInput.trim()) return;
    setDoiLoading(true);
    setDoiError('');
    try {
      const clean = doiInput.trim().replace(/^https?:\/\/doi\.org\//i, '');
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(clean)}?select=title,author,published,DOI,URL,abstract,type,container-title,publisher,link`
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      const item = parseCrossRefItem(json.message);
      if (!item) throw new Error();
      openModal(item, 'doi');
    } catch {
      setDoiError('DOI introuvable. Vérifiez et réessayez.');
    } finally {
      setDoiLoading(false);
    }
  }

  // --- Modal ---
  function openModal(item: CrossRefItem, source = 'crossref') {
    setModalItem(item);
    setModalSource(source);
    setModalAbstractFr(null);
    setNotesModal('');
    setTagsModal('');
  }

  async function traduireAbstract() {
    if (!modalItem?.abstract) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/ai/traduire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte: modalItem.abstract }),
      });
      const data = await res.json();
      setModalAbstractFr(data.traduction);
    } catch { /* silently */ }
    finally { setTranslating(false); }
  }

  async function ajouterDepuisModal() {
    if (!modalItem) return;
    setAjoutModalEnCours(true);
    await insertArticle({
      titre: modalItem.titre,
      auteurs: modalItem.auteurs,
      annee: modalItem.annee,
      doi: modalItem.doi,
      url: modalItem.pdfUrl ?? modalItem.url,
      abstract: modalAbstractFr ?? modalItem.abstract ?? '',
      notes: notesModal,
      tags: tagsModal.split(',').map((t) => t.trim()).filter(Boolean),
      source: modalSource,
    });
    setAjoutModalEnCours(false);
    setModalItem(null);
    setShowPanel(false);
  }

  // --- BibTeX ---
  async function ajouterBibtex() {
    if (!bibtexPreview?.titre) return;
    await insertArticle({
      titre: bibtexPreview.titre,
      auteurs: bibtexPreview.auteurs,
      annee: bibtexPreview.annee,
      doi: bibtexPreview.doi ?? '',
      url: bibtexPreview.url ?? '',
      abstract: bibtexPreview.abstract ?? '',
      notes: '',
      tags: [],
      source: 'bibtex',
    });
    setBibtexInput(''); setBibtexPreview(null); setShowPanel(false);
  }

  // --- Manuel ---
  async function ajouterManuel() {
    if (!titre.trim()) return;
    await insertArticle({
      titre, notes,
      auteurs: auteurs.split(',').map((a) => a.trim()).filter(Boolean),
      annee: annee ? Number(annee) : null,
      doi, url, abstract: '',
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      source: 'manuel',
    });
    setTitre(''); setAuteurs(''); setAnnee(''); setDoi('');
    setUrl(''); setNotes(''); setTagsInput('');
    setShowPanel(false);
  }

  async function toggleLu(article: Article) {
    await supabase.from('articles').update({ lu: !article.lu }).eq('id', article.id);
    loadArticles();
  }

  async function supprimerArticle(id: string) {
    await supabase.from('articles').delete().eq('id', id);
    loadArticles();
  }

  async function genererResume(article: Article) {
    const contenu = contenuIA[article.id] ?? article.abstract ?? '';
    if (!contenu.trim()) return;
    setChargementIA(article.id);
    try {
      const res = await fetch('/api/ai/resume-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: article.titre, contenu }),
      });
      const data = await res.json();
      await supabase.from('articles').update({ resume_ia: data.resume }).eq('id', article.id);
      loadArticles();
    } catch {
      alert('Erreur lors de la génération du résumé.');
    } finally {
      setChargementIA(null);
    }
  }

  const tousLesTags = [...new Set(articles.flatMap((a) => a.tags ?? []))];
  const articlesFiltres = articles.filter((a) => {
    if (filtreLu === 'lu' && !a.lu) return false;
    if (filtreLu === 'non_lu' && a.lu) return false;
    if (filtreTag && !(a.tags ?? []).includes(filtreTag)) return false;
    if (searchLib) {
      const q = searchLib.toLowerCase();
      if (!a.titre.toLowerCase().includes(q) && !(a.auteurs ?? []).join(' ').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const MODES: { id: Mode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'recherche', label: 'Rechercher', Icon: Search },
    { id: 'doi', label: 'DOI', Icon: Upload },
    { id: 'bibtex', label: 'BibTeX', Icon: Upload },
    { id: 'manuel', label: 'Manuel', Icon: PenLine },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bibliothèque</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {articles.length} référence{articles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Panel d'ajout */}
      {showPanel && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {MODES.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPanel(false)} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Recherche CrossRef */}
          {mode === 'recherche' && (
            <div>
              <div className="flex gap-2 mb-3">
                <input
                  type="text" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchCrossRef()}
                  placeholder="Titre, auteur, mot-clé..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={searchCrossRef} disabled={searching}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Chercher
                </button>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {resultats.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => openModal(item, 'crossref')}
                    className="w-full text-left flex items-start gap-3 p-3 border border-gray-100 rounded-xl hover:bg-indigo-50 hover:border-indigo-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {item.type && TYPE_LABELS[item.type] && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                            {TYPE_LABELS[item.type]}
                          </span>
                        )}
                        {isDejaAjoute(item.doi) && (
                          <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                            <Check className="w-3 h-3" /> Ajouté
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.titre}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.auteurs.slice(0, 2).join(', ')}{item.auteurs.length > 2 ? ' et al.' : ''}
                        {item.annee ? ` · ${item.annee}` : ''}
                        {item.journal ? ` · ${item.journal}` : ''}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1 -rotate-90" />
                  </button>
                ))}
                {resultats.length === 0 && !searching && query && (
                  <p className="text-sm text-gray-400 text-center py-6">Aucun résultat — essayez d&apos;autres mots-clés.</p>
                )}
              </div>
            </div>
          )}

          {/* DOI */}
          {mode === 'doi' && (
            <div>
              <p className="text-xs text-gray-400 mb-3">Entrez un DOI pour récupérer automatiquement toutes les métadonnées.</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text" value={doiInput}
                  onChange={(e) => { setDoiInput(e.target.value); setDoiError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && resolveDOI()}
                  placeholder="10.1000/xyz123  ou  https://doi.org/..."
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={resolveDOI} disabled={doiLoading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
                >
                  {doiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Récupérer'}
                </button>
              </div>
              {doiError && <p className="text-xs text-red-500">{doiError}</p>}
            </div>
          )}

          {/* BibTeX */}
          {mode === 'bibtex' && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Collez une entrée BibTeX (Zotero, Google Scholar, Mendeley…)</p>
              <textarea
                rows={5} value={bibtexInput}
                onChange={(e) => { setBibtexInput(e.target.value); setBibtexPreview(null); }}
                placeholder={'@article{key,\n  title = {Titre},\n  author = {Nom, Prénom},\n  year = {2024},\n  doi = {10.xxxx/...}\n}'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
              />
              <button
                onClick={() => setBibtexPreview(parseBibtex(bibtexInput))}
                className="border border-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-50 mb-3"
              >
                Analyser
              </button>
              {bibtexPreview?.titre && (
                <div className="border border-indigo-100 bg-indigo-50 rounded-xl p-3">
                  <p className="text-sm font-medium text-gray-900">{bibtexPreview.titre}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {bibtexPreview.auteurs.join(', ')}{bibtexPreview.annee ? ` · ${bibtexPreview.annee}` : ''}
                  </p>
                  <button
                    onClick={ajouterBibtex}
                    className="mt-3 flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700"
                  >
                    <Plus className="w-3.5 h-3.5" /> Ajouter à la bibliothèque
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manuel */}
          {mode === 'manuel' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Saisie manuelle — uniquement si les autres méthodes n&apos;ont pas fonctionné.</p>
              <input
                type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
                placeholder="Titre *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={auteurs} onChange={(e) => setAuteurs(e.target.value)}
                  placeholder="Auteurs (virgule)"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input type="text" value={annee} onChange={(e) => setAnnee(e.target.value)}
                  placeholder="Année"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={doi} onChange={(e) => setDoi(e.target.value)}
                  placeholder="DOI"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="URL"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Tags (virgule)"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={2} placeholder="Notes personnelles"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button onClick={ajouterManuel} disabled={!titre.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                Ajouter manuellement
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal détail article */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-100 px-6 py-4 flex items-start gap-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                {modalItem.type && TYPE_LABELS[modalItem.type] && (
                  <span className="inline-block text-xs font-medium bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mb-2">
                    {TYPE_LABELS[modalItem.type]}
                  </span>
                )}
                <h2 className="text-base font-bold text-gray-900 leading-snug">{modalItem.titre}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {modalItem.auteurs.slice(0, 3).join(', ')}{modalItem.auteurs.length > 3 ? ' et al.' : ''}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {[modalItem.journal, modalItem.annee, modalItem.publisher].filter(Boolean).join(' · ')}
                </p>
              </div>
              <button onClick={() => setModalItem(null)} className="text-gray-400 hover:text-gray-600 p-1 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Résumé */}
              {(modalItem.abstract || modalAbstractFr) ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Résumé</p>
                    {modalItem.abstract && !modalAbstractFr && (
                      <button
                        onClick={traduireAbstract} disabled={translating}
                        className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
                      >
                        {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
                        Traduire en français
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {modalAbstractFr ?? modalItem.abstract}
                  </p>
                  {modalAbstractFr && (
                    <button onClick={() => setModalAbstractFr(null)} className="text-xs text-gray-400 hover:text-gray-600 mt-1">
                      Voir original
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic bg-gray-50 rounded-xl px-4 py-3">
                  Aucun résumé disponible pour cet article via CrossRef.
                </p>
              )}

              {/* Liens de consultation */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Consulter</p>
                <div className="flex flex-wrap gap-2">
                  {modalItem.doi && (
                    <a
                      href={`https://doi.org/${modalItem.doi}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Page de la publication
                    </a>
                  )}
                  {modalItem.url && modalItem.url !== `https://doi.org/${modalItem.doi}` && (
                    <a
                      href={modalItem.url}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-600 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Site éditeur
                    </a>
                  )}
                  {modalItem.pdfUrl && (
                    <a
                      href={modalItem.pdfUrl}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs border border-red-100 text-red-600 bg-red-50 px-3 py-2 rounded-lg hover:bg-red-100 transition-colors font-medium"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      PDF disponible
                    </a>
                  )}
                  {!modalItem.doi && !modalItem.url && !modalItem.pdfUrl && (
                    <p className="text-xs text-gray-400">Aucun lien disponible.</p>
                  )}
                </div>
              </div>

              {/* Ajouter à la bibliothèque */}
              {isDejaAjoute(modalItem.doi) ? (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-3 rounded-xl">
                  <Check className="w-4 h-4" />
                  Déjà dans votre bibliothèque
                </div>
              ) : (
                <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-700">Ajouter à ma bibliothèque</p>
                  <input
                    type="text" value={tagsModal}
                    onChange={(e) => setTagsModal(e.target.value)}
                    placeholder="Tags séparés par virgule (optionnel)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <textarea
                    rows={2} value={notesModal}
                    onChange={(e) => setNotesModal(e.target.value)}
                    placeholder="Notes personnelles (optionnel)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <button
                    onClick={ajouterDepuisModal} disabled={ajoutModalEnCours}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {ajoutModalEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {ajoutModalEnCours ? 'Ajout en cours...' : 'Ajouter à ma bibliothèque'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      {articles.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-40">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text" value={searchLib}
              onChange={(e) => setSearchLib(e.target.value)}
              placeholder="Filtrer ma bibliothèque..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filtreLu} onChange={(e) => setFiltreLu(e.target.value as 'tous' | 'lu' | 'non_lu')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="tous">Tous</option>
            <option value="lu">Lus</option>
            <option value="non_lu">Non lus</option>
          </select>
          {tousLesTags.length > 0 && (
            <select
              value={filtreTag} onChange={(e) => setFiltreTag(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous les tags</option>
              {tousLesTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Liste */}
      <div className="space-y-3">
        {articlesFiltres.map((article) => (
          <div key={article.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <button
                      onClick={() => toggleLu(article)}
                      title={article.lu ? 'Marquer non lu' : 'Marquer lu'}
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                        article.lu ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                      }`}
                    />
                    <span className={`text-sm font-medium leading-snug ${article.lu ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {article.titre}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-7">
                    {article.auteurs?.join(', ')}{article.annee ? ` · ${article.annee}` : ''}
                    {article.doi ? ` · ${article.doi}` : ''}
                  </p>
                  {article.abstract && (
                    <p className="text-xs text-gray-500 ml-7 mt-1 line-clamp-2 leading-relaxed">{article.abstract}</p>
                  )}
                  {(article.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 ml-7">
                      {article.tags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() => setFiltreTag(filtreTag === tag ? '' : tag)}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                            filtreTag === tag ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                          }`}
                        >
                          <Tag className="w-3 h-3" />{tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {(article.doi || article.url) && (
                    <a
                      href={article.url || `https://doi.org/${article.doi}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                      title="Consulter la publication"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => supprimerArticle(article.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === article.id ? null : article.id)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {expandedId === article.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {expandedId === article.id && (
              <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                {article.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                    <p className="text-sm text-gray-700">{article.notes}</p>
                  </div>
                )}
                {article.resume_ia ? (
                  <div className="bg-indigo-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-700">Résumé IA</span>
                    </div>
                    <p className="text-sm text-indigo-900 whitespace-pre-line">{article.resume_ia}</p>
                    <button
                      onClick={async () => {
                        await supabase.from('articles').update({ resume_ia: null }).eq('id', article.id);
                        loadArticles();
                      }}
                      className="text-xs text-indigo-400 hover:text-indigo-600 mt-2"
                    >
                      Régénérer
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">
                      {article.abstract
                        ? 'Générer un résumé IA à partir du résumé enregistré'
                        : 'Collez l\'abstract pour générer un résumé IA'}
                    </p>
                    {!article.abstract && (
                      <textarea
                        rows={2}
                        placeholder="Abstract ou contenu de l'article..."
                        value={contenuIA[article.id] ?? ''}
                        onChange={(e) => setContenuIA((prev) => ({ ...prev, [article.id]: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                      />
                    )}
                    <button
                      onClick={() => genererResume(article)}
                      disabled={chargementIA === article.id || (!article.abstract && !contenuIA[article.id]?.trim())}
                      className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {chargementIA === article.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {chargementIA === article.id ? 'Génération...' : 'Générer le résumé IA'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {articlesFiltres.length === 0 && articles.length > 0 && (
          <p className="text-center text-sm text-gray-400 py-8">Aucun article ne correspond aux filtres.</p>
        )}

        {articles.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Bibliothèque vide</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">
              Recherchez un article, importez via DOI ou collez du BibTeX — cliquez sur un résultat pour voir les détails avant d&apos;ajouter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
