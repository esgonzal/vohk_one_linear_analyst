# Vohk One Linear Analyst

Standalone Linear agent that interviews humans until an issue has a complete functional specification, then emits a Codex-ready handoff. It does not design architecture, inspect repositories, implement code, merge, or deploy.

## Status

This is the local proof of concept. It implements:

- Linear `AgentSessionEvent` webhook verification and fast acknowledgement.
- `created` and `prompted` session handling.
- Semantic Linear activities: `thought`, `elicitation`, `response`, and `error`.
- One persistent Codex thread identifier per Linear agent session (currently in memory).
- A strict Spanish requirements-analyst prompt.
- A Codex app-server adapter using newline-delimited JSON over stdio.
- Unit tests for webhook security and multi-round orchestration.

Before production, replace the in-memory stores with PostgreSQL, complete the Sign in with ChatGPT token flow, and deploy behind public HTTPS.

## Runtime

- Node.js `22.16.0`
- npm `10.9.2`

Do not use a different Node major for installation or validation.

## Local validation

```powershell
npm run check
npm test
```

## Linear application setup (later milestone)

Create a new OAuth application owned by Esteban/the Vohk organization:

- Install with `actor=app`.
- Enable `AgentSessionEvent` webhooks.
- Grant `app:assignable`, `app:mentionable`, and the minimum read/write scopes needed for agent activities.
- Point the webhook to `POST /webhooks/linear` on a public HTTPS origin.
- Store credentials only in runtime secrets; never commit `.env`.

The old Analista/Arquitecto/QA/Documentador applications remain untouched until this replacement is validated.

