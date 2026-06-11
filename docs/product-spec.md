---
layout: base
title: Product Specification
toc: true
---

# Product Specification

## What is a Slack Simulator?

It is a local, browser-based simulator that emulates a Slack workspace and Slack platform APIs, so you can develop and test Slack apps/bots end-to-end without installing them into a real workspace.

---

## Does Slack Developer Sandbox already do this?

**Short answer: No.** It provides "seeding a test workspace" but misses being a local emulator you control end-to-end, including switching identity between mock users to script multi-party conversations against an app.

### What Slack Developer Sandbox does give you

A free benefit of the [Slack Developer Program](https://api.slack.com/developer-program) that provisions you a real (but isolated) Slack workspace for app testing:

- Up to **3 workspaces, max 8 users + 2 guests** per sandbox. ([docs](https://docs.slack.dev/tools/developer-sandboxes/))
- When provisioning, you choose **empty** (1 workspace + 1 demo user) or a **Slack template** which seeds **1 workspace, 7 fake users, 7 channels, system-created threads, replies, and reactions**. ([sandbox sign-up guide](https://slack.dev/slack-developer-sandboxes/), [help center](https://slack.com/help/articles/27390391126803-Manage-Slack-developer-sandboxes))
- Access to all Enterprise org features for testing.
- A "Simple IdP" app lets you add additional auto-generated users beyond the seed.
- Message/file retention is **3 days** for non-archived sandboxes — fine for smoke tests, painful for ongoing scenarios.

### Where it falls short

1. **It is still online, real Slack.** You install your real app, configure real OAuth scopes, manage real tokens, expose your local dev server to the internet (ngrok / Slack's `dev` tunnels) so Slack can deliver Events. Network failures, Slack rate limits, and Slack outages all still bite.
2. **No documented identity-switching UX.** The seed users are not interactive accounts you can casually log in as from a chooser at the top of the screen. Driving multi-user conversations means either (a) creating real human-style accounts and signing in as each, or (b) scripting `chat.postMessage` with `as_user` / user tokens — workable, but a developer chore, not a click-to-switch UI.
3. **Hard caps.** 8 users + 2 guests is tight if you want to simulate "10 people piling into a thread."
4. **Three-day message retention.** Long-running scenario tests evaporate.
5. **You can't iterate offline** (planes, flaky wifi, customer sites).
6. **No deterministic reset.** "Wipe to a clean seed state" is not a button.
7. **No control over wire-level details** when debugging — e.g., replaying a malformed event, injecting an unusual `team_id`, or simulating Slack's edge-case responses.

> **Important**:  
> Recommendation is to use the Slack Developer Sandbox for **final integration / pre-prod sanity checks** against real Slack. Use the Slack Simulator for **the inner dev loop**: fast, offline, identity-switching, deterministic seed/reset, no retention limits, no install/uninstall dance.

---

## What Slack Simulator Is

- **A local development tool for Slack app/bot developers** — Run it on your machine, no internet required, no real Slack workspace needed
- **A faithful emulator of the Slack platform APIs** — Bolt apps and raw `@slack/web-api` apps configured to point at `localhost` work as-is
- **A visual workspace UI** — Channel list, message pane, thread pane, DMs, and reactions
- **An identity switcher** — Click to view and act as any mock user; drive multi-user conversations without signing in/out
- **A bidirectional event system** — Your bot receives events (HTTP webhooks or Socket Mode) and can respond via Web API calls
- **A Block Kit renderer** — Sections, headers, dividers, images, buttons, static selects, modals with inputs, and modal stacks
- **A testing sandbox for interactivity** — Slash commands, button clicks, modal submissions, incoming webhooks, link unfurling
- **A stateful, resettable environment** — SQLite-backed persistence with a "Reset workspace" button to restore seed state; no retention limits, no message expiration
- **A multi-app simulator** — Run multiple bots simultaneously, each with independent tokens, signing secrets, and event subscriptions
- **A debugging aid** — Built-in Admin page for credentials/config, Logs tab for event payloads, Database tab for state inspection; full visibility into wire-level details
- **A tool for the inner dev loop** — Fast iteration, offline use, deterministic scenarios, no install/uninstall dance
- **Unlimited mock users** — No hard caps on user count; seed as many users as your scenario requires

> For a full list of developer capabilities, [refer to this document](capabilities.md).

## What Slack Simulator Isn't

- **A replacement for real Slack** — Use Slack Developer Sandbox for final integration tests against the actual platform
- **A multi-workspace or Enterprise Grid simulator** — Single workspace only; no SSO/SAML, shared channels, or org-level features
- **A full-featured Slack client** — No status/presence editing, no files sidebar, no saved items/reminders, no notifications, no preferences panels. We're only building those features into the simulator that will help a Slack App developer to test their app with.
- **A file handling system** — No `files.upload`, no file attachments, no virus scanning, no MIME type handling
- **An OAuth flow tester** — Static pre-configured tokens only; no "Add to Slack" button, no scope negotiation, no install flow testing, thus reducing friction.
- **A real-time collaboration tool** — No Calls, Huddles, or Canvases
- **A Workflow Builder integration** — No custom workflow steps; Slack is deprecating this model anyway
- **A next-gen platform host** — No Deno-based Functions, Triggers, or Datastores
- **An enterprise admin console** — No Admin API, SCIM, Audit Logs, or Discovery API
- **A presence system** — No user status, no active/away states, no "on a call" indicators
- **A file input surface** — No file upload fields in modals
- **A rich text editor** — Bots send `mrkdwn`; `rich_text` blocks are for user-composed messages, not bot output
- **A global shortcuts system** — No ⚡ menu from anywhere; message shortcuts are under investigation and the UI affordance for that will be revisited.
- **An overflow menu host** — The `⋮` menu is a Slack host-UI affordance, not a bot API pattern. If and when message shortcuts are introduced, the UI affordance for that will be revisited.
- **A cloud-hosted service** — Local-only; no multi-tenant deployment, no Docker orchestration
- **A security boundary** — Auth is lightweight (static tokens, trusted headers); this is a dev tool, not a production system
- **Bot channel membership is not enforced** — In real Slack, a bot must be invited to a channel before it can post; `chat.postMessage` returns `not_in_channel` otherwise. The simulator skips this check — bots can post to any channel without being added. The "add bot to channel" step is a one-time manual workspace-admin action, never something a bot's code handles, so enforcing it adds friction with no benefit to the inner dev loop.

---

## Future work

- **Accessibility** — Add ability to navigate the UI using keyboard and additional a11y features.
- **A date/time picker** — Block Kit elements that may be added as a targeted slice later
- **A checkbox/radio button renderer** — Block Kit elements that may be added as a targeted slice later
- **Global and message shortcuts** — Shortcuts as a feature needs to be investigated and it may or may not be added later.
