'use client';

import { Users, MessageSquare, TrendingUp, Bell, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface EtudiantSuivi {
  id: string;
  nom: string;
  prenom: string;
  sujetThese: string;
  derniereActivite: string;
  progressionObjectifs: { complets: number; total: number };
  sessionsPomodoro: number;
  alerte?: string;
}

const ETUDIANTS_DEMO: EtudiantSuivi[] = [
  {
    id: '1',
    nom: 'Dupont',
    prenom: 'Marie',
    sujetThese: 'Impact des algorithmes de recommandation sur le comportement d\'achat',
    derniereActivite: '2026-03-16',
    progressionObjectifs: { complets: 3, total: 7 },
    sessionsPomodoro: 12,
  },
  {
    id: '2',
    nom: 'Traoré',
    prenom: 'Ibrahima',
    sujetThese: 'Modélisation des flux migratoires en Afrique subsaharienne',
    derniereActivite: '2026-03-10',
    progressionObjectifs: { complets: 1, total: 5 },
    sessionsPomodoro: 3,
    alerte: 'Inactif depuis 7 jours',
  },
];

function joursDepuis(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return `Il y a ${diff} jours`;
}

export default function DirecteurDashboard() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord — Direction</h1>
        <p className="text-gray-500 mt-1">{ETUDIANTS_DEMO.length} étudiant{ETUDIANTS_DEMO.length > 1 ? 's' : ''} suivi{ETUDIANTS_DEMO.length > 1 ? 's' : ''}</p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Étudiants actifs', value: ETUDIANTS_DEMO.filter(e => !e.alerte).length, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Alertes en attente', value: ETUDIANTS_DEMO.filter(e => e.alerte).length, icon: Bell, color: 'text-orange-500 bg-orange-50' },
          { label: 'Feedbacks à donner', value: 2, icon: MessageSquare, color: 'text-purple-600 bg-purple-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Liste des étudiants */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Mes étudiants</h2>
        {ETUDIANTS_DEMO.map((etudiant) => {
          const pct = Math.round((etudiant.progressionObjectifs.complets / etudiant.progressionObjectifs.total) * 100);
          return (
            <Link
              key={etudiant.id}
              href={`/directeur/etudiants/${etudiant.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm flex-shrink-0">
                      {etudiant.prenom[0]}{etudiant.nom[0]}
                    </div>
                    <span className="font-semibold text-gray-900">
                      {etudiant.prenom} {etudiant.nom}
                    </span>
                    {etudiant.alerte && (
                      <span className="flex items-center gap-1 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        {etudiant.alerte}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 ml-10 mb-3 line-clamp-1">{etudiant.sujetThese}</p>

                  <div className="flex items-center gap-4 ml-10">
                    {/* Progression */}
                    <div className="flex-1 max-w-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Objectifs</span>
                        <span className="text-xs font-medium text-gray-600">
                          {etudiant.progressionObjectifs.complets}/{etudiant.progressionObjectifs.total}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-indigo-500' : 'bg-orange-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <TrendingUp className="w-3 h-3" />
                      {etudiant.sessionsPomodoro} sessions
                    </div>

                    <div className="text-xs text-gray-400">
                      {joursDepuis(etudiant.derniereActivite)}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors ml-3 mt-1 flex-shrink-0" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
