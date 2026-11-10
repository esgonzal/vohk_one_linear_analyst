import assert from "node:assert/strict";
import test from "node:test";
import { LinearOAuth } from "../src/oauth/linear.js";

test("builds an app-actor authorization URL with minimal agent scopes", async () => {
  const created = [];
  const oauth = new LinearOAuth({ clientId: "client", clientSecret: "secret", redirectUri: "https://example.com/auth/linear/callback", states: { async create(value) { created.push(value); } } });
  const url = new URL(await oauth.authorizationUrl());
  assert.equal(url.searchParams.get("actor"), "app");
  assert.equal(url.searchParams.get("scope"), "read,write,app:assignable,app:mentionable");
  assert.equal(url.searchParams.get("state"), created[0].state);
});
