---
layout: base
title: Technical Specification
toc: true
---

# Technical Specification

## System Requirements

- **Node.js** 20 or higher
- **yarn** package manager
- **Modern web browser** (Chrome, Firefox, Safari, Edge) for the SPA
- **Disk space**: ~500MB for `node_modules` and ~10MB for the database

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd experiment-slack-appmulator

# Install dependencies
yarn install

# Start development server
yarn dev
```

The simulator starts both the API server (port 4500) and the SPA dev server (port 5173). Access the SPA at `http://localhost:5173`. Refer to the [getting started documentation](get-started.md) for more details on further details on how to customize the simulator and configure it to work with your app locally.

## High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (http://localhost:PORT)                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Simulator SPA — Workspace UI + Admin/API Console        │  │
│  │  (Identity Switcher, Channel List, Message Composer)     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │ REST + WebSocket (control plane)    │
└──────────────────────────┼─────────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Simulator Server (http://localhost:PORT)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  ┌────────────────────┐                  │  │
│  │                  │ Control API        │                  │  │
│  │                  │ (SPA ↔ Domain Core)│                  │  │
│  │                  └────────┬───────────┘                  │  │
│  │                           │                              │  │
│  │  ┌────────────────────────▼───────────────────────────┐  │  │
│  │  │ Domain Core + Dispatcher                           │  │  │
│  │  │ ┌─────────────────┐  ┌──────────────┐              │  │  │
│  │  │ │ Fake Slack Web  │  │ Socket Mode  │              │  │  │
│  │  │ │ API (/api/*)    │  │ (/ws/socket) │              │  │  │
│  │  │ └────────┬────────┘  └───────┬──────┘              │  │  │
│  │  │          │                   │                     │  │  │
│  │  │          └─────────┬─────────┘                     │  │  │
│  │  │                    │                               │  │  │
│  │  │ (workspace, channels, messages, users, apps)       │  │  │
│  │  └────────────────────┼───────────────────────────────┘  │  │
│  │                       │                                  │  │
│  │          ┌────────────▼───────────┐                      │  │
│  │          │ Simulator Database     │                      │  │
│  │          │ (SQLite)               │                      │  │
│  │          └────────────────────────┘                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────┼─────────────────────────────────────┘
                           │ HTTP + WebSocket
                           ▼
┌────────────────────────────────────────────────────────────────┐
│  Your Slack App                                                │
│  (Bolt framework or raw @slack/web-api)                        │
│  — configured to point at http://localhost:PORT/api/           │
└────────────────────────────────────────────────────────────────┘
```

## Simulator Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Zustand for state, TanStack Query for data fetching, DiceBear for avatar generation, a small Block Kit renderer (custom React components mapping Slack block JSON → DOM).
- **Backend:** Node 20+, TypeScript, Fastify (HTTP), `@fastify/websocket` (WebSocket), `better-sqlite3` (storage), `zod` (validation), `pino` (logs). Signing uses Node's built-in `crypto`.

**Package scripts:**

- `yarn dev` — Start both server and client in development mode (concurrently)
- `yarn dev:server` — Start server with `tsx watch` for hot reload
- `yarn dev:client` — Start Vite dev server for the SPA
- `yarn build` — Build both client and server for production
- `yarn build:client` — Build SPA with Vite
- `yarn build:server` — Compile server TypeScript
- `yarn typecheck` — Run TypeScript type checking

### How your Slack app connects to the Slack Simulator

**Auth model is deliberately lightweight — this is local-only, not a security boundary.**

- **SPA ↔ backend:** no tokens. The SPA sends `X-Slacksim-Acting-User: U001` and the backend trusts it. Switching identity in the banner just changes that header.
- **Bot ↔ backend:** Bolt/`@slack/web-api` always sends `Authorization: Bearer xoxb-…`, so the emulator maps that token string to the installed app. Tokens are **static and pre-generated**, printed at startup; no OAuth dance, no rotation, no UI required.

### Bolt configuration

```ts
import { App } from "@slack/bolt";

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  clientOptions: { slackApiUrl: "http://localhost:4500/api/" },
});
```

For **Socket Mode**, Bolt calls `apps.connections.open` to discover a `wss://` URL. The Slack Simulator returns its own `ws://localhost:PORT/ws/socket-mode?ticket=…` URL and speaks the Socket Mode envelope protocol (`hello`, `events_api`, `interactive`, `slash_commands`, `disconnect`, with `envelope_id` + `ack`).

For **Events / Interactivity over HTTP**, request URLs are configured in `apps.json` via the `requestUrl` field. The Slack Simulator's outbound dispatcher POSTs to those URLs with proper `X-Slack-Signature` and `X-Slack-Request-Timestamp` headers signed with the per-app signing secret.

Everything else (signed payload shape, retry-on-non-2xx behavior, `response_url` tokens with TTLs) mirrors Slack's documented contract.

### The slack-simulator folder

The `.slack-simulator` directory is created automatically in the project root when the simulator starts. It contains:

- **`simulator.db`** — SQLite database storing all simulator state (workspace, users, channels, messages, reactions, apps, logs)
- **`credentials.json`** — Auto-generated file containing bot tokens, signing secrets, and app tokens for all configured apps

The folder is generated on first startup if it doesn't exist. The database is seeded from `config/seed.json` and `config/apps.json` when the workspace table is empty. The credentials file is regenerated whenever the database is seeded.

### Why a single Node process

The simulator is designed for local development only. When running the built version (vs Vite dev mode), the server serves both the SPA and the API from the same port. In development, the SPA runs via Vite's dev server on a separate port while the API server runs on port 4500. Co-locating them in the built version means:

- One CORS-free origin.
- One token for the whole thing.

---

## Testing Tech Stack

- **Vitest** — Fast unit test runner with native ESM support
- **@testing-library/react** — React component testing utilities
- **jsdom** — Browser-like DOM environment for Node.js
- **supertest** — HTTP endpoint testing for Fastify routes

**Package scripts:**

- `yarn test` — Run tests in watch mode
- `yarn test:ui` — Run tests with Vitest UI
- `yarn test:coverage` — Run tests with coverage report

---

## Documentation Tech Stack

- **Eleventy** — Zero-config static site generator
- **markdown-it** — Markdown to HTML conversion with syntax highlighting
- **GitHub Pages** - Eleventy builds the docs to `docs/_site` directory and in GHA we publish the `_site` directory to GitHub Pages.

**Package scripts:**

- `yarn docs:dev` — Start Eleventy dev server with live reload
- `yarn docs:build` — Build static site to `docs/_site` directory

---

## References

- [Developer sandboxes overview (Slack docs)](https://docs.slack.dev/tools/developer-sandboxes/)
- [How to sign up for a Developer Sandbox](https://slack.dev/slack-developer-sandboxes/)
- [Slack Developer Program](https://api.slack.com/developer-program)
- [Manage Slack developer sandboxes (help center)](https://slack.com/help/articles/27390391126803-Manage-Slack-developer-sandboxes)
- [Slack Web API method reference](https://api.slack.com/methods)
- [Events API](https://api.slack.com/apis/events-api)
- [Socket Mode](https://api.slack.com/apis/socket-mode)
- [Block Kit](https://api.slack.com/block-kit)
- [Bolt for JavaScript](https://tools.slack.dev/bolt-js/)
- [App Manifest reference](https://api.slack.com/reference/manifests)
