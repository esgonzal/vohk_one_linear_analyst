import { loadConfig } from "../src/config.js";
import { CredentialCrypto } from "../src/credential-crypto.js";
import { createPool } from "../src/database.js";
import { ChatGptCredentialRepository } from "../src/repositories.js";
import { ChatGptOAuth } from "../src/oauth/chatgpt.js";
const config = loadConfig(); const pool = createPool(config.databaseUrl);
try {
  const repository = new ChatGptCredentialRepository(pool, new CredentialCrypto(config.encryptionKey));
  const result = await new ChatGptOAuth({ repository }).authorizeInteractively();
  console.log(`Authorized ChatGPT account ${result.email ?? "(email unavailable)"}.`);
} finally { await pool.end(); }

