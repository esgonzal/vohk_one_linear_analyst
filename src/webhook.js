import crypto from "node:crypto";

export function verifyLinearWebhook({ rawBody, signature, secret }) {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const actualBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

export function parseAgentEvent(payload) {
  if (payload?.type !== "AgentSessionEvent") return null;
  if (!['created', 'prompted'].includes(payload.action)) return null;

  const sessionId = payload.agentSession?.id;
  if (!sessionId) throw new Error("AgentSessionEvent does not contain agentSession.id");

  if (payload.action === "created") {
    return {
      action: "created",
      sessionId,
      input: payload.promptContext ?? "",
    };
  }

  return {
    action: "prompted",
    sessionId,
    input: payload.agentActivity?.body ?? "",
  };
}

