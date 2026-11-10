import { loadConfig } from "../src/config.js";
import { CredentialCrypto } from "../src/credential-crypto.js";
import { createPool } from "../src/database.js";
import { ChatGptCredentialRepository } from "../src/repositories.js";
import { ChatGptOAuth } from "../src/oauth/chatgpt.js";
const config = loadConfig(); const pool = createPool(config.databaseUrl, config.databaseSsl);
try {
  const repository = new ChatGptCredentialRepository(pool, new CredentialCrypto(config.encryptionKey));
  const headless = process.env.CHATGPT_AUTH_HEADLESS === "true";
  const callbackPort = Number(process.env.CHATGPT_AUTH_CALLBACK_PORT ?? 0);
  const result = await new ChatGptOAuth({
    repository,
    dataDirectory: process.env.CHATGPT_AUTH_DATA_DIR,
    callbackPort,
    openBrowserImpl: headless ? (url) => console.log(`Open this URL to authorize ChatGPT:\n${url}`) : undefined,
  }).authorizeInteractively();
  console.log(`Authorized ChatGPT account ${result.email ?? "(email unavailable)"}.`);
} finally { await pool.end(); }

