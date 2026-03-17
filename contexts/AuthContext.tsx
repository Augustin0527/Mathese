'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';

export interface UserProfile {
  uid: string;
  email: string;
  role: 'etudiant' | 'directeur';
  nom: string;
  prenom: string;
  pseudo?: string;
  photoURL?: string;
  niveau?: 'Master' | 'Doctorat' | 'Post-doctorat' | 'Chercheur';
  institution?: string;
  sujetRecherche?: string;
  directeurId?: string;
  codirecteurId?: string;
  pairs?: string[];
  profilComplet?: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(uid: string) {
    try {
      const snap = await getDoc(doc(db, 'utilisateurs', uid));
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function refreshProfile() {
    if (user) await fetchProfile(user.uid);
  }

  async function signOut() {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
