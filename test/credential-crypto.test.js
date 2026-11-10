import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { CredentialCrypto } from "../src/credential-crypto.js";

test("encrypts credentials with authenticated encryption", () => {
  const service = new CredentialCrypto(crypto.randomBytes(32));
  const encrypted = service.encrypt("secret-token");
  assert.notEqual(encrypted, "secret-token");
  assert.equal(service.decrypt(encrypted), "secret-token");
  const parts = encrypted.split(".");
  const ciphertext = Buffer.from(parts[3], "base64url");
  ciphertext[0] ^= 1;
  parts[3] = ciphertext.toString("base64url");
  assert.throws(() => service.decrypt(parts.join(".")));
});
