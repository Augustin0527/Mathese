'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';
import type { Role } from '@/types';

export default function InscriptionPage() {
  const router = useRouter();
  const [prenom, setPrenom] = useState('');
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [role, setRole] = useState<Role>('etudiant');
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(false);

  async function handleInscription(e: React.FormEvent) {
    e.preventDefault();
    setErreur('');
    setChargement(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, motDePasse);
      await updateProfile(user, { displayName: `${prenom} ${nom}` });
      await setDoc(doc(db, 'utilisateurs', user.uid), {
        uid: user.uid,
        email,
        nom,
        prenom,
        role,
        createdAt: serverTimestamp(),
      });
      router.push(role === 'etudiant' ? '/etudiant' : '/directeur');
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('email-already-in-use')) {
        setErreur('Cet email est déjà utilisé.');
      } else {
        setErreur("Une erreur est survenue. Vérifiez vos informations.");
      }
    } finally {
      setChargement(false);
    }
  }

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="vous@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                required
                minLength={6}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Minimum 6 caractères"
              />
            </div>

            {erreur && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{erreur}</p>
            )}

            <button
              type="submit"
              disabled={chargement}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {chargement ? 'Création du compte...' : 'Créer mon compte'}
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
