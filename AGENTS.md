# AGENTS.md

## Project overview

Slack Simulator is a local, browser-based Slack workspace and API emulator for developing and testing Slack apps and bots without a real Slack workspace. It is intended for the inner development loop: deterministic seed/reset behavior, identity switching, HTTP and Socket Mode events, and visibility into API requests and state.

This is a local development tool, not a production Slack replacement or security boundary. It intentionally uses static tokens and trusted local headers rather than OAuth, permission enforcement, or production-grade authentication.

## Technology and layout

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, TanStack Query, DiceBear.
- **Backend:** Node.js 20+, TypeScript, Fastify, WebSocket, SQLite via `better-sqlite3`, Zod, and Pino.
- `src/client/` — SPA, components, views, hooks, state, and client data access.
- `src/server/` — HTTP routes, database, seed loading, dispatchers, Socket Mode, and interactivity.
- `src/shared/` — Types and code shared by client and server.
- `config/seed.json` — Initial workspace, users, channels, DMs, and messages.
- `config/apps.json` — Locally configured simulator apps; schemas and examples are beside the config files.
- `docs/` — Product, technical, capability, and setup documentation.
- `.slack-simulator/` — Generated local SQLite state and credentials; ignored by Git and safe to regenerate.

Read the relevant files and nearby tests before making changes. Keep changes focused and follow the existing TypeScript and component conventions. Prefer existing dependencies and patterns over introducing new libraries.

## Common commands

Use Yarn (the repository includes `yarn.lock`) and Node.js 20 or newer:

```bash
yarn install             # Install dependencies
yarn dev                 # Start API on :4500 and Vite UI on :5173
yarn typecheck           # Type-check client/shared code
yarn test:ci             # Run the full test suite once
yarn build               # Build client and server
yarn docs:build          # Build Eleventy documentation
```

Useful focused commands:

```bash
yarn test:ci src/server/seed.test.ts
yarn dev:server
yarn dev:client
```

Tests are colocated with the implementation and use Vitest. React tests use Testing Library and jsdom; server route/API tests commonly use Supertest.

## Data and reset behavior

- Treat `config/seed.json` and `config/apps.json` as source configuration, not runtime database files.
- Validate JSON and preserve unrelated seed entities when editing configuration.
- `config/seed.schema.json` and `config/apps.schema.json` define the expected config shapes; do not modify schemas unless the data model itself changes.
- After changing seed or app configuration, use the simulator's **Reset workspace** action for changes to take effect. The database is seeded when the workspace is empty.
- Do not commit `.slack-simulator/`, generated build output, coverage, credentials, or real tokens/secrets.

## Implementation guidance

- Preserve the local-only emulator model and Slack-compatible request/response shapes when changing API behavior.
- For new server behavior, update or add focused tests near the affected module; cover both success and error paths where practical.
- For UI changes, keep state and API access in the existing client abstractions and add component tests for user-visible behavior.
- Keep client/server/shared type contracts synchronized.
- Avoid broad rewrites, unrelated formatting changes, and changes to documented out-of-scope features unless the task explicitly requires them.
- Run the narrowest relevant test while iterating, then run `yarn typecheck` and the relevant broader test/build command before declaring completion.

## Documentation references

- `docs/get-started.md` — installation, seed customization, and connecting a Slack app.
- `docs/tech-spec.md` — architecture, ports, protocols, persistence, and testing stack.
- `docs/product-spec.md` — product goals, boundaries, and deliberate non-goals.
- `docs/capabilities.md` — supported, partial, planned, and excluded Slack capabilities.

When implementation and documentation appear to disagree, inspect the current code and tests, then update the appropriate documentation as part of the same task when the behavior is intentionally changed.
