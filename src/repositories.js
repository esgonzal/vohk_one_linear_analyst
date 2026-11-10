import crypto from "node:crypto";

export class InstallationRepository {
  constructor(pool, credentials) { this.pool = pool; this.credentials = credentials; }
  async save(value) {
    await this.pool.query(`INSERT INTO oauth_installation(organization_id,app_user_id,access_token_enc,refresh_token_enc,scope,expires_at)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(organization_id) DO UPDATE SET app_user_id=EXCLUDED.app_user_id,
      access_token_enc=EXCLUDED.access_token_enc,refresh_token_enc=EXCLUDED.refresh_token_enc,scope=EXCLUDED.scope,
      expires_at=EXCLUDED.expires_at,updated_at=NOW()`, [value.organizationId, value.appUserId,
      this.credentials.encrypt(value.accessToken), this.credentials.encrypt(value.refreshToken), value.scope, value.expiresAt]);
  }
  async get(organizationId) {
    const { rows } = await this.pool.query("SELECT * FROM oauth_installation WHERE organization_id=$1", [organizationId]);
    const row = rows[0]; if (!row) return null;
    return { organizationId: row.organization_id, appUserId: row.app_user_id, accessToken: this.credentials.decrypt(row.access_token_enc),
      refreshToken: this.credentials.decrypt(row.refresh_token_enc), scope: row.scope, expiresAt: row.expires_at };
  }
}

export class OAuthStateRepository {
  constructor(pool, credentials) { this.pool = pool; this.credentials = credentials; }
  static hash(state) { return crypto.createHash("sha256").update(state).digest("hex"); }
  async create({ state, provider, verifier = null, ttlMinutes = 10 }) {
    await this.pool.query("INSERT INTO oauth_state(state_hash,provider,verifier_enc,expires_at) VALUES($1,$2,$3,NOW()+make_interval(mins => $4))",
      [OAuthStateRepository.hash(state), provider, verifier ? this.credentials.encrypt(verifier) : null, ttlMinutes]);
  }
  async consume(state, provider) {
    const { rows } = await this.pool.query("DELETE FROM oauth_state WHERE state_hash=$1 AND provider=$2 AND expires_at>NOW() RETURNING verifier_enc",
      [OAuthStateRepository.hash(state), provider]);
    return rows[0] ? { verifier: rows[0].verifier_enc ? this.credentials.decrypt(rows[0].verifier_enc) : null } : null;
  }
}

export class PgSessionStore {
  constructor(pool) { this.pool = pool; }
  async create(id, organizationId) { await this.pool.query("INSERT INTO agent_session(linear_session_id,organization_id) VALUES($1,$2) ON CONFLICT DO NOTHING", [id, organizationId]); }
  async get(id) { const { rows } = await this.pool.query("SELECT codex_thread_id FROM agent_session WHERE linear_session_id=$1", [id]); return rows[0]?.codex_thread_id ? { threadId: rows[0].codex_thread_id } : null; }
  async set(id, value) { await this.pool.query("UPDATE agent_session SET codex_thread_id=$2,updated_at=NOW() WHERE linear_session_id=$1", [id, value.threadId]); }
  async setStatus(id, status) { await this.pool.query("UPDATE agent_session SET status=$2,updated_at=NOW() WHERE linear_session_id=$1", [id, status]); }
}

export class WebhookRepository {
  constructor(pool) { this.pool = pool; }
  async enqueue({ webhookId, organizationId, payload }) {
    const result = await this.pool.query("INSERT INTO webhook_event(webhook_id,organization_id,payload) VALUES($1,$2,$3) ON CONFLICT DO NOTHING", [webhookId, organizationId, payload]); return result.rowCount === 1;
  }
  async claim(limit = 5) {
    const { rows } = await this.pool.query(`WITH due AS (SELECT webhook_id FROM webhook_event WHERE status IN ('pending','failed')
      AND next_attempt_at<=NOW() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE webhook_event e SET status='processing',attempts=attempts+1,updated_at=NOW() FROM due
      WHERE e.webhook_id=due.webhook_id RETURNING e.*`, [limit]); return rows;
  }
  async complete(id) { await this.pool.query("UPDATE webhook_event SET status='completed',updated_at=NOW() WHERE webhook_id=$1", [id]); }
  async fail(id, error) { await this.pool.query("UPDATE webhook_event SET status='failed',last_error=$2,next_attempt_at=NOW()+LEAST(attempts,12)*INTERVAL '1 minute',updated_at=NOW() WHERE webhook_id=$1", [id, String(error).slice(0, 2000)]); }
  async recover() { await this.pool.query("UPDATE webhook_event SET status='failed',next_attempt_at=NOW() WHERE status='processing' AND updated_at<NOW()-INTERVAL '5 minutes'"); }
}

export class ChatGptCredentialRepository {
  constructor(pool, credentials) { this.pool = pool; this.credentials = credentials; }
  async save(value) {
    await this.pool.query(`INSERT INTO chatgpt_credential(credential_id,client_id,subject,email,access_token_enc,refresh_token_enc,id_token_enc,granted_scope,expires_at)
      VALUES('primary',$1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(credential_id) DO UPDATE SET client_id=EXCLUDED.client_id,subject=EXCLUDED.subject,
      email=EXCLUDED.email,access_token_enc=EXCLUDED.access_token_enc,refresh_token_enc=EXCLUDED.refresh_token_enc,id_token_enc=EXCLUDED.id_token_enc,
      granted_scope=EXCLUDED.granted_scope,expires_at=EXCLUDED.expires_at,updated_at=NOW()`, [value.clientId, value.subject, value.email,
      this.credentials.encrypt(value.accessToken), this.credentials.encrypt(value.refreshToken), value.idToken ? this.credentials.encrypt(value.idToken) : null, value.scope, value.expiresAt]);
  }
  async get() {
    const { rows } = await this.pool.query("SELECT * FROM chatgpt_credential WHERE credential_id='primary'"); const row = rows[0]; if (!row) return null;
    return { clientId: row.client_id, subject: row.subject, email: row.email, accessToken: this.credentials.decrypt(row.access_token_enc),
      refreshToken: this.credentials.decrypt(row.refresh_token_enc), idToken: row.id_token_enc ? this.credentials.decrypt(row.id_token_enc) : null,
      scope: row.granted_scope, expiresAt: row.expires_at };
  }
}
