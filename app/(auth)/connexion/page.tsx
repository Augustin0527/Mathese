'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function getErreurMessage(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email ou mot de passe incorrect.';
    case 'auth/invalid-email':
      return 'Adresse email invalide.';
    case 'auth/user-disabled':
      return 'Ce compte a été désactivé.';
    case 'auth/too-many-requests':
      return 'Trop de tentatives. Réessayez dans quelques minutes.';
    case 'auth/network-request-failed':
      return 'Problème de connexion réseau. Réessayez.';
    default:
      return 'Impossible de se connecter. Vérifiez vos identifiants.';
  }
}

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);
  const [resetEnvoi, setResetEnvoi] = useState(false);
  const [resetChargement, setResetChargement] = useState(false);

  async function handleConnexion(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, motDePasse);
      const snap = await getDoc(doc(db, 'utilisateurs', user.uid));
      const role = snap.exists() ? snap.data().role : 'etudiant';
      router.push(role === 'directeur' ? '/directeur' : '/etudiant');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? '';
      setErreur(getErreurMessage(code));
      setChargement(false);
    }
  }

  async function handleResetMotDePasse() {
    if (!email.trim()) {
      setErreur('Entrez votre email ci-dessus pour recevoir le lien de réinitialisation.');
      return;
    }
    setResetChargement(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEnvoi(true);
      setErreur('');
    } catch {
      setErreur('Impossible d\'envoyer le lien. Vérifiez l\'email saisi.');
    } finally {
      setResetChargement(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-gray-900 text-lg">MaThèse</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
          <p className="text-gray-500 mt-1">Bon retour sur MaThèse</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleConnexion} className="space-y-4">
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
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
                <button
                  type="button"
                  onClick={handleResetMotDePasse}
                  disabled={resetChargement}
                  className="text-xs text-indigo-500 hover:text-indigo-700 hover:underline disabled:opacity-50"
                >
                  {resetChargement ? 'Envoi...' : 'Mot de passe oublié ?'}
                </button>
              </div>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="••••••••"
              />
            </div>

            {resetEnvoi && (
              <div className="flex items-start gap-2 bg-green-50 border border-green-100 px-3 py-2.5 rounded-lg">
                <span className="text-green-600 text-xs mt-0.5">✓</span>
                <p className="text-sm text-green-700">
                  Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
                </p>
              </div>
            )}

            {erreur && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
                <span className="text-red-500 text-xs mt-0.5">⚠</span>
                <p className="text-sm text-red-700">{erreur}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60"
            >
              {chargement ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connexion en cours...
                </>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Pas encore de compte ?{' '}
            <Link href="/inscription" className="text-indigo-600 font-medium hover:underline">
              S&apos;inscrire gratuitement
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
