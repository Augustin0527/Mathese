'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  role: 'etudiant' | 'directeur';
  nom: string;
  prenom: string;
  pseudo?: string;
  photo_url?: string;
  niveau?: 'Master' | 'Doctorat' | 'Post-doctorat' | 'Chercheur';
  institution?: string;
  sujet_recherche?: string;
  directeur_id?: string;
  profil_complet?: boolean;
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
      const { data, error } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      if (error) {
        console.error('[AuthContext] fetchProfile error:', error.message);
        return;
      }
      if (data) setProfile(data as UserProfile);
    } catch (err) {
      console.error('[AuthContext] fetchProfile error:', err);
    }
  }

  useEffect(() => {
    // Récupérer la session existante
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) fetchProfile(session.user.id);
    });

    // Écouter les changements d'état d'authentification
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function refreshProfile() {
    if (user) await fetchProfile(user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
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
