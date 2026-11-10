import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { CodexAppServerClient } from "./codex-app-server.js";
import { LinearClient } from "./linear-client.js";
import { AnalystOrchestrator } from "./orchestrator.js";
import { loadConfig } from "./config.js";
import { CredentialCrypto } from "./credential-crypto.js";
import { createPool } from "./database.js";
import { ChatGptOAuth } from "./oauth/chatgpt.js";
import { LinearOAuth } from "./oauth/linear.js";
import { ChatGptCredentialRepository, InstallationRepository, OAuthStateRepository, PgSessionStore, WebhookRepository } from "./repositories.js";
import { verifyLinearWebhook } from "./webhook.js";
import { WebhookWorker } from "./webhook-worker.js";

const config = loadConfig();
if (!config.publicBaseUrl || !config.linear.clientId || !config.linear.clientSecret || !config.linear.webhookSecret) throw new Error("PUBLIC_BASE_URL and all LINEAR_* settings are required");
const pool = createPool(config.databaseUrl); const credentialCrypto = new CredentialCrypto(config.encryptionKey);
const installations = new InstallationRepository(pool, credentialCrypto); const states = new OAuthStateRepository(pool, credentialCrypto);
const linearOAuth = new LinearOAuth({ clientId: config.linear.clientId, clientSecret: config.linear.clientSecret, redirectUri: `${config.publicBaseUrl}/auth/linear/callback`, states, installations });
const chatGptOAuth = new ChatGptOAuth({ repository: new ChatGptCredentialRepository(pool, credentialCrypto) });

const analystSandbox = path.resolve(".data", "analyst-sandbox");
fs.mkdirSync(analystSandbox, { recursive: true });

const orchestrator = new AnalystOrchestrator({
  linear: new LinearClient({ tokenProvider: (organizationId) => linearOAuth.accessToken(organizationId) }),
  analyst: new CodexAppServerClient({ command: config.codex.command, model: config.codex.model, cwd: analystSandbox, tokenProvider: config.codex.useExistingLogin ? null : () => chatGptOAuth.accessToken() }),
  sessions: new PgSessionStore(pool),
});
const webhooks = new WebhookRepository(pool); const worker = new WebhookWorker({ repository: webhooks, orchestrator });

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, config.publicBaseUrl);
    if (request.method === "GET" && url.pathname === "/healthz") { await pool.query("SELECT 1"); return send(response, 200, JSON.stringify({ status: "ok" }), "application/json"); }
    if (request.method === "GET" && url.pathname === "/auth/linear/start") { response.writeHead(302, { location: await linearOAuth.authorizationUrl(), "cache-control": "no-store" }).end(); return; }
    if (request.method === "GET" && url.pathname === "/auth/linear/callback") { const organizationId = await linearOAuth.callback({ code: url.searchParams.get("code"), state: url.searchParams.get("state") }); return send(response, 200, `Analista ONE instalado para ${organizationId}.`); }
    if (request.method === "POST" && url.pathname === "/webhooks/linear") {
      const rawBody = await readBody(request, 1_000_000);
      if (!verifyLinearWebhook({ rawBody, signature: request.headers["linear-signature"], secret: config.linear.webhookSecret })) return send(response, 401, "Invalid signature");
      const payload = JSON.parse(rawBody.toString("utf8")); const webhookId = request.headers["linear-delivery"] ?? payload.webhookId;
      if (!webhookId || !payload.organizationId) return send(response, 400, "Missing webhook identity");
      await webhooks.enqueue({ webhookId, organizationId: payload.organizationId, payload }); return send(response, 200, "ok");
    }
    return send(response, 404, "Not found");
  } catch (error) {
    console.error(error); return send(response, 500, "Internal error");
  }
});

await worker.start();
server.listen(config.port, () => console.log(`Analista ONE listening on :${config.port}`));

async function readBody(request, limit) { const chunks = []; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > limit) throw new Error("Request body too large"); chunks.push(chunk); } return Buffer.concat(chunks); }
function send(response, status, body, contentType = "text/plain; charset=utf-8") { response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" }); response.end(body); }
async function shutdown() { worker.stop(); server.close(); await pool.end(); process.exit(0); }
process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);

