'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // On ne redirige que si le chargement est terminé ET l'utilisateur n'est pas connecté
    // On ajoute un délai court pour éviter les faux positifs (ex: juste après inscription)
    if (!loading && !user) {
      redirectTimer.current = setTimeout(() => {
        router.replace('/connexion');
      }, 200);
    }
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    };
  }, [user, loading, router]);

  // Afficher le spinner pendant le chargement auth
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
