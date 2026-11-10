import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { CodexAppServerClient } from "./codex-app-server.js";
import { LinearClient } from "./linear-client.js";
import { AnalystOrchestrator } from "./orchestrator.js";
import { InMemorySessionStore } from "./session-store.js";
import { parseAgentEvent, verifyLinearWebhook } from "./webhook.js";

const config = {
  port: Number(process.env.PORT ?? 8787),
  webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
  accessToken: process.env.LINEAR_ACCESS_TOKEN,
  codexCommand: process.env.CODEX_COMMAND ?? "codex",
  codexModel: process.env.CODEX_MODEL,
};

const analystSandbox = path.resolve(".data", "analyst-sandbox");
fs.mkdirSync(analystSandbox, { recursive: true });

const orchestrator = new AnalystOrchestrator({
  linear: new LinearClient({ accessToken: config.accessToken }),
  analyst: new CodexAppServerClient({ command: config.codexCommand, model: config.codexModel, cwd: analystSandbox }),
  sessions: new InMemorySessionStore(),
});

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/webhooks/linear") {
    response.writeHead(404).end();
    return;
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  const signature = request.headers["linear-signature"];

  if (!verifyLinearWebhook({ rawBody, signature, secret: config.webhookSecret })) {
    response.writeHead(401).end();
    return;
  }

  let event;
  try {
    event = parseAgentEvent(JSON.parse(rawBody.toString("utf8")));
  } catch {
    response.writeHead(400).end();
    return;
  }

  response.writeHead(200).end();
  if (event) setImmediate(() => orchestrator.handle(event));
});

server.listen(config.port, () => console.log(`Analista ONE listening on :${config.port}`));

