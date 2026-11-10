import { ANALYST_SYSTEM_PROMPT } from "./analyst-prompt.js";

export class AnalystOrchestrator {
  constructor({ linear, analyst, sessions, logger = console }) {
    this.linear = linear;
    this.analyst = analyst;
    this.sessions = sessions;
    this.logger = logger;
  }

  async handle(event) {
    const { sessionId, action, input, organizationId } = event;
    await this.sessions.create?.(sessionId, organizationId);
    await this.linear.createActivity(sessionId, {
      type: "thought",
      body: action === "created" ? "Estoy revisando la solicitud y el contexto disponible." : "Estoy incorporando la nueva respuesta.",
    }, { ephemeral: true, organizationId });

    try {
      let state = this.sessions.get(sessionId);
      if (!state) {
        const created = await this.analyst.start({ systemPrompt: ANALYST_SYSTEM_PROMPT, input });
        state = { threadId: created.threadId };
        this.sessions.set(sessionId, state);
        await this.#publish(sessionId, organizationId, created.output);
        return;
      }

      const continued = await this.analyst.continue({ threadId: state.threadId, input });
      await this.#publish(sessionId, organizationId, continued.output);
    } catch (error) {
      this.logger.error(error);
      await this.linear.createActivity(sessionId, {
        type: "error",
        body: "No pude procesar esta ronda. El error quedó registrado sin exponer credenciales. Intenta nuevamente o avisa al responsable del Analista.",
      }, { organizationId });
    }
  }

  async #publish(sessionId, organizationId, rawOutput) {
    const result = parseAnalystOutput(rawOutput);
    const type = result.status === "needs_input" ? "elicitation" : "response";
    await this.linear.createActivity(sessionId, { type, body: result.body }, { organizationId });
    await this.sessions.setStatus?.(sessionId, result.status === "needs_input" ? "awaiting_input" : "complete");
  }
}

export function parseAnalystOutput(rawOutput) {
  let parsed;
  try {
    parsed = typeof rawOutput === "string" ? JSON.parse(rawOutput) : rawOutput;
  } catch {
    throw new Error("Analyst returned invalid JSON");
  }
  if (!['needs_input', 'complete'].includes(parsed?.status) || typeof parsed?.body !== "string" || !parsed.body.trim()) {
    throw new Error("Analyst returned an invalid result shape");
  }
  return parsed;
}

