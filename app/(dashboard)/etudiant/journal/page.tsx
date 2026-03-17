'use client';

import { useState } from 'react';
import { Calendar, Plus, Smile, Meh, Frown, Laugh, AlertCircle } from 'lucide-react';

interface EntreeJournal {
  id: string;
  date: string;
  accomplissements: string;
  blocages: string;
  prochainePrioritee: string;
  humeur: 1 | 2 | 3 | 4 | 5;
  tempsPomodoro: number;
}

const HUMEURS = [
  { val: 1 as const, label: 'Difficile', icon: Frown, color: 'text-red-400' },
  { val: 2 as const, label: 'Moyen', icon: Meh, color: 'text-orange-400' },
  { val: 3 as const, label: 'Bien', icon: Smile, color: 'text-yellow-400' },
  { val: 4 as const, label: 'Très bien', icon: Laugh, color: 'text-green-400' },
  { val: 5 as const, label: 'Excellent', icon: Laugh, color: 'text-indigo-400' },
];

const ENTREES_DEMO: EntreeJournal[] = [
  {
    id: '1',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    accomplissements: 'Relu 3 articles sur les méthodes qualitatives. Rédigé 500 mots sur la méthodologie.',
    blocages: 'Difficulté à structurer la revue de littérature.',
    prochainePrioritee: 'Finir la section 1.2 de la revue de littérature.',
    humeur: 3,
    tempsPomodoro: 100,
  },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function JournalPage() {
  const [entrees, setEntrees] = useState<EntreeJournal[]>(ENTREES_DEMO);
  const [showForm, setShowForm] = useState(false);

  const [accomplissements, setAccomplissements] = useState('');
  const [blocages, setBlocages] = useState('');
  const [prochainePrioritee, setProchainePrioritee] = useState('');
  const [humeur, setHumeur] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tempsPomodoro, setTempsPomodoro] = useState(0);

  const aujourdhui = new Date().toISOString().split('T')[0];
  const entreeAujourdhui = entrees.find((e) => e.date === aujourdhui);

  function enregistrer() {
    if (!accomplissements.trim()) return;
    const nouvelle: EntreeJournal = {
      id: Date.now().toString(),
      date: aujourdhui,
      accomplissements,
      blocages,
      prochainePrioritee,
      humeur,
      tempsPomodoro,
    };
    setEntrees([nouvelle, ...entrees.filter((e) => e.date !== aujourdhui)]);
    setAccomplissements(''); setBlocages(''); setProchainePrioritee('');
    setHumeur(3); setTempsPomodoro(0);
    setShowForm(false);
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal de bord</h1>
          <p className="text-gray-500 text-sm mt-0.5">Suivi quotidien de votre progression</p>
        </div>
        {!entreeAujourdhui && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Bilan du jour
          </button>
        )}
      </div>

      {/* Formulaire du jour */}
      {(showForm || (!entreeAujourdhui && entrees.length === 0)) && (
        <div className="bg-white border border-indigo-100 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-1">
            Bilan du {formatDate(aujourdhui)}
          </h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Blocages ou difficultés rencontrées
              </label>
              <textarea
                value={blocages}
                onChange={(e) => setBlocages(e.target.value)}
                rows={2}
                placeholder="Qu'est-ce qui vous a freiné ?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorité pour demain
              </label>
              <input
                type="text"
                value={prochainePrioritee}
                onChange={(e) => setProchainePrioritee(e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temps de travail (minutes Pomodoro)
              </label>
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
              disabled={!accomplissements.trim()}
              className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
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

      {/* Entrée du jour déjà faite */}
      {entreeAujourdhui && !showForm && (
        <div className="bg-green-50 border border-green-100 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <Smile className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-800">Bilan du jour enregistré ✓</p>
            <p className="text-xs text-green-600">{entreeAujourdhui.accomplissements.slice(0, 60)}…</p>
          </div>
        </div>
      )}

      {/* Historique */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Historique</h2>
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
                  {entree.tempsPomodoro > 0 && (
                    <span className="text-xs text-gray-400">{entree.tempsPomodoro} min</span>
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
                {entree.prochainePrioritee && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Priorité demain</p>
                    <p className="text-sm text-indigo-600 font-medium">→ {entree.prochainePrioritee}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
