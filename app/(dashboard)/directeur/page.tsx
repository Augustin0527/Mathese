'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Users, MessageSquare, TrendingUp, Bell, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface EtudiantSuivi {
  id: string;
  nom: string;
  prenom: string;
  sujetRecherche?: string;
  derniereActivite?: string;
  progressionObjectifs: { complets: number; total: number };
}

function joursDepuis(dateStr: string | undefined) {
  if (!dateStr) return 'Jamais';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Hier';
  return `Il y a ${diff} jours`;
}

function alerteActivite(dateStr: string | undefined): string | undefined {
  if (!dateStr) return 'Aucune activité enregistrée';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff >= 7) return `Inactif depuis ${diff} jours`;
  return undefined;
}

export default function DirecteurDashboard() {
  const { user } = useAuth();
  const [etudiants, setEtudiants] = useState<EtudiantSuivi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    chargerEtudiants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function chargerEtudiants() {
    if (!user) return;
    setLoading(true);
    try {
      // Récupérer les étudiants assignés à ce directeur
      const { data: etudiants_data, error } = await supabase
        .from('utilisateurs')
        .select('id, nom, prenom, sujet_recherche')
        .eq('directeur_id', user.id);

      if (error) throw error;
      if (!etudiants_data) { setEtudiants([]); return; }

      const resultats: EtudiantSuivi[] = await Promise.all(
        etudiants_data.map(async (e) => {
          // Objectifs
          const { data: objData } = await supabase
            .from('objectifs')
            .select('statut')
            .eq('user_id', e.id);
          const total = objData?.length ?? 0;
          const complets = objData?.filter((o) => o.statut === 'complete').length ?? 0;

          // Dernière activité journal
          const { data: journalData } = await supabase
            .from('journal')
            .select('date')
            .eq('user_id', e.id)
            .order('date', { ascending: false })
            .limit(1);
          const derniereActivite = journalData?.[0]?.date ?? undefined;

          return {
            id: e.id,
            nom: e.nom ?? '',
            prenom: e.prenom ?? '',
            sujetRecherche: e.sujet_recherche,
            derniereActivite,
            progressionObjectifs: { complets, total },
          };
        })
      );

      setEtudiants(resultats);
    } catch (err) {
      console.error('[Directeur] chargerEtudiants error:', err);
    } finally {
      setLoading(false);
    }
  }

  const nbAlertes = etudiants.filter((e) => alerteActivite(e.derniereActivite)).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord — Direction</h1>
        <p className="text-gray-500 mt-1">
          {etudiants.length} étudiant{etudiants.length > 1 ? 's' : ''} suivi{etudiants.length > 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Étudiants actifs', value: etudiants.length - nbAlertes, icon: Users, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Alertes inactivité', value: nbAlertes, icon: Bell, color: 'text-orange-500 bg-orange-50' },
          { label: 'Total suivis', value: etudiants.length, icon: MessageSquare, color: 'text-purple-600 bg-purple-50' },
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

        {etudiants.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 shadow-sm">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Aucun étudiant assigné pour l&apos;instant.</p>
            <p className="text-xs mt-1">Les étudiants apparaissent ici une fois qu&apos;ils vous ont désigné comme directeur dans leur profil.</p>
          </div>
        ) : (
          etudiants.map((etudiant) => {
            const pct = etudiant.progressionObjectifs.total > 0
              ? Math.round((etudiant.progressionObjectifs.complets / etudiant.progressionObjectifs.total) * 100)
              : 0;
            const alerte = alerteActivite(etudiant.derniereActivite);
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
                      {alerte && (
                        <span className="flex items-center gap-1 text-xs text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" />
                          {alerte}
                        </span>
                      )}
                    </div>
                    {etudiant.sujetRecherche && (
                      <p className="text-sm text-gray-500 ml-10 mb-3 line-clamp-1">{etudiant.sujetRecherche}</p>
                    )}

                    <div className="flex items-center gap-4 ml-10">
                      {etudiant.progressionObjectifs.total > 0 && (
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
                      )}

                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <TrendingUp className="w-3 h-3" />
                        {joursDepuis(etudiant.derniereActivite)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors ml-3 mt-1 flex-shrink-0" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
