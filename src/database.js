import pg from "pg";
export function createPool(connectionString, ssl) { return new pg.Pool({ connectionString, ssl, max: 10, idleTimeoutMillis: 30_000 }); }
