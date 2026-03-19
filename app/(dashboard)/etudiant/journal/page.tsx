'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Plus, Smile, Meh, Frown, Laugh, AlertCircle, Loader2 } from 'lucide-react';

interface EntreeJournal {
  id: string;
  date: string;
  accomplissements: string;
  blocages: string;
  prochaine_priorite: string;
  humeur: 1 | 2 | 3 | 4 | 5;
  temps_pomodoro: number;
}

const HUMEURS = [
  { val: 1 as const, label: 'Difficile', icon: Frown, color: 'text-red-400' },
  { val: 2 as const, label: 'Moyen', icon: Meh, color: 'text-orange-400' },
  { val: 3 as const, label: 'Bien', icon: Smile, color: 'text-yellow-400' },
  { val: 4 as const, label: 'Très bien', icon: Laugh, color: 'text-green-400' },
  { val: 5 as const, label: 'Excellent', icon: Laugh, color: 'text-indigo-400' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function JournalPage() {
  const { user } = useAuth();
  const [entrees, setEntrees] = useState<EntreeJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [accomplissements, setAccomplissements] = useState('');
  const [blocages, setBlocages] = useState('');
  const [prochainePriorite, setProchainePriorite] = useState('');
  const [humeur, setHumeur] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tempsPomodoro, setTempsPomodoro] = useState(0);

  const aujourdhui = new Date().toISOString().split('T')[0];

  async function loadJournal() {
    if (!user) return;
    const { data } = await supabase
      .from('journal')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });
    if (data) setEntrees(data as EntreeJournal[]);
    setLoading(false);
  }

  useEffect(() => {
    if (user) loadJournal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const entreeAujourdhui = entrees.find((e) => e.date === aujourdhui);

  async function enregistrer() {
    if (!user || !accomplissements.trim()) return;
    setSaving(true);
    try {
      if (entreeAujourdhui) {
        await supabase.from('journal').update({
          accomplissements, blocages, prochaine_priorite: prochainePriorite, humeur, temps_pomodoro: tempsPomodoro,
        }).eq('id', entreeAujourdhui.id);
      } else {
        await supabase.from('journal').insert({
          user_id: user.id,
          date: aujourdhui,
          accomplissements,
          blocages,
          prochaine_priorite: prochainePriorite,
          humeur,
          temps_pomodoro: tempsPomodoro,
        });
      }
      setAccomplissements(''); setBlocages(''); setProchainePriorite('');
      setHumeur(3); setTempsPomodoro(0);
      setShowForm(false);
      loadJournal();
    } finally {
      setSaving(false);
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">Suivi quotidien de votre progression</p>
        </div>
        {!entreeAujourdhui && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Bilan du jour
          </button>
        )}
      </div>

      {(showForm || (!entreeAujourdhui && entrees.length === 0)) && (
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-1">Bilan du {formatDate(aujourdhui)}</h2>
          <p className="text-sm text-gray-400 mb-4">Prenez 5 minutes pour faire le point</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Qu&apos;avez-vous accompli aujourd&apos;hui ? *
              </label>
              <textarea
                value={accomplissements}
                onChange={(e) => setAccomplissements(e.target.value)}
                rows={3}
                placeholder="Décrivez vos avancées concrètes..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Blocages ou difficultés rencontrées</label>
              <textarea
                value={blocages}
                onChange={(e) => setBlocages(e.target.value)}
                rows={2}
                placeholder="Qu'est-ce qui vous a freiné ?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorité pour demain</label>
              <input
                type="text"
                value={prochainePriorite}
                onChange={(e) => setProchainePriorite(e.target.value)}
                placeholder="La chose la plus importante à faire demain..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Humeur du jour</label>
              <div className="flex gap-3">
                {HUMEURS.map((h) => (
                  <button
                    key={h.val}
                    onClick={() => setHumeur(h.val)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                      humeur === h.val ? 'bg-indigo-50 ring-2 ring-indigo-400' : 'hover:bg-gray-50'
                    }`}
                  >
                    <h.icon className={`w-6 h-6 ${h.color}`} />
                    <span className="text-xs text-gray-500">{h.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Temps de travail (minutes Pomodoro)</label>
              <input
                type="number"
                value={tempsPomodoro}
                onChange={(e) => setTempsPomodoro(Number(e.target.value))}
                min={0}
                step={25}
                className="w-32 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-5">
            <button
              onClick={enregistrer}
              disabled={!accomplissements.trim() || saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {entreeAujourdhui && !showForm && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <Smile className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">Bilan du jour enregistré ✓</p>
              <p className="text-xs text-green-600">{entreeAujourdhui.accomplissements.slice(0, 60)}{entreeAujourdhui.accomplissements.length > 60 ? '…' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setAccomplissements(entreeAujourdhui.accomplissements);
              setBlocages(entreeAujourdhui.blocages);
              setProchainePriorite(entreeAujourdhui.prochaine_priorite);
              setHumeur(entreeAujourdhui.humeur);
              setTempsPomodoro(entreeAujourdhui.temps_pomodoro);
              setShowForm(true);
            }}
            className="text-xs text-green-600 hover:text-green-800 underline flex-shrink-0"
          >
            Modifier
          </button>
        </div>
      )}

      <div className="space-y-4">
        {entrees.length > 0 && (
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Historique</h2>
        )}
        {entrees.map((entree) => {
          const humeurData = HUMEURS.find((h) => h.val === entree.humeur)!;
          return (
            <div key={entree.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{formatDate(entree.date)}</span>
                </div>
                <div className="flex items-center gap-2">
                  {entree.temps_pomodoro > 0 && (
                    <span className="text-xs text-gray-400">{entree.temps_pomodoro} min</span>
                  )}
                  <humeurData.icon className={`w-5 h-5 ${humeurData.color}`} />
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Accomplissements</p>
                  <p className="text-sm text-gray-700">{entree.accomplissements}</p>
                </div>
                {entree.blocages && (
                  <div className="flex gap-2 bg-orange-50 rounded-lg p-2">
                    <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-orange-700">{entree.blocages}</p>
                  </div>
                )}
                {entree.prochaine_priorite && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Priorité demain</p>
                    <p className="text-sm text-indigo-600 font-medium">→ {entree.prochaine_priorite}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {entrees.length === 0 && !showForm && (
          <div className="text-center py-16 text-gray-400">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune entrée pour l&apos;instant</p>
            <p className="text-xs mt-1">Commencez votre premier bilan du jour</p>
          </div>
        )}
      </div>
    </div>
  );
}
