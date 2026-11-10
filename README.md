# Vohk One Linear Analyst

Standalone Linear agent that interviews humans until an issue has a complete functional specification, then emits a Codex-ready handoff. It does not design architecture, inspect repositories, implement code, merge, or deploy.

## Capabilities

- Linear `AgentSessionEvent` webhook verification and fast acknowledgement.
- `created` and `prompted` session handling.
- Semantic Linear activities: `thought`, `elicitation`, `response`, and `error`.
- PostgreSQL persistence for installations, sessions, OAuth state, and webhook jobs.
- Idempotent webhook intake, atomic worker claims, retry backoff, and abandoned-job recovery.
- Encrypted Linear and ChatGPT credentials using AES-256-GCM.
- Linear `actor=app` OAuth installation and automatic token rotation.
- Sign in with ChatGPT PKCE/OIDC authorization and automatic token rotation.
- One persistent Codex thread identifier per Linear agent session.
- A strict Spanish requirements-analyst prompt.
- A read-only Codex app-server adapter with no network or approval-capable tools.

## Runtime

- Node.js `22.16.0`
- npm `10.9.2`
- Codex CLI `0.167.0` (pinned project dependency)

Do not use a different Node major for installation or validation.

## Local validation

```powershell
npm run check
npm test
```

Set `TEST_DATABASE_URL` to include the PostgreSQL integration test; otherwise that single test is skipped. GitHub Actions provisions PostgreSQL and runs it automatically.

## Configuration

Copy `.env.example` to `.env` outside source control and provide a PostgreSQL database. Generate `CREDENTIAL_ENCRYPTION_KEY` as 32 random bytes encoded with base64 and keep it in the deployment secret store. Losing it makes stored OAuth tokens unreadable.

Apply the schema before starting:

```powershell
npm run migrate
```

For local development with an already signed-in Codex installation, set `USE_EXISTING_CODEX_LOGIN=true`. For a remote host, set it to `false`, run `npm run auth:chatgpt` locally, and transfer the protected database/credential state through an approved secure deployment process.

## Linear application setup

Create a new OAuth application owned by Esteban/the Vohk organization:

- Install with `actor=app`.
- Enable `AgentSessionEvent` webhooks.
- Grant `read`, `write`, `app:assignable`, and `app:mentionable`; never request `admin`.
- Configure the callback as `PUBLIC_BASE_URL/auth/linear/callback`.
- Point the webhook to `POST /webhooks/linear` on a public HTTPS origin.
- Open `PUBLIC_BASE_URL/auth/linear/start` as a Linear workspace administrator to install it.
- Store credentials only in runtime secrets; never commit `.env`.

The old Analista/Arquitecto/QA/Documentador applications remain untouched until this replacement is validated.

## Security boundary

The analyst receives issue/session text only. Its Codex thread uses a dedicated empty working directory, read-only sandboxing, disabled network access, and `approvalPolicy=never`. The model is required to return either a clarification request or a final functional specification matching a JSON schema.

## License

MIT. See `LICENSE`.

