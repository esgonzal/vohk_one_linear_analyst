import assert from "node:assert/strict";
import test from "node:test";
import { AnalystOrchestrator } from "../src/orchestrator.js";
import { InMemorySessionStore } from "../src/session-store.js";

test("asks questions, resumes the same thread, then publishes the final specification", async () => {
  const activities = [];
  const linear = { async createActivity(sessionId, content) { activities.push({ sessionId, content }); } };
  const calls = [];
  const analyst = {
    async start(args) {
      calls.push({ method: "start", ...args });
      return { threadId: "thread-1", output: JSON.stringify({ status: "needs_input", body: "¿Quién recibe el aviso?" }) };
    },
    async continue(args) {
      calls.push({ method: "continue", ...args });
      return { output: JSON.stringify({ status: "complete", body: "# Especificación final\n\n## Input para Codex\nImplementar el comportamiento confirmado." }) };
    },
  };
  const orchestrator = new AnalystOrchestrator({ linear, analyst, sessions: new InMemorySessionStore() });

  await orchestrator.handle({ action: "created", sessionId: "linear-1", input: "Nueva solicitud" });
  await orchestrator.handle({ action: "prompted", sessionId: "linear-1", input: "Solo el residente destinatario" });

  assert.equal(calls[0].method, "start");
  assert.equal(calls[1].method, "continue");
  assert.equal(calls[1].threadId, "thread-1");
  assert.equal(activities[1].content.type, "elicitation");
  assert.equal(activities[3].content.type, "response");
});

