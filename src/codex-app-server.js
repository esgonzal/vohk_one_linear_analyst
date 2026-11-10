import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

export class CodexAppServerClient {
  constructor({ command = "codex", model, cwd = process.cwd(), env = process.env }) {
    this.command = command;
    this.model = model;
    this.cwd = cwd;
    this.env = {
      ...env,
      ...(env.HOME ? {} : { HOME: env.USERPROFILE }),
      ...(env.CODEX_HOME ? {} : { CODEX_HOME: path.join(env.USERPROFILE, ".codex") }),
    };
    this.sequence = 0;
    this.pending = new Map();
    this.turns = new Map();
  }

  async connect() {
    if (this.process) return;
    this.process = spawn(this.command, ["app-server"], {
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.process.stderr.on("data", (chunk) => process.stderr.write(chunk));
    this.process.on("exit", (code) => this.#rejectAll(new Error(`Codex app-server exited with code ${code}`)));
    readline.createInterface({ input: this.process.stdout }).on("line", (line) => this.#receive(line));

    await this.#request("initialize", {
      clientInfo: { name: "vohk_one_linear_analyst", title: "Analista ONE", version: "0.1.0" },
    });
    this.#notify("initialized", {});
  }

  async start({ systemPrompt, input }) {
    await this.connect();
    const thread = await this.#request("thread/start", {
      model: this.model || undefined,
      baseInstructions: systemPrompt,
      cwd: this.cwd,
      sandbox: "read-only",
      approvalPolicy: "never",
      ephemeral: false,
    });
    const threadId = thread.thread?.id ?? thread.id;
    const output = await this.#runTurn(threadId, input);
    return { threadId, output };
  }

  async continue({ threadId, input }) {
    await this.connect();
    await this.#request("thread/resume", { threadId });
    return { output: await this.#runTurn(threadId, input) };
  }

  async #runTurn(threadId, input) {
    const started = await this.#request("turn/start", {
      threadId,
      input: [{ type: "text", text: input }],
      outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          status: { type: "string", enum: ["needs_input", "complete"] },
          body: { type: "string", minLength: 1 },
        },
        required: ["status", "body"],
      },
      sandboxPolicy: { type: "readOnly", networkAccess: false },
      approvalPolicy: "never",
    });
    const turnId = started.turn?.id ?? started.id;
    return new Promise((resolve, reject) => this.turns.set(turnId, { text: "", resolve, reject }));
  }

  #request(method, params) {
    const id = ++this.sequence;
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  #notify(method, params) {
    this.process.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  #receive(line) {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    if (message.id && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      return;
    }
    const params = message.params ?? {};
    const turnId = params.turnId ?? params.turn?.id;
    const turn = this.turns.get(turnId);
    if (!turn) return;
    if (message.method === "item/agentMessage/delta") turn.text += params.delta ?? "";
    if (message.method === "turn/completed") {
      this.turns.delete(turnId);
      params.turn?.status === "completed" ? turn.resolve(turn.text) : turn.reject(new Error(`Codex turn ended as ${params.turn?.status}`));
    }
  }

  #rejectAll(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    for (const turn of this.turns.values()) turn.reject(error);
    this.pending.clear();
    this.turns.clear();
  }
}

