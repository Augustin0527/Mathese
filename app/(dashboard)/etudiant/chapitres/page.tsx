'use client';

import { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, BookOpen, Trash2, ChevronDown, ChevronUp, Loader2, GripVertical } from 'lucide-react';

type StatutChapitre = 'a_rediger' | 'brouillon' | 'revision' | 'finalise';

interface Chapitre {
  id: string;
  titre: string;
  description?: string;
  statut: StatutChapitre;
  nombreMots?: number;
  objectifMots?: number;
  ordre: number;
  notes?: string;
  createdAt?: unknown;
}

const STATUT_CONFIG: Record<StatutChapitre, { label: string; color: string; bg: string; dot: string }> = {
  a_rediger: { label: 'À rédiger', color: 'text-gray-500', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  brouillon: { label: 'Brouillon', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-500' },
  revision: { label: 'En révision', color: 'text-orange-600', bg: 'bg-orange-50', dot: 'bg-orange-500' },
  finalise: { label: 'Finalisé', color: 'text-green-600', bg: 'bg-green-50', dot: 'bg-green-500' },
};

export default function ChapitresPage() {
  const { user } = useAuth();
  const [chapitres, setChapitres] = useState<Chapitre[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Formulaire
  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [objectifMots, setObjectifMots] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) return;
    const col = collection(db, 'utilisateurs', user.uid, 'chapitres');
    const q = query(col, orderBy('ordre', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setChapitres(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Chapitre, 'id'>) })));
      setLoading(false);
    });
    return unsub;
  }, [user]);

  function resetForm() {
    setTitre(''); setDescription(''); setObjectifMots(''); setNotes('');
    setShowForm(false);
  }

  async function ajouterChapitre() {
    if (!user || !titre.trim()) return;
    await addDoc(collection(db, 'utilisateurs', user.uid, 'chapitres'), {
      titre,
      description,
      statut: 'a_rediger' as StatutChapitre,
      nombreMots: 0,
      objectifMots: objectifMots ? Number(objectifMots) : null,
      notes,
      ordre: chapitres.length,
      createdAt: serverTimestamp(),
    });
    resetForm();
  }

  async function changerStatut(id: string, statut: StatutChapitre) {
    if (!user) return;
    await updateDoc(doc(db, 'utilisateurs', user.uid, 'chapitres', id), { statut });
  }

  async function mettreAJourMots(id: string, nombre: number) {
    if (!user) return;
    await updateDoc(doc(db, 'utilisateurs', user.uid, 'chapitres', id), { nombreMots: nombre });
  }

  async function supprimerChapitre(id: string) {
    if (!user) return;
    await deleteDoc(doc(db, 'utilisateurs', user.uid, 'chapitres', id));
  }

  const totalMots = chapitres.reduce((acc, c) => acc + (c.nombreMots ?? 0), 0);
  const totalObjectif = chapitres.reduce((acc, c) => acc + (c.objectifMots ?? 0), 0);
  const finalises = chapitres.filter((c) => c.statut === 'finalise').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Chapitres</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {finalises}/{chapitres.length} finalisé{finalises !== 1 ? 's' : ''}
            {totalObjectif > 0 && (
              <span className="ml-2">· {totalMots.toLocaleString('fr-FR')}/{totalObjectif.toLocaleString('fr-FR')} mots</span>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Ajouter un chapitre
        </button>
      </div>

      {/* Barre de progression globale */}
      {totalObjectif > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progression totale</span>
            <span className="text-sm font-bold text-indigo-600">
              {Math.min(100, Math.round((totalMots / totalObjectif) * 100))}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (totalMots / totalObjectif) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Formulaire d'ajout */}
      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Nouveau chapitre</h2>
          <div className="space-y-3">
            <input
              type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre du chapitre *"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="Description (optionnelle)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3">
              <input
                type="number" value={objectifMots} onChange={(e) => setObjectifMots(e.target.value)}
                placeholder="Objectif de mots (ex: 5000)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="Notes (plan, idées clés...)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={ajouterChapitre}
              disabled={!titre.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Ajouter
            </button>
            <button onClick={resetForm} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des chapitres */}
      <div className="space-y-3">
        {chapitres.map((ch, index) => {
          const cfg = STATUT_CONFIG[ch.statut];
          const pct = ch.objectifMots && ch.objectifMots > 0
            ? Math.min(100, Math.round(((ch.nombreMots ?? 0) / ch.objectifMots) * 100))
            : null;

          return (
            <div key={ch.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-1 text-gray-300 mt-0.5 flex-shrink-0">
                    <GripVertical className="w-4 h-4" />
                    <span className="text-xs font-medium text-gray-400">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{ch.titre}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {ch.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{ch.description}</p>
                    )}
                    {pct !== null && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">
                            {(ch.nombreMots ?? 0).toLocaleString('fr-FR')} / {ch.objectifMots!.toLocaleString('fr-FR')} mots
                          </span>
                          <span className="text-xs font-medium text-indigo-600">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <select
                      value={ch.statut}
                      onChange={(e) => changerStatut(ch.id, e.target.value as StatutChapitre)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    >
                      <option value="a_rediger">À rédiger</option>
                      <option value="brouillon">Brouillon</option>
                      <option value="revision">En révision</option>
                      <option value="finalise">Finalisé</option>
                    </select>
                    <button
                      onClick={() => supprimerChapitre(ch.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(expandedId === ch.id ? null : ch.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {expandedId === ch.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {expandedId === ch.id && (
                <div className="border-t border-gray-50 px-4 pb-4 pt-3 space-y-3">
                  {ch.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Notes / Plan</p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">{ch.notes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Nombre de mots rédigés</p>
                    <input
                      type="number"
                      defaultValue={ch.nombreMots ?? 0}
                      min={0}
                      onBlur={(e) => mettreAJourMots(ch.id, Number(e.target.value))}
                      className="w-36 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {chapitres.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun chapitre pour l&apos;instant</p>
            <p className="text-xs mt-1">Cliquez sur &ldquo;Ajouter un chapitre&rdquo; pour commencer</p>
          </div>
        )}
      </div>
    </div>
  );
}
