-- ============================================================
-- MaThèse — Schéma Supabase (PostgreSQL)
-- Coller ce script dans : Supabase Dashboard > SQL Editor > New query > Run
-- ============================================================

-- Extension pour générer des UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- TABLE: utilisateurs
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS utilisateurs (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  nom          TEXT DEFAULT '',
  prenom       TEXT DEFAULT '',
  pseudo       TEXT,
  role         TEXT NOT NULL DEFAULT 'etudiant' CHECK (role IN ('etudiant', 'directeur')),
  photo_url    TEXT,
  niveau       TEXT CHECK (niveau IN ('Master', 'Doctorat', 'Post-doctorat', 'Chercheur')),
  institution  TEXT,
  sujet_recherche TEXT,
  directeur_id UUID REFERENCES utilisateurs(id),
  profil_complet BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: chapitres
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapitres (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  statut        TEXT NOT NULL DEFAULT 'a_rediger' CHECK (statut IN ('a_rediger', 'brouillon', 'revision', 'finalise')),
  ordre         INT DEFAULT 0,
  nombre_mots   INT DEFAULT 0,
  objectif_mots INT DEFAULT 5000,
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: journal
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  accomplissements    TEXT DEFAULT '',
  blocages            TEXT DEFAULT '',
  prochaine_priorite  TEXT DEFAULT '',
  humeur              INT DEFAULT 3,
  temps_pomodoro      INT DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ----------------------------------------------------------------
-- TABLE: objectifs (planning)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS objectifs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre          TEXT NOT NULL,
  description    TEXT DEFAULT '',
  date_echeance  DATE,
  statut         TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'en_cours', 'complete', 'reporte')),
  priorite       TEXT NOT NULL DEFAULT 'moyenne' CHECK (priorite IN ('basse', 'moyenne', 'haute')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: articles (bibliothèque)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS articles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  titre      TEXT NOT NULL,
  auteurs    TEXT[] DEFAULT '{}',
  annee      INT,
  doi        TEXT,
  url        TEXT,
  notes      TEXT DEFAULT '',
  tags       TEXT[] DEFAULT '{}',
  resume_ia  TEXT,
  lu         BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: invitations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_uid   UUID NOT NULL REFERENCES utilisateurs(id),
  from_nom   TEXT DEFAULT '',
  to_email   TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('directeur', 'codirecteur', 'pair')),
  status     TEXT NOT NULL DEFAULT 'en_attente' CHECK (status IN ('en_attente', 'acceptee', 'refusee')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- TABLE: pomodoro_participants (présence en temps réel)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pomodoro_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid          UUID NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  display_name TEXT DEFAULT '',
  objectif     TEXT DEFAULT '',
  joined_cycle INT DEFAULT 0,
  cycle_count  INT DEFAULT 0,
  last_active  BIGINT DEFAULT 0,
  bilan        TEXT,
  continuer    BOOLEAN DEFAULT TRUE,
  UNIQUE(uid)
);

-- ----------------------------------------------------------------
-- TABLE: pomodoro_chat (chat en temps réel)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pomodoro_chat (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uid          TEXT,
  display_name TEXT DEFAULT '',
  texte        TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- Chaque utilisateur ne voit que ses propres données
-- ================================================================

ALTER TABLE utilisateurs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapitres          ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal            ENABLE ROW LEVEL SECURITY;
ALTER TABLE objectifs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE pomodoro_chat         ENABLE ROW LEVEL SECURITY;

-- utilisateurs : lecture publique des profils, écriture de son propre profil
CREATE POLICY "Lecture profil" ON utilisateurs FOR SELECT USING (true);
CREATE POLICY "Écriture profil" ON utilisateurs FOR ALL USING (auth.uid() = id);

-- chapitres
CREATE POLICY "Chapitres owner" ON chapitres FOR ALL USING (auth.uid() = user_id);

-- journal
CREATE POLICY "Journal owner" ON journal FOR ALL USING (auth.uid() = user_id);

-- objectifs
CREATE POLICY "Objectifs owner" ON objectifs FOR ALL USING (auth.uid() = user_id);

-- articles
CREATE POLICY "Articles owner" ON articles FOR ALL USING (auth.uid() = user_id);

-- invitations
CREATE POLICY "Invitations expéditeur" ON invitations FOR ALL USING (auth.uid() = from_uid);
CREATE POLICY "Invitations destinataire" ON invitations FOR SELECT
  USING (to_email = (SELECT email FROM utilisateurs WHERE id = auth.uid()));

-- pomodoro_participants : tout le monde peut lire, owner peut écrire
CREATE POLICY "Pomodoro participants read" ON pomodoro_participants FOR SELECT USING (true);
CREATE POLICY "Pomodoro participants write" ON pomodoro_participants FOR ALL USING (auth.uid() = uid);

-- pomodoro_chat : tout le monde peut lire et écrire (collaboratif)
CREATE POLICY "Pomodoro chat read" ON pomodoro_chat FOR SELECT USING (true);
CREATE POLICY "Pomodoro chat insert" ON pomodoro_chat FOR INSERT WITH CHECK (true);

-- ================================================================
-- REALTIME (activer pour le Pomodoro)
-- ================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE pomodoro_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE pomodoro_chat;
