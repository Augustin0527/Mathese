'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import type { Role } from '@/types';

function getErreurMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Cet email est déjà associé à un compte. Connectez-vous plutôt.';
    case 'auth/weak-password':
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    case 'auth/invalid-email':
      return 'Adresse email invalide.';
    case 'auth/network-request-failed':
      return 'Problème de connexion réseau. Réessayez.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez dans quelques minutes.';
    case 'timeout':
      return 'La connexion est lente. Votre compte a été créé — connectez-vous directement.';
    default:
      return 'Une erreur est survenue. Vérifiez vos informations.';
  }
}

// Timeout wrapper pour éviter que setDoc ne bloque à l'infini
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject({ code: 'timeout' }), ms)
    ),
  ]);
}

export default function InscriptionPage() {
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [role, setRole] = useState<Role>('etudiant');
  const [erreur, setErreur] = useState('');
  const [etape, setEtape] = useState<'formulaire' | 'chargement' | 'succes'>('formulaire');
  const [voirMdp, setVoirMdp] = useState(false);
  const [voirConfirmation, setVoirConfirmation] = useState(false);

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');

    // Validation mot de passe
    if (motDePasse !== confirmation) {
      setErreur('Les mots de passe ne correspondent pas.');
      return;
    }
    if (motDePasse.length < 6) {
      setErreur('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setEtape('chargement');
    try {
      // 1. Créer le compte Firebase Auth
      const { user } = await createUserWithEmailAndPassword(auth, email, motDePasse);

      // 2. Mettre à jour le display name
      await updateProfile(user, { displayName: `${prenom} ${nom}` });

      // 3. Créer le document Firestore avec timeout de 8 secondes
      //    Si ça timeout, le compte est quand même créé — l'utilisateur peut se connecter
      try {
        await withTimeout(
          setDoc(doc(db, 'utilisateurs', user.uid), {
            uid: user.uid,
            email,
            nom,
            prenom,
            role,
            profilComplet: false,
            createdAt: serverTimestamp(),
          }),
          8000
        );
      } catch (firestoreErr: unknown) {
        const fsCode = (firestoreErr as { code?: string })?.code ?? '';
        if (fsCode === 'timeout') {
          // setDoc a pris trop de temps, mais le compte Auth est créé
          // On redirige quand même — le profil Firestore sera créé à la prochaine connexion
          setEtape('succes');
          setTimeout(() => router.push('/connexion'), 1500);
          return;
        }
        throw firestoreErr; // Autre erreur Firestore → catch principal
      }

      setEtape('succes');
      setTimeout(() => {
        router.push(role === 'directeur' ? '/directeur' : '/etudiant');
      }, 1500);

    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      setErreur(getErreurMessage(code));
      setEtape('formulaire');
    }
  }

  if (etape === 'succes') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">Compte créé !</h2>
          <p className="text-gray-500 text-sm">Redirection vers votre espace...</p>
        </div>
      </div>
    );
  }

  const mdpOk = motDePasse.length >= 6;
  const confirmationOk = confirmation.length > 0 && motDePasse === confirmation;
  const confirmationErreur = confirmation.length > 0 && motDePasse !== confirmation;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">MaThèse</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-gray-500 mt-1">Commencez votre parcours doctoral</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleInscription} className="space-y-4">

            {/* Rôle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Je suis</label>
              <div className="grid grid-cols-2 gap-2">
                {(['etudiant', 'directeur'] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      role === r
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {r === 'etudiant' ? 'Étudiant·e' : 'Directeur·rice'}
                  </button>
                ))}
              </div>
            </div>

            {/* Prénom / Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="vous@exemple.com"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="relative">
                <input
                  type={voirMdp ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={(e) => setMotDePasse(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    motDePasse.length > 0 && !mdpOk ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="Minimum 6 caractères"
                />
                <button
                  type="button"
                  onClick={() => setVoirMdp(!voirMdp)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {voirMdp ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {motDePasse.length > 0 && !mdpOk && (
                <p className="text-xs text-red-500 mt-1">Minimum 6 caractères</p>
              )}
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={voirConfirmation ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                    confirmationErreur ? 'border-red-300' : confirmationOk ? 'border-green-400' : 'border-gray-200'
                  }`}
                  placeholder="Répétez votre mot de passe"
                />
                <button
                  type="button"
                  onClick={() => setVoirConfirmation(!voirConfirmation)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {voirConfirmation ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmationErreur && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
              )}
              {confirmationOk && (
                <p className="text-xs text-green-600 mt-1">✓ Mots de passe identiques</p>
              )}
            </div>

            {erreur && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                <span className="text-red-500 text-xs mt-0.5">⚠</span>
                <p className="text-sm text-red-700">{erreur}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={etape === 'chargement'}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {etape === 'chargement' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création du compte...
                </>
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Déjà inscrit ?{' '}
            <Link href="/connexion" className="text-indigo-600 font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
