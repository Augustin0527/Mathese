'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, ChevronDown, Trash2, Loader2 } from 'lucide-react';

type Statut = 'a_faire' | 'en_cours' | 'complete' | 'reporte';
type Priorite = 'haute' | 'moyenne' | 'basse';

interface Objectif {
  id: string;
  titre: string;
  description?: string;
  date_echeance: string;
  statut: Statut;
  priorite: Priorite;
}

const STATUT_CONFIG: Record<Statut, { label: string; color: string; bg: string }> = {
  a_faire:  { label: 'À faire',  color: 'text-gray-500',  bg: 'bg-gray-100' },
  en_cours: { label: 'En cours', color: 'text-blue-600',  bg: 'bg-blue-50' },
  complete: { label: 'Complété', color: 'text-green-600', bg: 'bg-green-50' },
  reporte:  { label: 'Reporté',  color: 'text-orange-500',bg: 'bg-orange-50' },
};

const PRIORITE_CONFIG: Record<Priorite, { label: string; color: string }> = {
  haute:   { label: 'Haute',   color: 'text-red-500' },
  moyenne: { label: 'Moyenne', color: 'text-orange-400' },
  basse:   { label: 'Basse',   color: 'text-gray-400' },
};

function estEnRetard(dateStr: string, statut: Statut) {
  return statut !== 'complete' && new Date(dateStr) < new Date();
}

export default function PlanningPage() {
  const { user } = useAuth();
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filtreStatut, setFiltreStatut] = useState<Statut | 'tous'>('tous');

  const [titre, setTitre] = useState('');
  const [description, setDescription] = useState('');
  const [dateEcheance, setDateEcheance] = useState('');
  const [priorite, setPriorite] = useState<Priorite>('moyenne');

  async function loadObjectifs() {
    if (!user) return;
    const { data } = await supabase
      .from('objectifs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setObjectifs(data as Objectif[]);
    setLoading(false);
  }

  useEffect(() => {
    if (user) loadObjectifs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function ajouterObjectif() {
    if (!user || !titre.trim() || !dateEcheance) return;
    await supabase.from('objectifs').insert({
      user_id: user.id,
      titre,
      description,
      date_echeance: dateEcheance,
      statut: 'a_faire',
      priorite,
    });
    setTitre(''); setDescription(''); setDateEcheance(''); setPriorite('moyenne');
    setShowForm(false);
    loadObjectifs();
  }

  async function changerStatut(id: string, statut: Statut) {
    await supabase.from('objectifs').update({ statut }).eq('id', id);
    loadObjectifs();
  }

  async function supprimerObjectif(id: string) {
    await supabase.from('objectifs').delete().eq('id', id);
    loadObjectifs();
  }

  const stats = {
    total: objectifs.length,
    complets: objectifs.filter((o) => o.statut === 'complete').length,
    enRetard: objectifs.filter((o) => estEnRetard(o.date_echeance, o.statut)).length,
  };

  const objectifsFiltres = filtreStatut === 'tous'
    ? objectifs
    : objectifs.filter((o) => o.statut === filtreStatut);

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
          <h1 className="text-2xl font-bold text-gray-900">Planning & Objectifs</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {stats.complets}/{stats.total} complétés
            {stats.enRetard > 0 && <span className="text-red-500 ml-2">· {stats.enRetard} en retard</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel objectif
        </button>
      </div>

      {stats.total > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progression globale</span>
            <span className="text-sm font-bold text-indigo-600">
              {Math.round((stats.complets / stats.total) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${(stats.complets / stats.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Nouvel objectif</h2>
          <div className="space-y-3">
            <input
              type="text" value={titre} onChange={(e) => setTitre(e.target.value)}
              placeholder="Titre de l'objectif *"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <textarea
              value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="Description (optionnelle)"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Date d&apos;échéance *</label>
                <input
                  type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priorité</label>
                <select
                  value={priorite} onChange={(e) => setPriorite(e.target.value as Priorite)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="haute">Haute</option>
                  <option value="moyenne">Moyenne</option>
                  <option value="basse">Basse</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={ajouterObjectif}
              disabled={!titre.trim() || !dateEcheance}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Ajouter
            </button>
            <button onClick={() => setShowForm(false)} className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              Annuler
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        {(['tous', 'a_faire', 'en_cours', 'complete', 'reporte'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltreStatut(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtreStatut === f ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f === 'tous' ? 'Tous' : STATUT_CONFIG[f].label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {objectifsFiltres.map((objectif) => {
          const enRetard = estEnRetard(objectif.date_echeance, objectif.statut);
          const statutCfg = STATUT_CONFIG[objectif.statut];
          const prioriteCfg = PRIORITE_CONFIG[objectif.priorite];

          return (
            <div
              key={objectif.id}
              className={`bg-white border rounded-2xl p-4 shadow-sm transition-all ${enRetard ? 'border-red-200' : 'border-gray-100'}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => changerStatut(objectif.id, objectif.statut === 'complete' ? 'a_faire' : 'complete')}
                  className="mt-0.5 flex-shrink-0"
                >
                  {objectif.statut === 'complete'
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <Circle className="w-5 h-5 text-gray-300 hover:text-indigo-400 transition-colors" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${objectif.statut === 'complete' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {objectif.titre}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statutCfg.bg} ${statutCfg.color}`}>
                      {statutCfg.label}
                    </span>
                  </div>
                  {objectif.description && (
                    <p className="text-xs text-gray-400 mt-1">{objectif.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <div className={`flex items-center gap-1 text-xs ${enRetard ? 'text-red-500' : 'text-gray-400'}`}>
                      {enRetard ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {new Date(objectif.date_echeance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {enRetard && ' — En retard'}
                    </div>
                    <span className={`text-xs font-medium ${prioriteCfg.color}`}>● {prioriteCfg.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="relative">
                    <select
                      value={objectif.statut}
                      onChange={(e) => changerStatut(objectif.id, e.target.value as Statut)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none pr-6 cursor-pointer"
                    >
                      <option value="a_faire">À faire</option>
                      <option value="en_cours">En cours</option>
                      <option value="complete">Complété</option>
                      <option value="reporte">Reporté</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                  <button onClick={() => supprimerObjectif(objectif.id)} className="text-gray-300 hover:text-red-400 transition-colors p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {objectifsFiltres.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {filtreStatut === 'tous' ? "Aucun objectif pour l'instant" : `Aucun objectif "${STATUT_CONFIG[filtreStatut as Statut]?.label}"`}
            </p>
            {filtreStatut === 'tous' && (
              <p className="text-xs mt-1">Cliquez sur &ldquo;Nouvel objectif&rdquo; pour commencer</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
