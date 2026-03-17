// ============================================================
// TYPES PRINCIPAUX — mathese.sikaflow.org
// ============================================================

export type Role = 'etudiant' | 'directeur' | 'co-directeur';

export interface Utilisateur {
  uid: string;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  photoURL?: string;
  createdAt: Date;
}

export interface These {
  id: string;
  titre: string;
  sujet: string;
  etudiantId: string;
  directeurId: string;
  coDirecteurId?: string;
  dateDebut: Date;
  dateSoutenance?: Date;
  statut: 'en_cours' | 'suspendue' | 'soutenue';
  createdAt: Date;
}

export interface Chapitre {
  id: string;
  theseId: string;
  titre: string;
  ordre: number;
  statut: 'non_commence' | 'en_cours' | 'brouillon' | 'soumis' | 'en_revision' | 'valide';
  contenu?: string;
  commentaires?: Commentaire[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Commentaire {
  id: string;
  auteurId: string;
  auteurNom: string;
  contenu: string;
  passage?: string; // texte cité
  resolu: boolean;
  createdAt: Date;
}

export interface Article {
  id: string;
  theseId: string;
  etudiantId: string;
  titre: string;
  auteurs: string[];
  annee: number;
  journal?: string;
  doi?: string;
  url?: string;
  resume?: string;
  resumeIA?: string; // résumé généré par Claude
  notes?: string;
  tags: string[];
  lu: boolean;
  createdAt: Date;
}

export interface SessionPomodoro {
  id: string;
  etudiantId: string;
  theseId: string;
  duree: number; // minutes
  objectifSession: string;
  bilanSession?: string;
  date: Date;
  terminee: boolean;
}

export interface Objectif {
  id: string;
  theseId: string;
  etudiantId: string;
  titre: string;
  description?: string;
  dateEcheance: Date;
  statut: 'a_faire' | 'en_cours' | 'complete' | 'reporte';
  priorite: 'haute' | 'moyenne' | 'basse';
  createdAt: Date;
}

export interface JournalEntry {
  id: string;
  etudiantId: string;
  theseId: string;
  date: Date;
  accomplissements: string;
  blocages?: string;
  prochainePrioritee?: string;
  humeur?: 1 | 2 | 3 | 4 | 5;
  tempsPomodoro?: number; // minutes totales
}

export interface Reunion {
  id: string;
  theseId: string;
  participants: string[]; // uids
  dateHeure: Date;
  duree: number; // minutes
  ordre_du_jour?: string;
  compte_rendu?: string;
  decisions?: string[];
  prochaine?: Date;
}

export interface Recommandation {
  id: string;
  theseId: string;
  directeurId: string;
  etudiantId: string;
  contenu: string;
  type: 'lecture' | 'methodologie' | 'redaction' | 'general';
  lue: boolean;
  createdAt: Date;
}
