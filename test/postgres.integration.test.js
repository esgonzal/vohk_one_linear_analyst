import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { CredentialCrypto } from "../src/credential-crypto.js";
import { createPool } from "../src/database.js";
import { InstallationRepository, OAuthStateRepository, PgSessionStore, WebhookRepository } from "../src/repositories.js";

test("persists encrypted installations, one-time OAuth state, sessions, and idempotent webhooks", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const suffix = crypto.randomUUID();
  const organizationId = `org-${suffix}`;
  const sessionId = `session-${suffix}`;
  const webhookId = `webhook-${suffix}`;
  const credentials = new CredentialCrypto(crypto.randomBytes(32));

  try {
    const installations = new InstallationRepository(pool, credentials);
    await installations.save({ organizationId, appUserId: "agent", accessToken: "access-secret", refreshToken: "refresh-secret", scope: "read write", expiresAt: new Date(Date.now() + 60_000) });
    assert.equal((await installations.get(organizationId)).accessToken, "access-secret");

    const states = new OAuthStateRepository(pool, credentials);
    await states.create({ state: `state-${suffix}`, provider: "linear", verifier: "verifier" });
    assert.equal((await states.consume(`state-${suffix}`, "linear")).verifier, "verifier");
    assert.equal(await states.consume(`state-${suffix}`, "linear"), null);

    const sessions = new PgSessionStore(pool);
    await sessions.create(sessionId, organizationId);
    await sessions.set(sessionId, { threadId: "thread-1" });
    assert.deepEqual(await sessions.get(sessionId), { threadId: "thread-1" });

    const webhooks = new WebhookRepository(pool);
    assert.equal(await webhooks.enqueue({ webhookId, organizationId, payload: { type: "test" } }), true);
    assert.equal(await webhooks.enqueue({ webhookId, organizationId, payload: { type: "test" } }), false);
    const claimed = await webhooks.claim(10);
    assert.equal(claimed.some((row) => row.webhook_id === webhookId), true);
    await webhooks.complete(webhookId);
  } finally {
    await pool.query("DELETE FROM webhook_event WHERE webhook_id=$1", [webhookId]);
    await pool.query("DELETE FROM agent_session WHERE linear_session_id=$1", [sessionId]);
    await pool.query("DELETE FROM oauth_installation WHERE organization_id=$1", [organizationId]);
    await pool.end();
  }
});
