'use client';

import { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy, deleteField,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Sparkles, BookOpen, Tag, ExternalLink, ChevronDown, ChevronUp, Trash2, Loader2 } from 'lucide-react';

interface Article {
  id: string;
  titre: string;
  auteurs: string;
  annee: string;
  doi?: string;
  url?: string;
  notes?: string;
  tags: string[];
  resumeIA?: string;
  lu: boolean;
  createdAt?: unknown;
}

export default function BibliothequePage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chargementIA, setChargementIA] = useState<string | null>(null);
  const [contenuIA, setContenuIA] = useState<Record<string, string>>({});

  // Formulaire
  const [titre, setTitre] = useState('');
  const [auteurs, setAuteurs] = useState('');
  const [annee, setAnnee] = useState('');
  const [doi, setDoi] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Charger articles depuis Firestore en temps réel
  useEffect(() => {
    if (!user) return;
    const col = collection(db, 'utilisateurs', user.uid, 'articles');
    const q = query(col, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setArticles(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Article, 'id'>) }))
      );
      setLoading(false);
    });
    return unsub;
  }, [user]);

  function resetForm() {
    setTitre(''); setAuteurs(''); setAnnee(''); setDoi('');
    setUrl(''); setNotes(''); setTagsInput('');
    setShowForm(false);
  }

  async function ajouterArticle() {
    if (!user || !titre.trim()) return;
    await addDoc(collection(db, 'utilisateurs', user.uid, 'articles'), {
      titre,
      auteurs,
      annee,
      doi,
      url,
      notes,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      lu: false,
      createdAt: serverTimestamp(),
    });
    resetForm();
  }

  async function toggleLu(article: Article) {
    if (!user) return;
    await updateDoc(doc(db, 'utilisateurs', user.uid, 'articles', article.id), {
      lu: !article.lu,
    });
  }

  async function supprimerArticle(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, 'utilisateurs', user.uid, 'articles', id));
  }

  async function genererResume(article: Article) {
    const contenu = contenuIA[article.id] ?? '';
    if (!contenu.trim()) return;
    setChargementIA(article.id);
    try {
      const res = await fetch('/api/ai/resume-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titre: article.titre, contenu }),
      });
      const data = await res.json();
      await updateDoc(doc(db, 'utilisateurs', user!.uid, 'articles', article.id), {
        resumeIA: data.resume,
      });
    } catch {
      alert('Erreur lors de la génération du résumé.');
    } finally {
      setChargementIA(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bibliothèque</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {articles.length} article{articles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un article
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Nouvel article</h2>
          <div className="space-y-3">
            <input
              type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de l'article *"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" value={auteurs} onChange={(e) => setAuteurs(e.target.value)}
                placeholder="Auteurs"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text" value={annee} onChange={(e) => setAnnee(e.target.value)}
                placeholder="Année"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" value={doi} onChange={(e) => setDoi(e.target.value)}
                placeholder="DOI (ex: 10.48550/arXiv...)"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="URL (optionnel)"
                className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <input
              type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              placeholder="Tags séparés par des virgules"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="Notes personnelles"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={ajouterArticle}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Ajouter
            </button>
            <button
              onClick={resetForm}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des articles */}
      <div className="space-y-3">
        {articles.map((article) => (
          <div key={article.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <button
                      onClick={() => toggleLu(article)}
                      title={article.lu ? 'Marquer non lu' : 'Marquer lu'}
                      className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-colors ${
                        article.lu ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'
                      }`}
                    />
                    <span className={`text-sm font-medium leading-snug ${article.lu ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {article.titre}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 ml-7">
                    {article.auteurs}{article.annee ? ` · ${article.annee}` : ''}
                  </p>
                  {article.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 ml-7">
                      {article.tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1 bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full">
                          <Tag className="w-3 h-3" />{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(article.doi || article.url) && (
                    <a
                      href={article.url || `https://doi.org/${article.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button
                    onClick={() => supprimerArticle(article.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors p-1"
                  >
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

                {article.resumeIA ? (
                  <div className="bg-indigo-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-700">Résumé IA</span>
                    </div>
                    <p className="text-sm text-indigo-900 whitespace-pre-line">{article.resumeIA}</p>
                    <button
                      onClick={() => updateDoc(doc(db, 'utilisateurs', user!.uid, 'articles', article.id), { resumeIA: deleteField() })}
                      className="text-xs text-indigo-400 hover:text-indigo-600 mt-2"
                    >
                      Régénérer
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-gray-400 mb-2">
                      Collez l&apos;abstract pour générer un résumé IA
                    </p>
                    <textarea
                      rows={2}
                      placeholder="Abstract ou contenu de l'article..."
                      value={contenuIA[article.id] ?? ''}
                      onChange={(e) =>
                        setContenuIA((prev) => ({ ...prev, [article.id]: e.target.value }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                    />
                    <button
                      onClick={() => genererResume(article)}
                      disabled={chargementIA === article.id || !contenuIA[article.id]?.trim()}
                      className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {chargementIA === article.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {chargementIA === article.id ? 'Génération...' : 'Générer le résumé IA'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {articles.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun article pour l&apos;instant</p>
            <p className="text-xs mt-1">Cliquez sur &ldquo;Ajouter un article&rdquo; pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}
