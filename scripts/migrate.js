import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/database.js";
const config = loadConfig(); const pool = createPool(config.databaseUrl, config.databaseSsl);
for (const file of (await fs.readdir("migrations")).filter((name) => name.endsWith(".sql")).sort()) {
  await pool.query(await fs.readFile(path.join("migrations", file), "utf8")); console.log(`Applied ${file}`);
}
await pool.end();

