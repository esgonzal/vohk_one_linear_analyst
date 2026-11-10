CREATE TABLE IF NOT EXISTS oauth_installation (
  organization_id TEXT PRIMARY KEY,
  app_user_id TEXT NOT NULL,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS oauth_state (
  state_hash TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  verifier_enc TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS chatgpt_credential (
  credential_id TEXT PRIMARY KEY DEFAULT 'primary',
  client_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  email TEXT,
  access_token_enc TEXT NOT NULL,
  refresh_token_enc TEXT NOT NULL,
  id_token_enc TEXT,
  granted_scope TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS agent_session (
  linear_session_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES oauth_installation(organization_id) ON DELETE CASCADE,
  codex_thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','awaiting_input','complete','error')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS webhook_event (
  webhook_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_event_due_idx ON webhook_event(status, next_attempt_at, created_at);
