-- ─── Historique des conversations IA ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titre       TEXT        NOT NULL DEFAULT 'Nouvelle conversation',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_own" ON conversations
  FOR ALL USING (auth.uid() = user_id);

-- ─── Messages des conversations ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversation_messages (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id     UUID        REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role                TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content             TEXT        NOT NULL,
  propose_word        BOOLEAN     DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conv_messages_own" ON conversation_messages
  FOR ALL USING (
    auth.uid() = (SELECT user_id FROM conversations WHERE id = conversation_id)
  );

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_messages_conv_id ON conversation_messages (conversation_id, created_at ASC);
