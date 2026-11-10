export class InMemorySessionStore {
  #sessions = new Map();

  get(linearSessionId) {
    return this.#sessions.get(linearSessionId) ?? null;
  }

  set(linearSessionId, value) {
    this.#sessions.set(linearSessionId, value);
  }
}

