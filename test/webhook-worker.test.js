import assert from "node:assert/strict";
import test from "node:test";
import { WebhookWorker } from "../src/webhook-worker.js";

test("marks a queued webhook complete after orchestration", async () => {
  const calls = [];
  const repository = { async claim() { return [{ webhook_id: "w1", payload: { type: "AgentSessionEvent", action: "created", organizationId: "o1", agentSession: { id: "s1" }, promptContext: "hello" } }]; }, async complete(id) { calls.push(["complete", id]); }, async fail() {} };
  const orchestrator = { async handle(event) { calls.push(["handle", event.sessionId]); } };
  await new WebhookWorker({ repository, orchestrator }).tick();
  assert.deepEqual(calls, [["handle", "s1"], ["complete", "w1"]]);
});
