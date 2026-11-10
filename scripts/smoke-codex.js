import fs from "node:fs";
import path from "node:path";
import { CodexAppServerClient } from "../src/codex-app-server.js";

const cwd = path.resolve(".data", "smoke-sandbox");
fs.mkdirSync(cwd, { recursive: true });

const client = new CodexAppServerClient({ cwd });
const result = await client.start({
  systemPrompt: "Return only valid JSON matching the requested schema. You are a requirements analyst.",
  input: "Ask one short clarification question about an unspecified notification recipient.",
});

const parsed = JSON.parse(result.output);
if (!['needs_input', 'complete'].includes(parsed.status) || typeof parsed.body !== "string") {
  throw new Error("Unexpected Codex result");
}
console.log(JSON.stringify({ threadId: result.threadId, result: parsed }));
process.exit(0);
