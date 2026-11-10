import crypto from "node:crypto";
const SCOPES = "read,write,app:assignable,app:mentionable";

export class LinearOAuth {
  constructor(options) { Object.assign(this, options); }
  async authorizationUrl() {
    const state = crypto.randomBytes(32).toString("base64url"); await this.states.create({ state, provider: "linear" });
    const url = new URL("https://linear.app/oauth/authorize");
    url.search = new URLSearchParams({ client_id: this.clientId, redirect_uri: this.redirectUri, response_type: "code", scope: SCOPES, actor: "app", state }).toString(); return url.toString();
  }
  async callback({ code, state }) {
    if (!code || !state || !(await this.states.consume(state, "linear"))) throw new Error("Invalid or expired Linear OAuth state");
    const token = await this.#token({ code, redirect_uri: this.redirectUri, client_id: this.clientId, client_secret: this.clientSecret, grant_type: "authorization_code" });
    const viewer = await this.#graphql(token.access_token, "query { viewer { id organization { id } } }");
    await this.installations.save({ organizationId: viewer.viewer.organization.id, appUserId: viewer.viewer.id, accessToken: token.access_token,
      refreshToken: token.refresh_token, scope: Array.isArray(token.scope) ? token.scope.join(" ") : token.scope, expiresAt: new Date(Date.now() + token.expires_in * 1000) });
    return viewer.viewer.organization.id;
  }
  async accessToken(organizationId) {
    const installation = await this.installations.get(organizationId); if (!installation) throw new Error(`No Linear installation for organization ${organizationId}`);
    if (new Date(installation.expiresAt).getTime() > Date.now() + 300_000) return installation.accessToken;
    const token = await this.#token({ refresh_token: installation.refreshToken, client_id: this.clientId, client_secret: this.clientSecret, grant_type: "refresh_token" });
    await this.installations.save({ ...installation, accessToken: token.access_token, refreshToken: token.refresh_token,
      scope: Array.isArray(token.scope) ? token.scope.join(" ") : token.scope, expiresAt: new Date(Date.now() + token.expires_in * 1000) }); return token.access_token;
  }
  async #token(params) { const response = await (this.fetchImpl ?? fetch)("https://api.linear.app/oauth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params) }); const body = await response.json(); if (!response.ok) throw new Error(`Linear OAuth failed: ${body.error_description ?? body.error}`); return body; }
  async #graphql(token, query) { const response = await (this.fetchImpl ?? fetch)("https://api.linear.app/graphql", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ query }) }); const body = await response.json(); if (!response.ok || body.errors) throw new Error(`Linear GraphQL failed: ${JSON.stringify(body.errors ?? body)}`); return body.data; }
}
