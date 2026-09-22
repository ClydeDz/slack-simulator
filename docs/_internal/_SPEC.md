# Slack Simulator — Feasibility Report & Technical Spec

> A local, browser-based emulator of a Slack workspace + Slack platform APIs, so you can develop and test Slack apps/bots end-to-end without installing them into a real workspace.

---

## 1. TL;DR

- **Feasibility:** Yes — fully feasible. Every Slack surface you need (Web API, Events API, Socket Mode, Interactivity, Slash Commands, Modals) is a documented HTTP/WebSocket protocol you can re-implement locally. The main cost is Block Kit fidelity in the UI, not protocol mocking.
- **Slack Developer Sandboxes (official offering) only partially solve your problem.** They give you a pre-seeded online workspace, but they are still real Slack, capped at 8 users, 3-day message retention, online-only, and provide **no first-class way to "switch perspective" between mock users to drive multi-user conversations**. See §2.
- **Recommended shape:** Single `npx slack-simulator` command starts a local Node server that simultaneously (a) serves a React SPA that visually mimics Slack at `http://localhost:PORT`, (b) exposes the fake Slack Web API at `http://localhost:PORT/api/*`, (c) speaks Socket Mode over `ws://localhost:PORT/ws`, (d) POSTs Events/Interactivity payloads to your app's configured URLs. State persists in SQLite with a "Reset workspace" button.
- **Scope confirmed with you:**
  - Surfaces: Web API + Events API (HTTP), Socket Mode (WebSocket), Interactivity + Slash commands + Modals.
  - Frameworks targeted: Bolt for JS/TS and raw `@slack/web-api` / hand-rolled HTTP.
  - Persistence: SQLite-backed, with a reset button.
  - Delivery: Browser SPA + local Node server.
- **Plan:** 14 iterative phases (including 2 sub-phases), each independently useful. See §6.

---

## 2. Does Slack Developer Sandbox already do this?

**Short answer: No, not for your stated goal.** It overlaps on "seed a test workspace" but misses the core thing you want — a local emulator you control end-to-end, including switching identity between mock users to script multi-party conversations against your app.

### What Slack Developer Sandbox _does_ give you

A free benefit of the [Slack Developer Program](https://api.slack.com/developer-program) that provisions you a real (but isolated) Slack workspace for app testing:

- Up to **3 workspaces, max 8 users + 2 guests** per sandbox. ([docs](https://docs.slack.dev/tools/developer-sandboxes/))
- When provisioning, you choose **empty** (1 workspace + 1 demo user) or a **Slack template** which seeds **1 workspace, 7 fake users, 7 channels, system-created threads, replies, and reactions**. ([sandbox sign-up guide](https://slack.dev/slack-developer-sandboxes/), [help center](https://slack.com/help/articles/27390391126803-Manage-Slack-developer-sandboxes))
- Access to all Enterprise org features for testing.
- A "Simple IdP" app lets you add additional auto-generated users beyond the seed.
- Message/file retention is **3 days** for non-archived sandboxes — fine for smoke tests, painful for ongoing scenarios.

So **yes, it can pre-populate channels, users, and messages** for you — that part of your concern is solved by the template option, no manual setup needed.

### Where it falls short for your use case

1. **It is still online, real Slack.** You install your real app, configure real OAuth scopes, manage real tokens, expose your local dev server to the internet (ngrok / Slack's `dev` tunnels) so Slack can deliver Events. Network failures, Slack rate limits, and Slack outages all still bite.
2. **No documented identity-switching UX.** The seed users are not interactive accounts you can casually log in as from a chooser at the top of the screen. Driving multi-user conversations means either (a) creating real human-style accounts and signing in as each (heavy), or (b) scripting `chat.postMessage` with `as_user` / user tokens — workable, but a developer chore, not a click-to-switch UI like you asked for.
3. **Hard caps.** 8 users + 2 guests is tight if you want to simulate "10 people piling into a thread."
4. **Three-day message retention.** Long-running scenario tests evaporate.
5. **You can't iterate offline** (planes, flaky wifi, customer sites).
6. **No deterministic reset.** "Wipe to a clean seed state" is not a button.
7. **No control over wire-level details** when debugging — e.g., replaying a malformed event, injecting an unusual `team_id`, or simulating Slack's edge-case responses.

### Verdict

Use the Slack Developer Sandbox for **final integration / pre-prod sanity checks** against real Slack. Build the Slack Simulator for **the inner dev loop**: fast, offline, identity-switching, deterministic seed/reset, no retention limits, no install/uninstall dance.

---

## 3. Goals & Non-Goals

### Goals

1. Visually convincing single-workspace Slack UI (workspace view mode only) running at `localhost`.
2. Multiple mock users, multiple channels, DMs, threads, reactions — pre-seedable and editable in the UI.
3. **Identity switcher banner** at the top of the SPA to view & act as any mock user.
4. A faithful enough fake Slack platform that an unmodified Bolt-for-JS or raw `@slack/web-api` app, configured to point at `http://localhost:PORT`, can:
   - Call Web API methods (`chat.postMessage`, `conversations.*`, `reactions.*`, `users.*`, `views.*`, `apps.connections.open`, …) and observe results in the UI.
   - Receive Events API HTTP webhooks for events generated in the UI.
   - Connect via Socket Mode and receive the same events.
   - Receive Interactivity payloads (button clicks, modal submissions, slash commands).
5. Mock **Admin / API console** page so the app's signing secret, bot/user tokens, and manifest can be configured.
6. Persistent state (SQLite) with a reset-to-seed button.

### Non-Goals (v1)

- Enterprise Grid, multi-workspace, SSO/SAML, shared channels.
- File uploads with real virus scanning / preview pipeline (we stub to local blob storage).
- Calls, Huddles, Canvases (the doc-style ones), workflow builder.
- Pixel-perfect parity with every Slack screen — only the **Workspace view** (channel list + main pane + thread pane) is in scope.
- Click-through navigation that doesn't matter for app testing (user profile cards, settings preferences, notifications panel).
- A way to load this into the real Slack desktop client.
- Multi-tenant cloud hosting — local-only.
- **In-app alerts, desktop notifications, sound effects, unread badges driving system tray, Slack preferences/settings panels** — none of these. Keep the chrome lightweight.
- **Theme switcher UI / dark mode in v1.** The theming _infrastructure_ exists from day one (see §4) so dark mode is a future drop-in, but no toggle ships now.

### Deliberate simplifications that differ from real Slack

- **Bot channel membership is not enforced.** In real Slack, a bot must be invited to a channel before it can post; `chat.postMessage` returns `not_in_channel` otherwise. The simulator skips this check — bots can post to any channel without being added. The "add bot to channel" step is a one-time manual workspace-admin action, never something a bot's code handles, so enforcing it adds friction with no benefit to the inner dev loop. There is no "+ Add app" button in the channel header; bots listed as channel members in `seed.json` show up in the member count, and that's sufficient.
- **Channel header shows "x members and y apps"** — the member count chip distinguishes human users from apps. `x` is the count of human channel members; `y` is always the total number of configured apps (since bots are allowed everywhere). Hovering shows a stacked-avatar card listing all of them.

### Features deliberately excluded because they don't serve bot/app simulation

The simulator's purpose is to give bot developers a faithful local platform to build against — not to replicate every Slack UI affordance. The following are excluded because they exist for human users navigating Slack, not for bots delivering functionality:

- **`overflow` menu element** — a contextual ⋮ action menu on messages. Used by Slack's own host UI, not something bots send or receive in meaningful Bolt handler patterns.
- **`rich_text` block** — Slack's internal format for user-composed messages. Bots send `mrkdwn` in `section` blocks; `rich_text` only appears if reading back a user's verbatim message. No Bolt app needs to _produce_ it.
- **`datepicker` element** — only relevant for scheduling bots. Not excluded permanently — add it as a targeted slice when a concrete bot requires it.
- **`files.upload` / file attachments** — file handling is a separate concern (blob storage, MIME types, previews) that adds infrastructure complexity without improving the bot-API simulation loop. Bots that just need to reference a file URL can use `chat.postMessage` with a URL in the text.
- **OAuth install flow** — **excluded from scope entirely.** For inner-loop bot development, static pre-configured tokens are strictly superior (no redirect dance, no ngrok, deterministic). The OAuth dance is only needed when testing the install code path itself, which is not a goal of this simulator. If you ever need to test an install flow, use a real Slack Developer Sandbox.
- **Time-travel / scenario scripting / export-import (Phase 12)** — developer ergonomics features, not protocol simulation. Valuable eventually, but none of them affect whether a Bolt app can correctly receive and respond to events.

---

## 4. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (http://localhost:PORT)                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React SPA — Workspace UI + Identity Switcher Banner +   │  │
│  │  Admin/API Console                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │ REST + WebSocket (control plane)    │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│  Local Node server (single process, started by `npx`)           │
│                                                                 │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ Control API  │  │ Fake Slack Web  │  │ Socket Mode WS   │   │
│  │ (SPA <-> BE) │  │ API /api/*      │  │ /ws/socket-mode  │   │
│  └──────┬───────┘  └────────┬────────┘  └────────┬─────────┘   │
│         │                   │                    │             │
│         └─────────┬─────────┴────────────────────┘             │
│                   │                                            │
│           ┌───────▼────────┐       ┌────────────────────────┐  │
│           │ Domain core    │◀─────▶│ Outbound dispatcher    │  │
│           │ (workspace,    │       │ (Events API POST,      │  │
│           │  channels,     │       │  Interactivity POST,   │  │
│           │  messages,     │       │  Slash command POST,   │  │
│           │  reactions,    │       │  Socket Mode envelopes)│  │
│           │  threads,      │       └─────────┬──────────────┘  │
│           │  users, apps)  │                 │                 │
│           └───────┬────────┘                 │                 │
│                   │                          ▼                 │
│           ┌───────▼────────┐       ┌────────────────────────┐  │
│           │ SQLite (better │       │  Your Slack app        │  │
│           │ -sqlite3)      │       │  (Bolt/raw HTTP)       │  │
│           └────────────────┘       │  configured to point   │  │
│                                    │  at localhost:PORT     │  │
│                                    └────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Stack

- **Backend:** Node 20+, TypeScript, Fastify (HTTP), `ws` (WebSocket), `better-sqlite3` (storage), `zod` (validation), `pino` (logs). Signing uses Node's built-in `crypto`.
- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Zustand for state, TanStack Query for data fetching, a small Block Kit renderer (custom React components mapping Slack block JSON → DOM).
- **Distribution:** Published as `slack-simulator` on npm. `npx slack-simulator` starts the server; opens the SPA automatically.
- **Tests:** Vitest for unit/integration; Playwright for SPA smoke tests; a "real-Bolt-app harness" test that boots a tiny Bolt app pointed at the emulator and asserts round-trip behavior.

### Why a single Node process

Co-locating the SPA and the fake Slack API on the same port means:

- One CORS-free origin.
- One token for the whole thing.
- Trivial install (`npx`, no Docker, no orchestration).

### Theming — CSS custom properties only

All colours, spacing, font sizes, and radii are exposed as **CSS custom properties (design tokens)**. No hard-coded hex values anywhere in components — components only ever read `var(--token-name)`. This is non-negotiable from day one, even though only one theme ships in v1.

- **Token namespace:** `--slacksim-color-*`, `--slacksim-font-*`, `--slacksim-space-*`, `--slacksim-radius-*`, `--slacksim-shadow-*`.
- **Default theme** lives at `src/themes/slack-light.css` and is loaded by default — colours match Slack's default light workspace ([Slack's product surfaces](https://slack.design)): aubergine sidebar (`#3F0E40`), white message pane, the standard accent blue (`#1264A3`), Slack's text greys, etc.
- **Adding a new theme later** (e.g., dark mode, brand-themed variant) means dropping a new file like `src/themes/slack-dark.css` that re-defines the same token names under `:root` (or a `[data-theme="dark"]` selector). No component touches needed. Plug-and-play.
- **No theme-switcher UI in v1.** The active theme is the single default. When we eventually want switching, it's one `<link rel="stylesheet">` swap or one `data-theme` attribute change at the root — already wired for.
- Tailwind is configured to read these CSS variables via its `theme.extend.colors` block so utilities like `bg-sidebar` or `text-primary` resolve to tokens, not literals. This keeps both Tailwind-utility-style and bespoke-CSS-style code on the same theming substrate.
- Sketch of `slack-light.css`:
  ```css
  :root {
    --slacksim-color-sidebar-bg: #3f0e40;
    --slacksim-color-sidebar-fg: #ffffffb3;
    --slacksim-color-sidebar-active: #1164a3;
    --slacksim-color-bg: #ffffff;
    --slacksim-color-fg: #1d1c1d;
    --slacksim-color-fg-muted: #616061;
    --slacksim-color-border: #dddddd;
    --slacksim-color-accent: #1264a3;
    --slacksim-color-mention: #f8e71c;
    --slacksim-font-body: 'Lato', 'Slack-Lato', system-ui, sans-serif;
    --slacksim-space-1: 4px;
    --slacksim-space-2: 8px;
    --slacksim-space-3: 12px;
    --slacksim-radius-sm: 4px;
    --slacksim-radius-md: 8px;
    /* …etc */
  }
  ```
  A lint rule (`stylelint` `declaration-property-value-disallowed-list`) blocks raw hex values outside the `themes/*.css` files, so the substrate can't be circumvented by accident.

---

## 5. How your Slack app connects to the Slack Simulator

**Auth model is deliberately lightweight — this is local-only, not a security boundary.**

- **SPA ↔ backend:** no tokens. The SPA sends `X-Slacksim-Acting-User: U001` and the backend trusts it. Switching identity in the banner just changes that header.
- **Bot ↔ backend:** Bolt/`@slack/web-api` always sends `Authorization: Bearer xoxb-…`, so the emulator maps that token string → installed app. Tokens are **static and pre-generated**, printed at startup; no OAuth dance, no rotation, no UI required.

### Boot flow

```
$ npx slack-simulator
Slack Simulator running at http://localhost:4500
Default app credentials (also written to ./.slack-simulator/credentials.json):
  SLACK_BOT_TOKEN=xoxb-slacksim-default
  SLACK_SIGNING_SECRET=slacksim-secret-default
  SLACK_APP_TOKEN=xapp-slacksim-default
  SLACK_API_URL=http://localhost:4500/api/
```

### Bolt configuration

```ts
import { App } from '@slack/bolt';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  clientOptions: { slackApiUrl: 'http://localhost:4500/api/' },
});
```

For **Socket Mode**, Bolt calls `apps.connections.open` to discover a `wss://` URL. The Slack Simulator returns its own `ws://localhost:PORT/ws/socket-mode?ticket=…` URL and speaks the Socket Mode envelope protocol (`hello`, `events_api`, `interactive`, `slash_commands`, `disconnect`, with `envelope_id` + `ack`).

For **Events / Interactivity over HTTP**, request URLs are taken from the app's manifest (Phase 2) or hard-coded in `apps.json` (Phase 1). The Slack Simulator's outbound dispatcher POSTs to those URLs with proper `X-Slack-Signature` and `X-Slack-Request-Timestamp` headers signed with the per-app signing secret.

Everything else (signed payload shape, retry-on-non-2xx behavior, `response_url` tokens with TTLs) mirrors Slack's documented contract.

---

## 6. Phased Plan

14 phases in total (phases 1–4 and 2.5/2.6 complete; phases 5–12 on the roadmap). Each phase ends in a usable artifact. **Stop and reassess after each phase before starting the next** — feedback on the first usable slice will reshape later phases.

### Phases at a glance

| Phase | Title                                                                                         | Status                                               |
| ----- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1     | Workspace shell + Web API (messages, channels, DMs, identity switching)                       | ✅ Complete                                          |
| 2     | Events API outbound + Socket Mode                                                             | ✅ Complete                                          |
| 2.5   | Database inspector tab                                                                        | ✅ Complete                                          |
| 2.6   | UX polish, bug fixes, and QoL improvements                                                    | ✅ Complete                                          |
| 3     | Interactivity: slash commands, buttons, modals, Block Kit rendering                           | ✅ Complete — Slices A/B/C/D all delivered           |
| 4     | `member_joined_channel` event + Join/Leave Channel UI                                         | ✅ Complete                                          |
| 5     | Incoming Webhooks                                                                             | ✅ Complete                                          |
| 6     | Emoji text rendering + pin/unpin events                                                       | ✅ Complete — Slices A/B both delivered              |
| 7     | Channel lifecycle events (created / archived / renamed)                                       | 🔶 Partial — archive/unarchive done; rename deferred |
| 8     | Link unfurling                                                                                | ✅ Complete                                          |
| 9     | App Home tab (`app_home_opened` + `views.publish`)                                            | 🔲 Planned                                           |
| 10    | Additional Block Kit elements: date/time pickers, checkboxes & radio buttons, rich text input | 🔲 Planned                                           |
| 11    | Message shortcuts                                                                             | 🔲 Planned (investigation phase)                     |
| 12    | Polish, fidelity, and developer ergonomics                                                    | 🔲 Planned                                           |
| 13    | Accessibility: keyboard navigation & screen reader support                                    | 🔲 Planned                                           |

---

### Phase 1 — Workspace shell + Web API for messages, channels, DMs, identity switching (≈ MVP)

**Goal:** Visually credible workspace UI; your bot can `chat.postMessage` and `conversations.list` against the emulator and you see results live.

Backend:

- Node + Fastify + SQLite scaffold. Single `npx` entry point.
- Domain model: `workspace`, `user`, `channel` (public/private/im/mpim), `channel_member`, `message`, `reaction`, `app` (installed apps), `token` (bot/user/app tokens).
- Web API endpoints (subset, full Slack response shapes):
  - `auth.test`
  - `users.list`, `users.info`, `users.conversations`
  - `conversations.list`, `conversations.info`, `conversations.history`, `conversations.replies`, `conversations.create`, `conversations.members`, `conversations.open` (DMs)
  - `chat.postMessage`, `chat.update`, `chat.delete`, `chat.postEphemeral`
  - `reactions.add`, `reactions.remove`, `reactions.get`
- Token validation + `X-Slack-Signature` verification helpers (used in later phases for inbound; in phase 1 we only generate signatures for outbound).
- Control-plane REST: seed/reset, list apps, create app, list users, create user, etc.

Frontend:

- Layout: left sidebar (workspace name + channel list + DM list), main pane (message list + composer), right pane stub for threads.
- **Global control bar at the top** — the emulator's primary nav, persistent across all views:
  - **Left:** identity switcher dropdown ("Viewing as: @ada") — every mock user listed, including the seeded bot. Switching it just changes the `X-Slacksim-Acting-User` header the SPA sends; the "compose" author and unread state follow.
  - **Middle:** **pill-style segmented tab switcher** for `Workspace | API/Admin | Logs`, modelled on [this Dribbble mockup](https://dribbble.com/shots/9344651-Tab-switch). The three tabs sit inside a single rounded-pill container with a subtle inset background; the active tab has a filled "thumb" that animates horizontally on switch (CSS transform + transition, no JS animation library). Inactive tab labels are muted; the active tab label flips to high-contrast. All colours/radii come from the design tokens (`--slacksim-color-*`, `--slacksim-radius-*`). In Phase 1 the Admin and Logs tabs are visible but show a "coming in Phase 2" placeholder when selected — the chrome ships now so muscle memory and routing are in place.
  - **Right:** **Reset workspace** button (wipes back to `seed.json`).
- Compose & send a message → POST to control-plane → server persists → server pushes via internal WebSocket → SPA updates live.
- **Channel creation modal** — single modal collects both the channel name **and** the list of users to add (multi-select against the workspace's users), with a "Private channel" toggle. Submit creates the channel and adds the selected members atomically; the SPA navigates to the new channel on success. No two-step "create then invite" flow.
- Emoji reactions (subset — pick any name, render as `:name:` if no image).
- Threads: open a thread in the right pane; reply.
- **Avatars via [DiceBear](https://www.dicebear.com), `thumbs` style.** Deterministic SVG seeded from each user's username. The renderer cycles through **every background colour the `thumbs` style ships with, excluding `transparent`** (set `backgroundType: 'solid'` and pass the full palette via `backgroundColor: ['...all-non-transparent-colours...']`) so users in the workspace get visually distinct chips at a glance. Rendered in-process — no runtime network calls.
- **All visual styling reads CSS design tokens** (see §4 "Theming"). No hex literals in components. Ships the default `slack-light` theme only; no theme-switch UI.
- **Lightweight surface — deliberately omitted from Phase 1 (and v1 in general):**
  - No **status / presence editing** UI (no "update your status", no away/active toggle).
  - No **"Later" / saved-items / reminders** affordances.
  - No **"Files"** sidebar entry, file picker, or attachment composer.
  - No **channel sections / custom sidebar groupings / collapsible category folders** — only the default groupings (Channels, Direct Messages, Apps) are shown.
  - No **draft messages** persistence and no **scheduled messages** flow.
  - No notification/alert chrome — no toasts, no unread-count badges driving system tray, no sound effects, no "do not disturb", no preferences modal.

Seed & default app:

- **`seed.json`** is the source of truth for initial workspace state. Default ships with the repo and **must seed at least 5 users** so identity-switching feels real out of the box. `--seed ./my-scenario.json` overrides. Shape (sketch):
  ```jsonc
  {
    "workspace": { "name": "Slack Simulator Test", "domain": "slacksim" },
    "users": [
      {
        "id": "U001",
        "username": "ada",
        "fullName": "Ada Lovelace",
        "email": "ada@slacksim.test",
        "avatarSeed": "ada",
      },
      {
        "id": "U002",
        "username": "alan",
        "fullName": "Alan Turing",
        "email": "alan@slacksim.test",
        "avatarSeed": "alan",
      },
      {
        "id": "U003",
        "username": "grace",
        "fullName": "Grace Hopper",
        "email": "grace@slacksim.test",
        "avatarSeed": "grace",
      },
      {
        "id": "U004",
        "username": "linus",
        "fullName": "Linus Torvalds",
        "email": "linus@slacksim.test",
        "avatarSeed": "linus",
      },
      {
        "id": "U005",
        "username": "margaret",
        "fullName": "Margaret Hamilton",
        "email": "margaret@slacksim.test",
        "avatarSeed": "margaret",
      },
    ],
    "channels": [
      {
        "id": "C001",
        "name": "general",
        "type": "public",
        "members": ["U001", "U002", "U003", "U004", "U005", "A001"],
      },
      {
        "id": "C002",
        "name": "random",
        "type": "public",
        "members": ["U001", "U002", "U003", "U004", "U005"],
      },
      { "id": "D001", "type": "im", "members": ["U001", "U002"] },
    ],
    "messages": [
      {
        "channel": "C001",
        "user": "U001",
        "text": "Welcome to the Slack Simulator!",
        "ts": "+0s",
      },
      {
        "channel": "C001",
        "user": "U002",
        "text": "Looks great.",
        "ts": "+5s",
        "reactions": [{ "name": "tada", "users": ["U001", "U003"] }],
      },
      {
        "channel": "C001",
        "user": "U003",
        "text": "Ready when you are.",
        "ts": "+12s",
      },
    ],
  }
  ```
  Message timestamps are relative offsets resolved at seed time so scenarios stay reproducible.
- **`apps.json`** ships a single default app but supports **multiple apps** in the same file — each with its own unique tokens, signing secret, and request URL. The simulator routes events to each app independently based on its subscribed events. Shape:
  ```jsonc
  {
    "apps": [
      {
        "id": "A001",
        "name": "Default Bot",
        "botUserId": "B001",
        "botUserName": "default-bot",
        "botToken": "xoxb-slacksim-default",
        "appToken": "xapp-slacksim-default",
        "signingSecret": "slacksim-secret-default",
        "requestUrl": "http://localhost:4001/slack/events",
        "subscribedEvents": ["message", "app_mention"],
        "socketModeEnabled": false,
      },
      {
        "id": "A002",
        "name": "Second Bot",
        "botUserId": "B002",
        "botUserName": "second-bot",
        "botToken": "xoxb-slacksim-second",
        "appToken": "xapp-slacksim-second",
        "signingSecret": "slacksim-secret-second",
        "requestUrl": "http://localhost:4002/slack/events",
        "subscribedEvents": ["message"],
        "socketModeEnabled": false,
      },
    ],
  }
  ```
  Token values are arbitrary strings — there is no real Slack validation. The only constraint is that `botToken`, `appToken`, and `id` must be unique across apps so the simulator can route correctly. After editing `apps.json`, hit **Reset workspace** to reseed.

Test:

- The default app's tokens are printed at startup and written to `./.slack-simulator/credentials.json`. Boot a tiny Bolt app pointed at the emulator using those credentials (the default bot is pre-seeded into `#general` via `seed.json`). Have it react with 👍 to every `app_mention` and reply with "hello @user". Verify in the SPA.

**Exit criteria:** You can drive your bot's outbound Web API calls against the emulator and see the result in the SPA, switching identities freely from the top banner. No admin UI required.

### Phase 2 — Events API outbound + Socket Mode

**Goal:** Your bot receives events from the emulator. This is the big one — flips the integration from "outbound-only" to fully bidirectional.

Backend:

- Outbound dispatcher: on every domain event (message posted, reaction added, channel created, member joined), build the corresponding Slack event payload (`message`, `app_mention`, `reaction_added`, `member_joined_channel`, …) and:
  - **HTTP mode:** POST to each subscribed app's request URL, with `X-Slack-Signature` + timestamp signed via that app's signing secret. Implement Slack's 3x retry-with-backoff on non-2xx.
  - **Socket Mode:** push as an envelope over the per-app WebSocket; track `envelope_id` ack within the 30 s window.
- `apps.connections.open` returns a per-app `ws://localhost:PORT/ws/socket-mode?ticket=…` URL.
- WebSocket server speaks Slack's Socket Mode framing: `hello` on connect, `events_api`/`interactive`/`slash_commands` envelopes server→client, `{envelope_id, payload}` acks client→server, periodic `disconnect`-warning support.
- Per-app event subscription config (which events does this app receive?).

Frontend:

- **API/Admin tab** in the top control bar fills in with a two-column layout modelled on the real `api.slack.com` app console:

  **Left sidebar:**
  - An **app/bot dropdown** at the top showing the currently selected app. The dropdown item displays the app's DiceBear avatar (same seed as used in the workspace chat) alongside the app name. Clicking opens a list of all configured apps — each with its avatar and name — so you can switch context.
  - Below the dropdown, a list of **section links** for the selected app: `Credentials`, `Event Delivery`, `Quickstart`. Clicking a link scrolls/jumps to the corresponding section in the main pane. Active section is highlighted with an accent left-border, matching the real Slack console's nav style.

  **Main pane (right, scrollable):** sections for the selected app —
  - **Credentials** — copy-to-clipboard fields for Bot Token (`SLACK_BOT_TOKEN`), App Token (`SLACK_APP_TOKEN`), Signing Secret (`SLACK_SIGNING_SECRET`), and API Base URL. Shown immediately on load, no interaction needed.
  - **Event Delivery** — Socket Mode toggle, Request URL input (shown only when Socket Mode is off), subscribed events checkboxes, Save button.
  - **Quickstart** — pre-filled Bolt code snippet using the selected app's actual token values.

  Switching apps in the sidebar dropdown re-renders all three sections with that app's data. No page reload — pure client-side state swap.

- **Logs tab** fills in: every Events/Interactivity payload sent to an app, with status (2xx / retry / failed), full payload body, and request/response headers — invaluable for debugging. Inbound Web API calls (bot → emulator) also logged, with method, args, and response.

Test:

- Bolt app in Socket Mode connects → emulator pushes a `message` event when a user types in the SPA → bot's handler fires.
- Same in HTTP Events mode against a small Bolt app on a different port.

**Exit criteria:** A real Bolt app receives events from the emulator and responds, in both transports.

### Phase 2.5 — Database inspector tab

**Goal:** A built-in, read-only window into the SQLite database that backs the simulator. Useful for debugging state, understanding the schema while building bots, verifying bot-driven writes actually landed, and inspecting tokens/credentials at a glance — without needing an external SQLite client.

**Rationale:** The simulator already persists everything in `./.slack-simulator/simulator.db` via `better-sqlite3`. Today there's no way to see what's in it without attaching a separate tool. Surfacing the DB inside the simulator itself closes the debugging loop — when something looks wrong in the SPA, you can immediately answer "what does the server actually have?" in one click.

Backend:

- Read-only control-plane endpoints (acting-user header required, same as other `/_control/*` routes):
  - `GET /_control/db/tables` → list of tables with row counts and column metadata, sourced from `sqlite_master` + `PRAGMA table_info(<table>)`.
  - `GET /_control/db/tables/:name?limit=100&offset=0&orderBy=<col>&order=asc|desc` → paginated rows from a single table.
  - `POST /_control/db/query` with `{ sql: string }` → run an arbitrary **read-only** statement. Hard guardrails: parse the SQL with a lightweight whitelist (must start with `SELECT` or `WITH … SELECT`, no `;` chains, statement timeout via `db.prepare(...).safeIntegers(false)` + `setImmediate` cancel, and `PRAGMA query_only = ON` set on the connection used for ad-hoc queries). Reject anything else with a 400.
- A dedicated read-only DB handle (or a separate `Database` instance opened with `readonly: true`) so the inspector physically cannot mutate state, even if a guardrail is bypassed.
- Schema introspection helper that also returns foreign-key hints (`PRAGMA foreign_key_list`) so the UI can render "this column references X" affordances.

Frontend:

- **New "Database" tab** added to the pill-style tab switcher in the top control bar, after Logs. Order becomes: `Workspace | API/Admin | Logs | Database`.
- `DatabaseView.tsx` layout — split pane:
  - **Left rail:** list of tables (name + row count badge). Click selects a table. Add a database icons for each table.
  - **Right pane (table mode):**
    - Table name header + row count + "Refresh" button.
    - Schema strip: columns with type + PK/NN/FK badges.
    - Sortable, paginated grid (50 rows/page by default). Click a column to sort. JSON-looking cell values get a "view" affordance that expands them in a modal with pretty-printed JSON (covers `apps.subscribed_events`, message payloads, etc.).
    - Foreign-key cells render as clickable chips that jump to the referenced row in the target table.
    - Empty-state copy when a table has no rows.
- All styling reads CSS design tokens — no hex literals. Grid borders use `--slacksim-color-border`, header background `--slacksim-color-bg-secondary`, etc.
- The tab is purely read-only. There are intentionally no edit/insert/delete affordances — mutating state should go through the SPA UI or the simulator's Web API so the right events get dispatched. The DB tab is a _window_, not a _console_.

Test:

- Open the Database tab → all expected tables (`workspace`, `users`, `channels`, `channel_members`, `messages`, `reactions`, `apps`) are listed with non-zero row counts after seed.
- Post a message in `#general` via the SPA → refresh the `messages` table in the DB tab → the new row appears.
- Trigger a bot reply via Bolt → refresh → both the bot's `messages` row and (if reacted) the `reactions` row appear.

**Exit criteria:** Developers can introspect the full simulator state from inside the SPA, and trust that nothing they do in this tab can corrupt workspace state.

### Phase 2.6 — UX polish, bug fixes, and quality-of-life improvements

**Goal:** Harden the simulator's behaviour and improve the visual experience based on real usage feedback after Phases 2 and 2.5 were running end-to-end.

#### Bug fixes

- **Reset workspace returning 400** — Fastify rejected the POST because the SPA sent no body with `Content-Type: application/json`. Fixed by sending an empty JSON body `{}`. UI now reloads automatically after a successful reset.
- **Duplicate messages on reconnect** — Orphaned WebSocket reconnect timers were firing after the hook had already unmounted, causing a second connection to accumulate alongside the first. Fixed with a `stopped` boolean guard in the `useRealtimeWS` hook cleanup function.
- **Offline bot blocking other bots** — The outbound dispatcher was dispatching events to apps sequentially; a single slow or unreachable bot (3× retry backoff) blocked all subsequent apps from receiving events. Fixed by switching to `Promise.all` so every app's dispatch runs concurrently.
- **Bot DMs not appearing in the sidebar** — Two separate bugs: (1) `conversations.open` did not include the calling bot's own user ID in the member set, so the lookup never matched an existing DM channel; (2) newly created DM channels were not broadcast to the client via the `channel_created` WebSocket event. Both fixed.
- **`chat.postMessage` ignoring a user ID as the channel** — Bots that pass a user ID (e.g. `U001`) as the `channel` argument instead of a channel ID now trigger an automatic DM open/lookup before posting, matching real Slack behaviour.
- **Bot avatars incorrect in thread reply stack and DM sidebar** — Both components only looked up avatars in the `users` list. Added a fallback lookup in `apps` using `botUserId` / `botUserName` as the DiceBear seed.
- **`@hyphenated-bot-name` not highlighted as a mention** — The mention-splitting regex used `\w+` which does not match hyphens. Changed to `[\w-]+`.
- **Mention autocomplete showing only one bot** — A global `.slice(0, 6)` was applied before bots were prepended to the suggestion list, leaving at most one bot slot. Bots are now listed first with no cap; human users are capped at 5.

#### New features

- **`<#C001>` channel mentions rendered as clickable pills** — The message renderer now recognises Slack's `<#CXXX>` and `<#CXXX|name>` formats and renders them as styled, clickable `#channel-name` chips that navigate to the referenced channel.
- **@mention hover tooltip (ID card)** — Hovering any `@mention` in a message shows a small floating card with the user or bot's avatar, full name, and username. The card is portalled to `document.body` so it is never clipped by overflow containers.
- **Unread DM badge** — When a bot (or another user) sends a message to a DM channel that is not currently active, the DM entry in the sidebar gains bold/bright text and a pink-red counter badge showing the number of unread messages. Clicking the DM clears the badge. Badge and counts are also cleared on workspace reset.
- **Log filter: "bot offline"** — Added a dedicated filter in the Logs view that shows only outbound events where `status === 0` (network error / no connection), making it easy to distinguish unreachable-bot noise from real application errors.

#### App config enhancements

- **`description` field in `apps.json`** — Each app entry now supports an optional `description` string. It is stored in SQLite (with an idempotent `ALTER TABLE` migration for existing databases) and displayed in the Admin page below the bot's name/avatar row.
- **Admin page bot header** — The Admin page now shows a 48 px bot avatar, the bot's full name in large text, and `@botUserName` as a faint subtitle, followed by the description paragraph if present.

#### Toolbar & chrome revamp

- **Three-column toolbar layout** — The control bar was restructured into three equal `flex: 1` columns so the tab switcher stays perfectly centred regardless of the content on either side.
- **"Slack Simulator" title** — A text title with a building SVG icon was added to the left column of the toolbar.
- **"Buy me a coffee" link and restyled Reset button** — Added a Buy Me a Coffee link on the right; both toolbar buttons use the tab-switcher pill background colour and lighten on hover, with no visible border. Vertical padding matches the tab switcher height.

#### Sidebar & identity switcher

- **Identity switcher moved to sidebar footer** — Relocated from the toolbar to a fixed footer at the bottom of the left sidebar, keeping it scoped to the workspace view where it is relevant.
- **Full-width identity switcher** — The switcher now spans the full sidebar width (with small margins), displays the acting user's full name in bold, their `@username` in faint text below, a 35 px avatar, and a right-aligned animated caret (CSS `transform: rotate()` transition) that points up when the dropdown is open and down when closed.
- **Dropdown opens upward** — The dropdown is positioned above the switcher so it never overlaps the workspace content.

#### Channel list icons

- **Lucide SVG icons for channel types** — The emoji `#` and `🔒` placeholders were replaced with properly sized (14 × 14) Lucide `Hash` and `Lock` SVG icons, vertically aligned with the channel name text.

#### Thread pane

- **"Reply in thread" button hidden inside thread pane** — The hover action button that opens a thread is suppressed when a message is already being rendered inside the thread pane, mirroring Slack's behaviour (threads cannot be nested).

**Exit criteria:** All bugs listed above are resolved; new UX features are live and consistent with the simulator's design-token theming rules (no hex literals in component files).

---

### Phase 3 — Interactivity: slash commands, buttons, modals, Block Kit rendering

**Goal:** Block Kit messages from your bot render in the SPA; user clicks trigger Interactivity callbacks; modals open and submit.

---

#### Scope decision: what this phase does and does not cover

This phase is scoped to **bot and app simulation** — the surfaces a Bolt/raw-API bot actually uses when driving interactions. It deliberately excludes Slack features that exist primarily for human users composing messages or navigating the workspace UI, because those are not part of the bot development loop this simulator targets.

**Explicitly out of scope for Phase 3 (and v1 overall):**

- **`overflow` menu element** — the ⋮ contextual action menu. Used almost exclusively as a host-app affordance on messages (edit, delete, share) rather than something bots programmatically send or receive. No Bolt handler pattern depends on it.
- **`rich_text` block** — Slack's internal format for user-composed formatted text. Bots virtually never _send_ `rich_text` blocks; they send `mrkdwn` in `section` blocks. You only encounter `rich_text` if reading back a user's verbatim message and re-posting it — an edge case that doesn't affect bot logic. Rendering it would require a full inline-format parser for no practical gain.
- **`datepicker` element** — only relevant if a bot schedules events or reminders. Not needed for the bots targeted by this simulator (command-driven, polling, form-based). Can be added later as a targeted slice if a concrete bot needs it.

---

#### Slice A — Block Kit rendering ✅ delivered

**Backend:**

- `chat.postMessage` accepts a `blocks` array (or JSON-encoded string, as sent by `@slack/web-api`) and persists it to the `messages.blocks` column via an idempotent `ALTER TABLE` migration.
- `chat.update` now also accepts a `blocks` array, allowing bots to replace the Block Kit content of an existing message in-place (e.g. updating vote tallies in a poll message).
- `parseBlocks()` helper handles both array and string forms of the `blocks` field.

**Frontend:**

- `BlockKit.tsx` — custom React renderer for: `section` (text + fields + accessory), `header`, `divider`, `context` (text + image elements), `image`, `actions` (buttons with primary/danger/default styles).
- `renderMrkdwn()` — tokenises Slack mrkdwn: `*bold*`, `_italic_`, `~strike~`, `` `code` ``, `<url|label>`, `<@U001>` (MentionChip), `<#C001>` (ChannelChip), `<!here>` / `<!channel>` broadcast pills, line breaks.
- `MentionChip` and `ChannelChip` extracted as shared components used by both plain-text messages and Block Kit blocks. Both show hover ID-card tooltips portalled to `document.body`.
- Message body: if `blocks` present → render `<BlockKit>`; else → render plain mrkdwn text.

---

#### Slice B — Slash commands ✅ delivered

**Backend:**

- `slashCommands` array added to `apps.json` schema, `App` type, and `apps` SQLite table (idempotent migration). Each entry supports an optional `usage` string (e.g. `"[text]"`, `"[question] [option1] [option2] ..."`) displayed as a hint in the autocomplete dropdown.
- `src/server/slashCommands.ts` — `dispatchSlashCommand()` routes to the owning app via HTTP POST (form-encoded, `X-Slack-Signature` signed) or Socket Mode (`slash_commands` envelope with `accepts_response_payload: true`); immediate ack payload posted to channel.
- `response_url` token store — 30-min TTL in-memory map; `POST /_response_url/:token` registered for deferred bot responses.
- `POST /_control/slash_command` — resolves owning app by command name, resolves `@username` → `<@userId>` and `#channelname` → `<#channelId>` in the text before dispatch.
- Socket Mode `enqueueSocketModeSlashCommand()` added; ack handler updated to capture `responsePayload`.

**Frontend:**

- Composer detects `/` at the start of input and shows a slash-command autocomplete dropdown: app avatar, command name bold, `App · {name} · {description}` subtitle — matching real Slack's dropdown style. If the command declares a `usage` field in `apps.json` (e.g. `"[question] [option1] [option2] ..."`) it is displayed inline beside the command name as a faint hint, matching real Slack's shortcut picker style.
- Tab / ↓ or click selects a command; Escape clears. `@` mention detection suppressed only while typing the command name (before the first space) — works normally in command args.
- On send: text starting with `/` is parsed as `command + args` and dispatched as a slash command instead of a chat message (slash commands are not posted to the channel, matching real Slack behaviour).
- Admin page **Slash Commands** section added per app — shows a table of `command → description`, or a note if none registered.

---

#### Slice C — Block Kit interactivity ✅ delivered

**Backend:**

- `src/server/interactivity.ts` (new module) — `trigger_id` store (5-min TTL), modal store (viewId → `{ view, appId }`), `dispatchBlockActions()`, `dispatchViewSubmission()`, `dispatchViewClosed()`, `openModal()`.
- `POST /api/views.open` — validates `trigger_id`, stores modal, broadcasts `modal_open` WsEvent to SPA.
- `POST /_control/block_action` — looks up app from `appId`, generates `trigger_id`, dispatches full Slack-spec `block_actions` payload via HTTP or Socket Mode `interactive` envelope.
- `POST /_control/view_submit` — collects `state.values`, dispatches `view_submission`; handles `response_action: errors` to return per-field validation errors without closing the modal.
- `POST /_control/view_close` — dispatches `view_closed`, removes modal from store.
- Socket Mode `enqueueSocketModeInteractive()` added for `interactive` envelope type.

**Frontend:**

- Buttons in `actions` blocks are now clickable when `action_id` and `appId` are present — click dispatches `block_actions` to owning app.
- `BlockKit` component accepts `channelId`, `messageTs`, `appId` props threaded from the parent message.
- `SlackModal.tsx` — renders `ModalView`: display blocks via `BlockKit`, `input` blocks (`plain_text_input`, single-line and multiline) with live state, per-field validation error display, submit/cancel footer.
- `activeModal` state in Zustand store; `applyWsEvent` handles `modal_open` and `modal_close`.
- `SlackModal` rendered at app root when `activeModal` is set.
- Client API: `postBlockAction`, `submitView`, `closeView`.

---

#### Slice D — Select menus and modal updates ✅ delivered

**Goal:** Enable bots to use dropdown select menus in messages and modals, and to update or stack modals for multi-step flows.

**Backend:**

- `views.update` API endpoint (`POST /api/views.update`) — replaces the blocks/title/submit of an already-open modal in-place, broadcasting a `modal_update` WsEvent to the SPA. Bot uses the `view_id` returned from `views.open` or present in `view_submission`.
- `views.push` API endpoint (`POST /api/views.push`) — pushes a new modal on top of the current one using a `trigger_id`. Store becomes a stack per-user session; broadcasts `modal_push` WsEvent.
- `block_actions` dispatch extended to fire on `static_select` change events (same `/_control/block_action` endpoint, `type: "static_select"` in the action).

**Frontend:**

- `static_select` element renderer — renders as a native `<select>` styled to match Slack's dropdown appearance. Fires `block_actions` on change (not on submit), passing `selected_option.value` as the action value.
- `static_select` as a modal input element — renders inside `input` blocks; value collected in `state.values` on submit.
- Modal stack in the store — `activeModals: ModalEntry[]` replaces `activeModal: ModalEntry | null`; `SlackModal` renders the top of the stack.
- `views.update` WsEvent handler — replaces top-of-stack modal in place (title, blocks, submit/close labels update without closing/reopening the overlay).
- `views.push` WsEvent handler — pushes new modal onto stack; back navigation (close button on a stacked modal) pops the stack and fires `view_closed` for the dismissed view only.

**Demo scenario (end-to-end test):**

1. `/polly "Favourite language?" "TypeScript" "Python" "Rust"` → bot posts a poll with a `static_select` per user instead of buttons (or in addition to buttons).
2. User selects an option from the dropdown → `block_actions` fires → bot calls `chat.update` with updated vote tallies.
3. A "Settings" button opens a modal → bot calls `views.push` to add a "Confirm settings" step on top → user submits → both views close.

---

#### App Home tab → Phase 9

The App Home tab (`views.publish` + `app_home_opened`) is a distinct, self-contained surface. It is scoped to **Phase 9** — see that section for the full spec.

---

**Exit criteria (full Phase 3):** End-to-end interactive workflow — slash → modal with inputs and selects → posted blocks → button/select click → `chat.update` with new blocks — works against a real Bolt app. Multi-step modal flow (`views.push` / `views.update`) also verified end-to-end. ✅

### Phase 4 — `member_joined_channel` event ✅ Implemented

**Goal:** Dispatch `member_joined_channel` to subscribed bots when a user joins a channel, enabling onboarding and welcome-bot flows to be tested in the simulator.

Backend:

- `POST /_control/channels/:id/join` — adds the acting user to the channel, inserts a `channel_join` system message, broadcasts `channel_updated` + `message_new` WsEvents to the SPA, and dispatches a `member_joined_channel` event payload to all subscribed apps (HTTP + Socket Mode).
- `POST /_control/channels/:id/leave` — removes the acting user from the channel, inserts a `channel_leave` system message, and broadcasts `channel_updated` + `message_new`.

Frontend:

- **Join / Leave Channel button** in the channel header (non-DM channels only). Green "Join Channel" when the acting user is not a member; red "Leave Channel" when they are. Clicking either triggers the respective control-plane endpoint.
- System messages (`subtype: 'channel_join'` / `'channel_leave'`) rendered in the message list: full avatar + name + timestamp layout, with message text in muted colour.

**Exit criteria:** A Bolt app subscribed to `member_joined_channel` receives the event (HTTP or Socket Mode) when the acting user clicks "Join Channel" in the SPA. ✅

---

### Phase 5 — Incoming Webhooks

**Goal:** Support the incoming webhook integration pattern — a simple one-way HTTP POST URL that delivers a message into a channel. This is the most common integration pattern for monitoring, CI/CD, and alerting tools.

Backend:

- When an app is configured with `incoming-webhook` scope (or a `webhookChannelId` field in `apps.json`), generate a unique webhook URL: `http://localhost:PORT/services/:appId/:channelId/:token`.
- `POST /services/:appId/:channelId/:token` — accepts a JSON body with `text` and/or `blocks`, inserts the message as the app's bot user, broadcasts `message_new` WsEvent to the SPA, and dispatches `message` events to subscribed apps.
- Webhook URLs listed in the Admin page per app.

Frontend:

- **Incoming Webhooks** section on the Admin page per app — shows the generated webhook URL with a copy button and the target channel name.

**Exit criteria:** A `curl` POST to the generated webhook URL results in a visible message in the simulator's SPA from the app's bot user.

---

### Phase 6 — Emoji text rendering + pin/unpin events ✅ Complete

**Goal:** Render Slack emoji shortcodes (`:tada:`, `:white_check_mark:`) as their text form rather than attempting to render actual emoji images. Also dispatch `pin_added` / `pin_removed` events to bots when messages are pinned or unpinned.

#### Slice A — Emoji text rendering ✅ delivered

- `renderMrkdwn` detects `:word:` tokens and renders them as styled inline chips, falling back to `:shortcode:` text if the emoji is not in the workspace emoji map.
- Reaction badge labels also use the emoji map (or fall back to `:name:` text).

#### Slice B — Pin events ✅ delivered

Backend:

- `POST /_control/messages/:id/pin` — marks the message as pinned in SQLite, dispatches `pin_added` payload to subscribed apps (HTTP + Socket Mode).
- Same endpoint with `pinned: false` unmarks and dispatches `pin_removed`.
- Full Slack-spec `pin_added` / `pin_removed` payload including `pinned_info`, `pin_count`, and `has_pins`.

Frontend:

- Pin / unpin affordance in the message hover actions (alongside the existing reaction button). Icon highlights when message is pinned.
- Pinned messages show a 📌 indicator in the message row.

**Exit criteria:** Bots receive `pin_added` / `pin_removed` events. Emoji shortcodes in messages render as `:shortcode:` text. ✅

---

### Phase 7 — Channel lifecycle events (created / archived / renamed)

> **Partially delivered.** Archive/unarchive is now implemented end-to-end. Channel rename remains deferred — low developer demand for that specific slice.

**Goal:** Dispatch `channel_created`, `channel_archive`, and `channel_rename` events to subscribed bots when those operations happen in the simulator, enabling governance and compliance bots to be tested.

#### Archive / Unarchive ✅ delivered

Backend:

- `POST /_control/channels/:id/archive` — reads current `archived` state, flips it, updates SQLite, broadcasts `channel_updated` WsEvent to the SPA.
- Inserts a system message (`subtype: 'channel_archive'` / `'channel_unarchive'`, text: `"archived this channel"` / `"unarchived this channel"`) and broadcasts `message_new`.
- Dispatches `channel_archive` or `channel_unarchive` Slack event to all subscribed apps (HTTP + Socket Mode).
- Both events added to `ALL_EVENTS` in the Admin page so apps can subscribe to them via checkboxes.

Frontend:

- **Archive / Unarchive button** in the channel header (non-DM channels only), to the right of Leave Channel.
  - When not archived: outline style (`ss-header-btn-outline`), label "Archive" — border darkens on hover.
  - When archived: filled green (`ss-header-btn-filled`), label "Unarchive" — brightens on hover.
  - Leave Channel button is hidden when the channel is archived (can't leave an archived channel).
- System messages for `channel_archive` and `channel_unarchive` subtypes render with the same muted avatar + name + text style as join/leave messages.

#### Channel rename ⏸ Deferred

- `channel_rename` event and rename affordance remain deferred — no concrete bot use case identified.

**Exit criteria:** A Bolt app subscribed to `channel_archive` / `channel_unarchive` receives those events when the acting user clicks Archive / Unarchive in the SPA. ✅

---

### Phase 8 — Link unfurling ✅ Complete

**Goal:** When a user posts a URL that matches a pattern registered by an app, the simulator dispatches a `link_shared` event to the app, and the app's `chat.unfurl` call renders an attachment preview below the message. Unclaimed URLs (no matching app) are scraped for Open Graph metadata and auto-previewed.

Backend:

- `unfurlDomains` array added to `apps.json` schema, `App` type, and `apps` SQLite table (idempotent migration). Apps opt in by listing specific domains (e.g. `["giphy.com"]`).
- `processUnfurls()` helper — extracts HTTP/HTTPS URLs from every new message, groups them by owning app (first app whose `unfurlDomains` matches the URL's hostname wins), dispatches `link_shared` events per owning app, and OG-scrapes any unclaimed URLs automatically.
- `link_shared` event payload — includes `channel`, `user`, `message_ts`, `event_ts`, and a `links` array of `{ domain, url }` objects, matching Slack's documented payload shape. Dispatched via HTTP or Socket Mode to the owning app.
- `POST /api/chat.unfurl` — accepts `channel`, `ts`, `unfurls` (a URL → attachment/Block Kit block map); stores unfurl data in a new `messages.unfurls` column; broadcasts `message_updated` WsEvent to the SPA.
- OG scraper — fetches unclaimed URLs (5 s timeout), parses `og:title`, `og:description`, `og:image` from `<meta>` tags, and stores them as simple attachment objects — no app involvement required for basic link previews.
- `unfurls` column added to `messages` table (idempotent `ALTER TABLE` migration).

Frontend:

- Unfurl attachments rendered below the message body as left-bordered cards. Supports two formats:
  - **Simple attachment** — `title` (linked via `title_link`), description `text`, optional `image_url`. Auto-generated from OG scraping for unclaimed URLs.
  - **Block Kit unfurl** — the `blocks` array inside the attachment is rendered via the existing `BlockKit` component, so apps can use full Block Kit layouts in their unfurl previews (buttons, sections, context, etc.).
- `message_updated` WsEvent updates the unfurl data on an existing message in-place without a full list reload.

**Exit criteria:** A Bolt app subscribed to `link_shared` with matching `unfurlDomains` receives the event when a user posts a matching link; calling `chat.unfurl` renders the preview below the message. Unregistered URLs display automatic OG previews when metadata is available. ✅

---

### Phase 9 — App Home tab (`app_home_opened` + `views.publish`)

**Goal:** Every Slack app gets a "Home" tab in its DM view — a persistent, per-user canvas the bot controls entirely via `views.publish`. Dispatching `app_home_opened` when the user opens the tab enables bots to render a custom home screen (dashboards, personal settings, onboarding checklists).

Backend:

- `app_home_opened` event dispatched when the acting user opens a bot's DM and activates the "Home" tab.
- `POST /api/views.publish` — stores the Block Kit view per `(appId, userId)` pair in SQLite; broadcasts a `home_updated` WsEvent to the SPA.

Frontend:

- "Home" tab rendered inside the bot DM pane (alongside the existing message list). Tab bar: `Messages | Home`.
- Home tab shows the stored Block Kit view for the `(actingUser, app)` pair, or an empty-state prompt ("This app hasn't set up its Home tab yet.") if the bot hasn't published one.
- Switching to the Home tab triggers the `app_home_opened` event dispatch.

**Exit criteria:** A Bolt app that calls `views.publish` in its `app_home_opened` handler renders its home view in the simulator's DM pane when the acting user opens the Home tab.

### Phase 10 — Additional Block Kit elements: date/time pickers, checkboxes & radio buttons, rich text input

**Goal:** Fill in the Block Kit element gaps that are most commonly needed by scheduling, survey, and note-taking bots — surfaces that real bots hit quickly once they outgrow basic buttons and text inputs.

#### Date & time pickers

**Backend:**

- `block_actions` dispatch extended to fire on `datepicker` and `timepicker` change events, passing `selected_date` / `selected_time` in the action payload.

**Frontend:**

- `datepicker` element renderer — renders a native `<input type="date">` styled to match Slack's picker appearance. Fires `block_actions` on change.
- `timepicker` element renderer — `<input type="time">` with the same styling + dispatch.
- Both work as standalone `actions` block elements and as modal `input` block elements (value collected in `state.values` on submit).

#### Checkboxes & radio buttons

**Backend:**

- `block_actions` dispatch extended for `checkboxes` (multi-select, fires on every check/uncheck) and `radio_buttons` (single-select, fires on change). Both pass `selected_options` arrays in the action payload.

**Frontend:**

- `checkboxes` element renderer — a styled list of labelled checkboxes. Each check/uncheck fires `block_actions`.
- `radio_buttons` element renderer — a styled list of radio inputs. Change fires `block_actions`.
- Both work in `actions` blocks and as modal `input` elements.

#### Rich text input

**Backend:**

- `rich_text_input` element in a modal `input` block — value submitted as a `rich_text` block object in `state.values` (matching Slack's actual submission format).

**Frontend:**

- `rich_text_input` element renderer — a multiline `<textarea>` that accepts plain text and basic mrkdwn (bold, italic, code). On submit, converts the text to a minimal `rich_text` block with a single `rich_text_section` element.
- No WYSIWYG editor — plain text + mrkdwn shortcodes is sufficient for simulating the bot round-trip without a full rich-text editor library.

**Exit criteria:** A bot using `datepicker`, `timepicker`, `checkboxes`, and `radio_buttons` in messages and modals receives correct `block_actions` payloads. A modal with a `rich_text_input` submits a `rich_text` block in `state.values`.

---

### Phase 11 — Message shortcuts (investigation)

**Goal:** Investigate the feasibility and shape of message shortcuts in the simulator, then implement if the protocol is straightforward. Message shortcuts are triggered from a right-click (or `⋮` menu) on any message — the bot receives a `shortcut` payload with the full message context.

#### Investigation checklist

Before committing to implementation, answer:

1. **Trigger surface:** The real Slack message shortcut lives inside the `⋮` overflow menu on a message. The simulator explicitly excludes the overflow menu element for bots — but message shortcuts are a _developer touchpoint_ (bots register them), not a host-UI affordance. Decide: add a lightweight ⚡ shortcut trigger to the message hover row, separate from the overflow menu itself.
2. **Payload shape:** Confirm the full `shortcut` payload shape (callback_id, trigger_id, message, channel, user) from Bolt's source / Slack docs. No surprises expected but verify before building.
3. **App registration:** Apps currently declare `slashCommands` in `apps.json`. Shortcuts need a similar `messageShortcuts` array: `[{ callback_id, name, description }]`.
4. **Dispatch path:** Same `dispatchInteractive()` path as `block_actions` — reuse or extend.

#### Planned implementation (pending investigation sign-off)

**Backend:**

- `messageShortcuts` array added to `apps.json` schema, `App` type, and `apps` SQLite table (idempotent migration).
- `POST /_control/message_shortcut` — resolves owning app by `callback_id`, generates `trigger_id`, dispatches full Slack-spec `shortcut` payload via HTTP or Socket Mode `interactive` envelope.

**Frontend:**

- ⚡ icon in the message hover action row (beside the existing reaction and thread buttons). Clicking opens a small dropdown listing all registered message shortcuts across all apps.
- Selecting a shortcut dispatches `message_shortcut` to the owning app.
- Admin page **Message Shortcuts** section per app — table of `callback_id → name → description`.

**Exit criteria:** A Bolt app with a `message_action` handler receives the `shortcut` payload when a user triggers a message shortcut from the hover row in the SPA.

---

### Phase 12 — Polish, fidelity, and developer ergonomics

- Visual polish pass: match Slack's typography, spacing, channel-list density, message density, hover affordances. Side-by-side screenshot diffing against real Slack screenshots for the workspace view (in scope) — not modals/admin (out of scope).
- Time-travel: scrub a timeline of all events to replay a scenario.
- Scenario scripting: a small YAML/JSON DSL to deterministically seed users, channels, and a sequence of messages — useful for CI/regression runs.
- Export/import workspace state for sharing with teammates or attaching to bug reports.
- Programmatic control API (`http://localhost:PORT/_slack-simulator/...`) for test frameworks.
- (Stretch) A "Slack response chaos" toggle: inject rate-limit responses, 5xx, slow responses, malformed events, to harden your bot.

---

### Phase 13 — Accessibility: keyboard navigation & screen reader support

**Goal:** Make the simulator fully navigable by keyboard so developers who prefer or require keyboard-driven workflows can operate the entire UI without a mouse. Add ARIA markup so screen readers present a coherent structure.

**Rationale:** Accessibility is a developer ergonomics concern, not a Slack API emulation concern. The simulator's job is to let bot developers test their bots efficiently, and many developers are keyboard-first. A lack of keyboard support also blocks screen-reader users entirely, which conflicts with inclusive development practices.

**Backend:**

- No backend changes required.

**Frontend:**

- **Channel list** — navigable with ↑/↓ arrow keys; Enter selects the focused channel; visible focus ring on each item.
- **Composer** — receives keyboard focus automatically when a channel is selected (no click required); Tab moves focus to the Send button.
- **Slash command autocomplete** — ↑/↓ or Tab moves through suggestions; Enter selects; Escape dismisses and returns focus to the composer.
- **Block Kit buttons and selects** — reachable and activatable via Tab + Enter/Space, matching standard interactive element conventions.
- **Modals** — focus trapped inside the modal while open (Tab cycles through inputs → Submit → Cancel → back to first input); Escape triggers `view_close`; focus returns to the trigger element on close.
- **Thread pane** — openable via keyboard (Enter on the reply-count button); composer inside the thread pane follows the same Tab/Enter conventions.
- **Identity switcher dropdown** — ↑/↓ to navigate users; Enter to switch; Escape to close.
- **Reaction picker** — arrow keys to navigate the emoji grid; Enter to add a reaction; Escape to dismiss.
- **Focus ring** — all interactive elements share a consistent visible focus ring via a new design token `--slacksim-color-focus-ring` (default: `#1264A3` with a 2 px offset, matching Slack's own focus style).
- **ARIA roles and labels:**
  - Left sidebar: `role="navigation"` with `aria-label="Workspace navigation"`.
  - Channel list: `role="list"` with each item `role="listitem"`.
  - Message pane: `role="main"`.
  - Message list: `role="log" aria-live="polite"` — new messages arriving via SSE are announced to screen readers.
  - Modal overlay: `role="dialog" aria-modal="true"` with `aria-labelledby` pointing to the modal title element.
  - Composer: native `<textarea>` with a visually hidden `<label>` for screen reader association.
  - Block Kit buttons: `aria-label` derived from the button's `text` field where the element has no visible label.

**Exit criteria:** A developer can navigate between channels, compose and send a message, trigger a slash command, click a Block Kit button, and submit a modal — all without touching the mouse. All interactive elements have visible focus rings. Screen readers announce page regions and new message arrivals correctly.

---

## 7. Wire-Protocol Concerns & Risks

| Risk                                            | Mitigation                                                                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Slack changes Web API response shapes           | Pin to today's documented shapes; treat as a snapshot of mid-2026 Slack. Add a `compat` map for future drift.                                   |
| Socket Mode envelope details under-documented   | Reverse-engineer from `@slack/socket-mode` source (MIT-licensed). Validate by running it against the emulator.                                  |
| Block Kit renderer is a long tail of edge cases | Phase 3 ships the 80% (section + actions + context + input + modals). Document unsupported blocks with a clear "rendered as raw JSON" fallback. |
| Signing-secret implementation mistakes          | Use Node's `crypto.timingSafeEqual`; copy Bolt's verification algorithm verbatim; unit-test against fixtures from real Slack payloads.          |
| Confusion between "real Slack" and "fake Slack" | Watermark the SPA chrome ("SLACK SIMULATOR — not real Slack") and prefix all token strings with `slacksim-`.                                    |
| `npx` cold-start friction                       | Provide a `--port`, `--db`, `--seed <file>` flag set. Ship a Docker option for CI but not required for local dev.                               |
| Bolt-specific quirks vs raw HTTP clients        | Phase-end integration tests run against both a Bolt app and a raw `@slack/web-api` script.                                                      |

---

## 8. Open Questions

These are not blockers — defaults are fine — but flag if any matter:

1. **Multi-app support in v1?** ✅ Resolved — `apps.json` supports multiple apps out of the box (see Phase 1 seed section). The Admin tab shows an app-selector dropdown so credentials and event config for each app are visible and editable independently. Each bot runs on its own port, uses its own tokens, and the simulator routes events to all subscribed apps simultaneously.
2. **File uploads.** Phase 2 currently ignores `files.upload`. If a meaningful share of your bots send images/snippets, lift this into Phase 3.
3. **Threading + broadcast.** "Also send to channel" toggle on thread replies — small but visible UX detail. Defaulting to _not_ implementing in Phase 1.
4. **Distributing the binary.** Are you the only user, or will teammates run this too? If teammates: invest more in the seed-script DSL (Phase 5) and onboarding docs. If solo: keep it lean.

---

## 9. Anything you missed?

A few things you didn't mention but are worth deciding before build starts:

- **App Home tab.** A lot of Slack apps live in the App Home. Phase 3 includes a minimal renderer for `views.publish`. Flag if you want it earlier.
- **Ephemeral messages** (`chat.postEphemeral`) — included in Phase 1.
- **Pagination.** Slack's `cursor` pagination is annoying but cheap to mock; Phase 1 includes it for `conversations.history` and `users.list`.
- **Rate limits.** No simulated rate limits by default. Added as an opt-in chaos toggle in Phase 5.
- **Message edits/deletes propagating to your bot.** Phase 2 includes `message_changed` / `message_deleted` event subtypes.
- **Bot identity in the SPA.** Bot messages should render with the bot's icon/name, distinct from human users. Phase 1.
- **A "logs" pane.** Phase 2 ships an outbound-event log; consider adding a Web-API inbound log too — would have saved many hours of `console.log`-in-the-bot debugging in real life.

---

## 10. Time & Cost Estimate (Phase 1 + Phase 2)

Rough numbers — agent-built software estimates have wide error bars.

### Time

| Phase                                                                                                               | Solo human engineer | Agent-led with active review                      |
| ------------------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------- |
| Phase 1 (workspace shell, Web API subset, identity switcher, JSON seed, default app, channel/DM/thread/reaction UI) | 2–3 weeks focused   | 3–5 days of agent time across ~1–2 calendar weeks |
| Phase 2 (Events outbound + retries, Socket Mode, Admin manifest UI, Logs pane)                                      | 1.5–2.5 weeks       | 3–5 days                                          |
| **P1 + P2 combined**                                                                                                | **~4–5 weeks**      | **~1.5–2 weeks**                                  |

### Token & dollar cost (agent-led build)

Pricing assumptions: Claude Opus 4.7 at $15/M input, $75/M output, with ~90 % prompt-caching discount on cached reads (effective cached input ≈ $1.50/M).

|                      | Optimistic | Likely    | Pessimistic |
| -------------------- | ---------- | --------- | ----------- |
| Phase 1 only         | ~$150      | **~$400** | ~$900       |
| Phase 2 only         | ~$120      | **~$350** | ~$800       |
| **P1 + P2 combined** | **~$300**  | **~$800** | **~$1,800** |

Levers to lower this:

- Run plumbing work on **Claude Sonnet 4.6** (~5× cheaper); reserve Opus for tricky bits (Socket Mode framing, signing-secret edge cases). Cuts total ~50–60 %.
- Skip the visual-polish loop until everything works functionally — UI tweaking is the most token-hungry activity.
- Catch dead-end debugging early during review; don't let an agent grind on a wrong hypothesis.

**Realistic expectation: ~$600–$1,000 of agent compute for a working P1+P2** with active human review.

---

## 11. References

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
