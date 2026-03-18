'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BookOpen,
  Timer,
  Target,
  FileText,
  Calendar,
  Users,
  MessageSquare,
  LogOut,
  GraduationCap,
  UserCircle,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ETUDIANT = [
  { href: '/etudiant', icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/etudiant/bibliotheque', icon: BookOpen, label: 'Bibliothèque' },
  { href: '/etudiant/pomodoro', icon: Timer, label: 'Pomodoro' },
  { href: '/etudiant/planning', icon: Target, label: 'Planning' },
  { href: '/etudiant/chapitres', icon: FileText, label: 'Chapitres' },
  { href: '/etudiant/journal', icon: Calendar, label: 'Journal' },
  { href: '/etudiant/recherche', icon: Sparkles, label: 'Recherche IA' },
];

const NAV_DIRECTEUR = [
  { href: '/directeur', icon: LayoutDashboard, label: 'Tableau de bord' },
  { href: '/directeur/etudiants', icon: Users, label: 'Mes étudiants' },
  { href: '/directeur/recommandations', icon: MessageSquare, label: 'Recommandations' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const isDirecteur = pathname.startsWith('/directeur');
  const nav = isDirecteur ? NAV_DIRECTEUR : NAV_ETUDIANT;

  const displayName = profile
    ? `${profile.prenom} ${profile.nom}`.trim()
    : 'Utilisateur';
  const initiale = displayName.charAt(0).toUpperCase();
  const roleLabel = profile?.role === 'directeur' ? 'Directeur·rice' : 'Étudiant·e';
  const niveauLabel = profile?.niveau ?? '';

  async function handleSignOut() {
    await signOut();
    router.push('/connexion');
  }

  return (
    <aside className="w-56 bg-white border-r border-gray-100 flex flex-col h-full flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-base">MaThèse</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
          {isDirecteur ? 'Direction' : 'Étudiant'}
        </p>
        {nav.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/etudiant' &&
              item.href !== '/directeur' &&
              pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon
                className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-gray-400'}`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-gray-100">
        <Link
          href="/profil"
          className="flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          {profile?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photoURL}
              alt="avatar"
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-xs flex-shrink-0">
              {initiale}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-900 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">
              {niveauLabel || roleLabel}
            </p>
          </div>
          <UserCircle className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-400 flex-shrink-0" />
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-3 py-2 w-full rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
