import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_BASE = "https://auth.openai.com";
const RESOURCE = "https://api.openai.com/v1";
const SCOPE = "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct";

export class ChatGptOAuth {
  constructor({ repository, dataDirectory = path.resolve(".data"), fetchImpl = fetch, callbackPort = 0, openBrowserImpl = openBrowser }) {
    Object.assign(this, { repository, dataDirectory, fetchImpl, callbackPort, openBrowserImpl });
  }

  async authorizeInteractively() {
    const hostId = await this.#hostId(); const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url"); const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const callback = await this.#listen();
    const url = new URL(`${AUTH_BASE}/api/accounts/authorize`);
    url.search = new URLSearchParams({ client_id: "dynamic_agent_client", agent_name_hint: "vohk_one_linear_analyst",
      ext_agent_host_id: hostId, response_type: "code", redirect_uri: callback.redirectUri, scope: SCOPE, resource: RESOURCE,
      state, nonce, code_challenge_method: "S256", code_challenge: challenge }).toString();
    this.openBrowserImpl(url.toString());
    const result = await callback.result;
    if (result.state !== state || result.error) throw new Error(result.error ?? "Invalid ChatGPT OAuth state");
    if (!result.code || !result.client_id) throw new Error("ChatGPT registration did not return code and issued client_id");
    const token = await this.#exchange({ grant_type: "authorization_code", client_id: result.client_id, code: result.code,
      code_verifier: verifier, redirect_uri: callback.redirectUri, resource: RESOURCE });
    const discovery = await this.#discovery();
    const { payload } = await jwtVerify(token.id_token, createRemoteJWKSet(new URL(discovery.jwks_uri)), {
      issuer: discovery.issuer, audience: result.client_id, nonce,
    });
    const granted = token.scope ?? result.scope ?? "";
    if (!granted.split(/\s+/).includes("chatgpt.tokens.use.direct")) throw new Error("ChatGPT plan usage permission was not granted");
    await this.repository.save({ clientId: result.client_id, subject: payload.sub, email: payload.email, accessToken: token.access_token,
      refreshToken: token.refresh_token, idToken: token.id_token, scope: granted, expiresAt: new Date(Date.now() + token.expires_in * 1000) });
    return { email: payload.email, scope: granted };
  }

  async accessToken() {
    const credential = await this.repository.get(); if (!credential) throw new Error("ChatGPT has not been authorized; run npm run auth:chatgpt");
    if (new Date(credential.expiresAt).getTime() > Date.now() + 300_000) return credential.accessToken;
    const token = await this.#exchange({ grant_type: "refresh_token", client_id: credential.clientId, refresh_token: credential.refreshToken, resource: RESOURCE });
    await this.repository.save({ ...credential, accessToken: token.access_token, refreshToken: token.refresh_token ?? credential.refreshToken,
      idToken: token.id_token ?? credential.idToken, scope: token.scope ?? credential.scope, expiresAt: new Date(Date.now() + token.expires_in * 1000) });
    return token.access_token;
  }

  async #hostId() {
    const file = path.join(this.dataDirectory, "chatgpt-host-id");
    try {
      const stored = (await fs.readFile(file, "utf8")).trim();
      if (stored.startsWith("urn:uuid:")) return stored;
      const normalized = `urn:uuid:${stored}`;
      await fs.writeFile(file, normalized, { mode: 0o600 });
      return normalized;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    await fs.mkdir(this.dataDirectory, { recursive: true });
    const value = `urn:uuid:${crypto.randomUUID()}`;
    await fs.writeFile(file, value, { mode: 0o600 });
    return value;
  }
  async #discovery() { const response = await this.fetchImpl(`${AUTH_BASE}/.well-known/openid-configuration`); if (!response.ok) throw new Error("Unable to load OpenAI OIDC configuration"); return response.json(); }
  async #exchange(params) { const discovery = await this.#discovery(); const response = await this.fetchImpl(discovery.token_endpoint, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) }); const body = await response.json(); if (!response.ok) throw new Error(`ChatGPT OAuth failed: ${body.error_description ?? body.error}`); return body; }
  async #listen() {
    let resolve; const result = new Promise((done) => { resolve = done; });
    const server = http.createServer((request, response) => { const url = new URL(request.url, "http://127.0.0.1"); if (url.pathname !== "/auth/callback") { response.writeHead(404).end(); return; } const values = Object.fromEntries(url.searchParams); response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }); response.end("Analista ONE autorizado. Puedes cerrar esta ventana."); server.close(); resolve(values); });
    await new Promise((done) => server.listen(this.callbackPort, "127.0.0.1", done)); const address = server.address();
    return { redirectUri: `http://127.0.0.1:${address.port}/auth/callback`, result };
  }
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("powershell.exe", ["-NoProfile", "-Command", "Start-Process -FilePath $env:ANALYST_AUTH_URL"],
      { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, ANALYST_AUTH_URL: url } }).unref(); return;
  }
  const command = process.platform === "darwin" ? "open" : "xdg-open"; spawn(command, [url], { detached: true, stdio: "ignore" }).unref();
}

