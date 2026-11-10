import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { parseAgentEvent, verifyLinearWebhook } from "../src/webhook.js";

test("verifies a valid Linear signature", () => {
  const rawBody = Buffer.from('{"type":"AgentSessionEvent"}');
  const secret = "test-secret";
  const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  assert.equal(verifyLinearWebhook({ rawBody, signature, secret }), true);
  assert.equal(verifyLinearWebhook({ rawBody, signature: "00".repeat(32), secret }), false);
});

test("parses created and prompted events", () => {
  assert.deepEqual(parseAgentEvent({
    type: "AgentSessionEvent", action: "created", organizationId: "o1", promptContext: "context", agentSession: { id: "s1" },
  }), { action: "created", sessionId: "s1", organizationId: "o1", input: "context" });

  assert.deepEqual(parseAgentEvent({
    type: "AgentSessionEvent", action: "prompted", organizationId: "o1", agentActivity: { body: "answer" }, agentSession: { id: "s1" },
  }), { action: "prompted", sessionId: "s1", organizationId: "o1", input: "answer" });
});

