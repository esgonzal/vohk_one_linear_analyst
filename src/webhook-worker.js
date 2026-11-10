import { parseAgentEvent } from "./webhook.js";
export class WebhookWorker {
  constructor({ repository, orchestrator, logger = console, intervalMs = 1000 }) { Object.assign(this, { repository, orchestrator, logger, intervalMs }); }
  async start() { await this.repository.recover(); this.timer = setInterval(() => this.tick().catch((error) => this.logger.error(error)), this.intervalMs); this.timer.unref?.(); await this.tick(); }
  stop() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    for (const row of await this.repository.claim()) {
      try { const event = parseAgentEvent(row.payload); if (event) await this.orchestrator.handle(event); await this.repository.complete(row.webhook_id); }
      catch (error) { this.logger.error(error); await this.repository.fail(row.webhook_id, error); }
    }
  }
}
