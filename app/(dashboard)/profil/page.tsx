'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Camera, Save, UserPlus, Mail, Check, X, Loader2, AlertCircle } from 'lucide-react';

const NIVEAUX = ['Master', 'Doctorat', 'Post-doctorat', 'Chercheur'] as const;

interface Invitation {
  id: string;
  to_email: string;
  type: 'directeur' | 'codirecteur' | 'pair';
  status: 'en_attente' | 'acceptee' | 'refusee';
}

export default function ProfilPage() {
  const { user, profile, refreshProfile } = useAuth();

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [niveau, setNiveau] = useState<typeof NIVEAUX[number] | ''>('');
  const [institution, setInstitution] = useState('');
  const [sujetRecherche, setSujetRecherche] = useState('');
  const [photoURL, setPhotoURL] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [invitEmail, setInvitEmail] = useState('');
  const [invitType, setInvitType] = useState<'directeur' | 'codirecteur' | 'pair'>('directeur');
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [envoi, setEnvoi] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile) {
      setNom(profile.nom ?? '');
      setPrenom(profile.prenom ?? '');
      setPseudo(profile.pseudo ?? '');
      setNiveau((profile.niveau as typeof NIVEAUX[number]) ?? '');
      setInstitution(profile.institution ?? '');
      setSujetRecherche(profile.sujet_recherche ?? '');
      setPhotoURL(profile.photo_url ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (user) loadInvitations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadInvitations() {
    if (!user) return;
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('from_uid', user.id);
    if (data) setInvitations(data as Invitation[]);
  }

  async function uploadPhoto(file: File) {
    if (!user) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setPhotoURL(data.publicUrl);
    } catch (err) {
      console.error('[Profil] uploadPhoto error:', err);
      setSaveError('Erreur lors de l\'upload de la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function sauvegarder(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSaveError('');
    try {
      const { error } = await supabase
        .from('utilisateurs')
        .update({
          nom,
          prenom,
          pseudo,
          niveau: niveau || null,
          institution,
          sujet_recherche: sujetRecherche,
          photo_url: photoURL,
          profil_complet: true,
        })
        .eq('id', user.id);

      if (error) throw error;

      refreshProfile().catch(() => {});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'inconnue';
      setSaveError(`Erreur: ${msg}`);
    } finally {
      setSaving(false);
    }
  }

  async function envoyerInvitation(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !invitEmail.trim()) return;
    setEnvoi(true);
    try {
      await supabase.from('invitations').insert({
        from_uid: user.id,
        from_nom: `${prenom} ${nom}`.trim(),
        to_email: invitEmail.trim().toLowerCase(),
        type: invitType,
        status: 'en_attente',
      });
      setInvitEmail('');
      await loadInvitations();
    } finally {
      setEnvoi(false);
    }
  }

  const typeLabel = { directeur: 'Directeur·rice', codirecteur: 'Co-directeur·rice', pair: 'Pair·e' };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>

      {/* Photo */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Photo de profil</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            {photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoURL} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-2xl font-bold">
                {prenom.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 bg-black/30 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
          </div>
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 border border-gray-200 px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Camera className="w-4 h-4" />
              Changer la photo
            </button>
            <p className="text-xs text-gray-400 mt-1">JPG ou PNG, max 2 Mo</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPhoto(f);
            }}
          />
        </div>
      </div>

      {/* Informations */}
      <form onSubmit={sauvegarder} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Informations personnelles</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Prénom</label>
            <input
              type="text"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
            <input
              type="text"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pseudo (affiché dans le Pomodoro)</label>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="@votre_pseudo"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Niveau académique</label>
          <div className="grid grid-cols-4 gap-2">
            {NIVEAUX.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setNiveau(n)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                  niveau === n
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Institution / Université</label>
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Université de Montréal"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Sujet de recherche</label>
          <textarea
            value={sujetRecherche}
            onChange={(e) => setSujetRecherche(e.target.value)}
            rows={3}
            placeholder="Décrivez votre sujet de thèse ou de recherche..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-700">{saveError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <Check className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? 'Sauvegardé !' : 'Sauvegarder'}
        </button>
      </form>

      {/* Invitations */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Réseau de collaboration</h2>
        <p className="text-sm text-gray-500">
          Invitez votre directeur·rice, co-directeur·rice ou des pairs via leur adresse email.
        </p>

        <form onSubmit={envoyerInvitation} className="space-y-3">
          <div className="flex gap-2">
            <select
              value={invitType}
              onChange={(e) => setInvitType(e.target.value as 'directeur' | 'codirecteur' | 'pair')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="directeur">Directeur·rice</option>
              <option value="codirecteur">Co-directeur·rice</option>
              <option value="pair">Pair·e</option>
            </select>
            <input
              type="email"
              value={invitEmail}
              onChange={(e) => setInvitEmail(e.target.value)}
              required
              placeholder="email@institution.ca"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={envoi}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Inviter
            </button>
          </div>
        </form>

        {invitations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Invitations envoyées
            </p>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-sm"
              >
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="flex-1 text-gray-700 truncate">{inv.to_email}</span>
                <span className="text-xs text-gray-400">{typeLabel[inv.type]}</span>
                {inv.status === 'en_attente' ? (
                  <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
                    En attente
                  </span>
                ) : inv.status === 'acceptee' ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <X className="w-4 h-4 text-red-400" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
