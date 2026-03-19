'use client';

import { BookOpen, Timer, Target, FileText, TrendingUp, Calendar, Presentation } from 'lucide-react';
import Link from 'next/link';

const modules = [
  { href: '/etudiant/bibliotheque', icon: BookOpen, label: 'Bibliothèque', desc: 'Articles & lectures', color: 'bg-blue-50 text-blue-600' },
  { href: '/etudiant/pomodoro', icon: Timer, label: 'Pomodoro', desc: 'Session de travail', color: 'bg-orange-50 text-orange-600' },
  { href: '/etudiant/planning', icon: Target, label: 'Planning', desc: 'Objectifs & étapes', color: 'bg-green-50 text-green-600' },
  { href: '/etudiant/chapitres', icon: FileText, label: 'Chapitres', desc: 'Rédaction & feedback', color: 'bg-purple-50 text-purple-600' },
  { href: '/etudiant/journal', icon: Calendar, label: 'Journal', desc: 'Bilan quotidien', color: 'bg-pink-50 text-pink-600' },
  { href: '/etudiant/communication', icon: Presentation, label: 'Communication', desc: 'Préparer une présentation', color: 'bg-violet-50 text-violet-600' },
];

export default function EtudiantDashboard() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour 👋</h1>
        <p className="text-gray-500 mt-1">Tableau de bord de votre thèse</p>
      </div>

      {/* Progression rapide */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Sessions aujourd\'hui', value: '0' },
          { label: 'Articles lus', value: '0' },
          { label: 'Objectifs complétés', value: '0 / 0' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Modules */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {modules.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow group"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${m.color}`}>
              <m.icon className="w-5 h-5" />
            </div>
            <div className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {m.label}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{m.desc}</div>
          </Link>
        ))}

        {/* Agent IA */}
        <Link href="/etudiant/recherche" className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white hover:from-indigo-700 hover:to-violet-700 transition-all group">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div className="font-semibold">Agent IA</div>
          <div className="text-xs text-indigo-200 mt-0.5">Recherche & discussion</div>
        </Link>
      </div>
    </div>
  );
}
