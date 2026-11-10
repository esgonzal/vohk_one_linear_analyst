export function loadConfig(env = process.env) {
  const required = ["DATABASE_URL", "CREDENTIAL_ENCRYPTION_KEY"];
  const missing = required.filter((name) => !env[name]);
  if (missing.length) throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  const encryptionKey = Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "base64");
  if (encryptionKey.length !== 32) throw new Error("CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  return {
    port: Number(env.PORT ?? 8787), publicBaseUrl: env.PUBLIC_BASE_URL?.replace(/\/$/, ""),
    databaseUrl: env.DATABASE_URL, encryptionKey,
    linear: { clientId: env.LINEAR_CLIENT_ID, clientSecret: env.LINEAR_CLIENT_SECRET, webhookSecret: env.LINEAR_WEBHOOK_SECRET },
    codex: { command: env.CODEX_COMMAND ?? "codex", model: env.CODEX_MODEL || undefined, useExistingLogin: env.USE_EXISTING_CODEX_LOGIN === "true" },
  };
}
