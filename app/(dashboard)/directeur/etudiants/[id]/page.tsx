'use client';

import { useState } from 'react';
import { ArrowLeft, Sparkles, Send, BookOpen, Target, Calendar } from 'lucide-react';
import Link from 'next/link';

export default function EtudiantDetailPage() {
  const [recommendation, setRecommendation] = useState('');
  const [typeRec, setTypeRec] = useState<'lecture' | 'methodologie' | 'redaction' | 'general'>('general');
  const [rapportIA, setRapportIA] = useState('');
  const [chargementRapport, setChargementRapport] = useState(false);

  async function genererRapport() {
    setChargementRapport(true);
    try {
      const res = await fetch('/api/ai/rapport-hebdomadaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nomEtudiant: 'Marie Dupont',
          journaux: [
            { date: '2026-03-16', accomplissements: 'Rédigé 500 mots sur la méthodologie', blocages: 'Difficulté avec la revue de littérature' },
            { date: '2026-03-15', accomplissements: 'Lu 3 articles recommandés' },
            { date: '2026-03-14', accomplissements: '2 sessions Pomodoro sur la bibliographie' },
          ],
        }),
      });
      const data = await res.json();
      setRapportIA(data.rapport);
    } catch {
      setRapportIA("Impossible de générer le rapport pour l'instant.");
    } finally {
      setChargementRapport(false);
    }
  }

  function envoyerRecommandation() {
    if (!recommendation.trim()) return;
    alert(`Recommandation envoyée à l'étudiant : "${recommendation}"`);
    setRecommendation('');
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/directeur" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </Link>

      {/* En-tête étudiant */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
            MD
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Marie Dupont</h1>
            <p className="text-sm text-gray-500">Doctorat en Sciences de gestion · 2ème année</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          <strong>Sujet :</strong> Impact des algorithmes de recommandation sur le comportement d&apos;achat
        </p>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { icon: Target, label: 'Objectifs', val: '3 / 7' },
            { icon: BookOpen, label: 'Articles lus', val: '12' },
            { icon: Calendar, label: 'Sessions cette semaine', val: '5' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
                <s.icon className="w-3.5 h-3.5" />
                <span className="text-xs">{s.label}</span>
              </div>
              <div className="font-bold text-gray-900 text-lg">{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Rapport IA hebdomadaire */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Rapport hebdomadaire IA</h2>
          <button
            onClick={genererRapport}
            disabled={chargementRapport}
            className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {chargementRapport ? 'Génération...' : 'Générer'}
          </button>
        </div>
        {rapportIA ? (
          <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-900 whitespace-pre-line">
            {rapportIA}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Cliquez sur &quot;Générer&quot; pour obtenir un résumé automatique de la semaine de l&apos;étudiant.</p>
        )}
      </div>

      {/* Envoyer une recommandation */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Envoyer une recommandation</h2>
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['general', 'lecture', 'methodologie', 'redaction'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeRec(t)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  typeRec === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t === 'general' ? 'Général' : t === 'lecture' ? 'Lecture' : t === 'methodologie' ? 'Méthodologie' : 'Rédaction'}
              </button>
            ))}
          </div>
          <textarea
            value={recommendation}
            onChange={(e) => setRecommendation(e.target.value)}
            rows={3}
            placeholder="Votre recommandation pour l'étudiant..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={envoyerRecommandation}
            disabled={!recommendation.trim()}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
