---
layout: base
title: Slack Developer Capabilities
toc: true
---

# Slack Developer Capabilities

A comprehensive breakdown of everything Slack's platform exposes to developers.

**Simulator support legend:**
| Icon | Meaning |
|------|---------|
| ✅ | Supported — works in the simulator today |
| 🔲 | Planned — on the roadmap in `SPEC.md` |
| ❌ | Not supported — out of scope or deliberately excluded |

**Developer demand legend:**
| Icon | Meaning |
|------|---------|
| 🔥 | High demand — used by the majority of marketplace apps |
| 🟡 | Medium demand — used by a significant subset of apps |
| 🟢 | Low demand — niche or specialised use cases |

---

## Messaging & Posting

| Capability             | What it does                                                 | Example app                             | Simulator                                                                           | Developer demand                                                                                                                       |
| ---------------------- | ------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Bot messages**       | Post as a bot user into any channel                          | Virtually every bot                     | ✅ `chat.postMessage`                                                               | 🔥 High — the baseline capability; every bot that posts anything uses this                                                             |
| **Incoming Webhooks**  | Simple one-way HTTP POST to a channel, no bot token needed   | Grafana alerts, GitHub PR notifications | ✅ `POST /hooks/:token` — declare channels in `apps.json`, URLs shown in Admin page | 🔥 High — the most common integration pattern for monitoring, CI/CD, and alerting tools that don't need bidirectional interaction      |
| **Scheduled messages** | Post a message at a future time via `chat.scheduleMessage`   | Reminder bots                           | 🔲 Planned (Phase 5 / medium priority)                                              | 🟡 Medium — reminder bots, digest bots, and scheduled report tools; common but not universal                                           |
| **Ephemeral messages** | Visible only to one user in a channel (`chat.postEphemeral`) | Polly (private vote confirmations)      | ✅ `chat.postEphemeral`                                                             | 🟡 Medium — useful for confirmations, private feedback, and permission-gated responses; used by a meaningful slice of interactive bots |
| **Message updates**    | Edit a posted message in-place (`chat.update`)               | Live scoreboards, poll tallies          | ✅ `chat.update` (text + blocks)                                                    | 🟡 Medium — essential for live-updating UIs like polls and scorecards, but not needed by simpler post-and-forget bots                  |
| **Message deletion**   | Delete a message (`chat.delete`)                             | Moderation bots                         | ✅ `chat.delete`                                                                    | 🟢 Low — mainly moderation and housekeeping bots; most apps never need to delete their own messages                                    |
| **Threaded replies**   | Reply inside a thread (`thread_ts`)                          | Support ticket bots                     | ✅ Full thread support with reply counts and avatars                                | 🟡 Medium — important for support and Q&A bots that need to keep conversations organised; less relevant for notification-only bots     |

---

## UI Surfaces (Block Kit)

| Capability             | What it does                                               | Example app                            | Simulator                                                        | Developer demand                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Block Kit messages** | Rich layouts — headers, fields, images, buttons            | Almost all modern bots                 | ✅ `section`, `header`, `divider`, `context`, `image`, `actions` | 🔥 High — the standard for any bot that needs more than plain text; used by the vast majority of modern marketplace apps                                        |
| **Modals / Views**     | Pop-up forms with inputs, validation, submission           | Jira issue creator, expense submission | ✅ `views.open`, `views.update`, `views.push`, modal stack       | 🔥 High — the primary pattern for any bot that needs to collect structured input from a user; Jira, Asana, expense tools, HR bots all depend on this            |
| **App Home tab**       | Persistent tab inside the app's DM — like a mini dashboard | Workato, Statsig                       | 🔲 Planned (Phase 9 — `views.publish` + `app_home_opened`)       | 🟡 Medium — popular for apps that want a persistent settings or dashboard surface; less relevant for event-driven bots                                          |
| **Message shortcuts**  | Right-click a message → trigger an action                  | "Create Jira ticket from message"      | 🔲 Planned (Phase 11 — investigation)                            | 🟡 Medium — a very natural UX pattern for productivity apps ("create ticket from this message"); used heavily by Jira, Linear, and task-management integrations |
| **Global shortcuts**   | Lightning bolt ⚡ menu → trigger an action from anywhere   | "New standup", "Log time"              | ❌ Not planned for v1                                            | 🟡 Medium — useful for apps that need a quick-launch affordance not tied to a specific message or channel; common in time-tracking and standup tools            |

---

## Interactivity

| Capability                     | What it does                                              | Example app               | Simulator                                                                                               | Developer demand                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buttons** (`block_actions`)  | Clickable buttons fire payloads to your bot               | Approvals bots, poll bots | ✅ Full `block_actions` dispatch — HTTP + Socket Mode                                                   | 🔥 High — the most widely used interactive element; approve/deny workflows, poll votes, and navigation all rely on buttons                                     |
| **Select menus**               | Dropdown — static, user list, channel list, external data | Assign-to-user dropdowns  | ✅ `static_select` in actions blocks and modal inputs; user/channel/external variants not yet supported | 🔥 High — extremely common in forms and action menus; `users_select` and `channels_select` variants are heavily used by project management and assignment bots |
| **Overflow menus**             | `⋮` menu on a message                                     | Options menus on cards    | ❌ Explicitly excluded — not part of the bot API simulation loop                                        | 🟢 Low — rarely used by bots; mostly a Slack host-UI affordance for built-in actions (edit, delete, share) rather than a developer touchpoint                  |
| **Date / time pickers**        | Calendar picker in a modal or message                     | Scheduling bots           | ❌ Excluded for now — can be added as a targeted slice if needed                                        | 🟡 Medium — essential for scheduling and reminder bots; a meaningful slice of calendar and time-management integrations depend on this                         |
| **Checkboxes & radio buttons** | Multi-select or single-select in modals                   | Survey bots               | ❌ Not yet implemented — not on current roadmap                                                         | 🟡 Medium — used heavily by survey, feedback, and preference-collection bots; a natural complement to modals                                                   |
| **Plain text input**           | Free-text field in modals                                 | Form bots                 | ✅ Single-line and multiline `plain_text_input` in modal `input` blocks                                 | 🔥 High — nearly every modal-based bot needs at least one free-text field                                                                                      |
| **Rich text input**            | Formatted text input                                      | Note-taking bots          | ❌ Explicitly excluded — bots send `mrkdwn`; `rich_text` is a user-compose format                       | 🟢 Low — only relevant for note-taking or editor-style bots that need to capture formatted user content; a small niche                                         |
| **File input**                 | File upload field inside a modal                          | Document submission bots  | ❌ Excluded — file handling adds infrastructure complexity without improving the bot-API loop           | 🟢 Low — document submission and compliance bots use this, but it's a specialised need; most bots never require file uploads in modals                         |

---

## Events (Event Subscriptions)

| Capability                             | What it does                             | Example app                               | Simulator                                                                                                                                             | Developer demand                                                                                                                           |
| -------------------------------------- | ---------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`message.*`**                        | React to messages posted in channels/DMs | Auto-responders, keyword monitors         | ✅ `message` event dispatched on every post — HTTP + Socket Mode                                                                                      | 🔥 High — the most fundamental event; practically every bot that responds to user input subscribes to this                                 |
| **`app_mention`**                      | Triggered when `@bot` is mentioned       | Q&A bots, assistants                      | ✅ Dispatched whenever bot's `@handle` or `<@botUserId>` appears in a message                                                                         | 🔥 High — the standard pattern for assistants, Q&A bots, and any bot that responds to direct address; extremely common                     |
| **`reaction_added/removed`**           | Someone adds/removes an emoji reaction   | Kudos bots, content savers ("⭐ to save") | ✅ Both events dispatched on reaction toggle                                                                                                          | 🟡 Medium — a popular pattern for kudos, content bookmarking, and lightweight voting; used by a significant subset of apps                 |
| **`member_joined_channel`**            | User joins a channel                     | Onboarding welcome bots                   | ✅ Dispatched when a user joins via the "Join Channel" button — Phase 4                                                                               | 🟡 Medium — onboarding and welcome bots are very common; this is among the most-used lifecycle events                                      |
| **`app_home_opened`**                  | User opens your app's Home tab           | Dashboard rendering                       | 🔲 Planned (Phase 9)                                                                                                                                  | 🟡 Medium — required for any app that uses the App Home surface; demand tied to App Home adoption                                          |
| **`channel_created/renamed/archived`** | Channel lifecycle events                 | Governance/compliance bots                | 🔶 Partial — `channel_created` dispatched on creation; `channel_archive`/`channel_unarchive` dispatched from SPA; `channel_rename` deferred — Phase 7 | 🟢 Low — mainly compliance, governance, and IT automation bots; a specialised subset of enterprise apps                                    |
| **`file_shared`**                      | A file is posted                         | Virus scanner, auto-archiver              | ❌ Excluded — file handling out of scope                                                                                                              | 🟢 Low — security and compliance tooling only; rarely needed by typical product bots                                                       |
| **`pin_added/removed`**                | Someone pins a message                   | Knowledge base bots                       | ✅ Dispatched on pin/unpin from the message hover menu — Phase 6                                                                                      | 🟢 Low — knowledge base and documentation bots only; a niche pattern                                                                       |
| **`team_join`**                        | New user joins the workspace             | HR onboarding bots                        | ❌ Not planned for v1                                                                                                                                 | 🟡 Medium — HR onboarding bots are extremely common in enterprise; this event is the trigger for a whole category of "new hire" automation |

---

## Slash Commands

| Capability                | What it does                                    | Example app                            | Simulator                                                                                            | Developer demand                                                                                  |
| ------------------------- | ----------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Custom slash commands** | `/yourcommand args` fires a payload to your bot | `/jira`, `/giphy`, `/polly`, `/remind` | ✅ Full slash command dispatch — autocomplete in composer, HTTP + Socket Mode, `response_url` tokens | 🔥 High — one of the most discoverable bot interaction patterns; used by nearly every utility bot |

---

## Link Unfurling

| Capability        | What it does                                                                     | Example app                                           | Simulator                                                                                                                                                                     | Developer demand                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **URL unfurling** | When a user posts a link, your app intercepts it and renders a rich preview card | GitHub (PR previews), Figma (design previews), Notion | ✅ `link_shared` dispatched to apps with matching `unfurlDomains`; `chat.unfurl` renders attachment or Block Kit previews; OG scraping auto-previews unclaimed URLs — Phase 8 | 🟡 Medium — very high impact when your app has a web presence users link to frequently (GitHub PRs, Jira tickets, Figma files); less relevant for bots without a URL surface |

---

## Files & Canvases

| Capability    | What it does                                    | Example app                                  | Simulator                                                                          | Developer demand                                                                                                                                         |
| ------------- | ----------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Files API** | Upload/download/list files (`files.upload`)     | Document bots, screenshot sharing            | ❌ Excluded — adds blob storage/MIME complexity without improving the bot-API loop | 🟡 Medium — a meaningful portion of bots share generated content (PDFs, CSVs, screenshots); not universal but common enough in reporting and export bots |
| **Canvases**  | Create/read/update collaborative Slack Canvases | Notion-like integrations, meeting notes bots | ❌ Non-goal for v1                                                                 | 🟢 Low — a relatively new Slack feature with limited marketplace adoption so far; few bots currently depend on it                                        |

---

## Users & Presence

| Capability          | What it does                                           | Example app                        | Simulator                                                                                  | Developer demand                                                                                           |
| ------------------- | ------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **User status**     | Set a user's status emoji + text (`users.profile.set`) | "On a call 🎧" bots, vacation bots | ❌ Not implemented — no presence/status surface in v1                                      | 🟢 Low — niche category; mainly calendar and focus-mode integrations (Google Calendar "on a call" bots)    |
| **User presence**   | Get/set active or away (`users.setPresence`)           | Focus mode bots                    | ❌ Not implemented — no presence/status surface in v1                                      | 🟢 Low — focus and do-not-disturb tools only; rarely a primary feature of marketplace apps                 |
| **DMs / `im.open`** | Open a direct message channel with a user              | Any bot that slides into DMs       | ✅ `conversations.open` — bot can open/find DMs with users; auto-creates DM if none exists | 🔥 High — bots that notify individual users (approvals, alerts, onboarding) all open DMs; extremely common |

---

## Workflow Builder (Steps from Apps)

| Capability                | What it does                                               | Example app                         | Simulator                                                                                | Developer demand                                                                                                                               |
| ------------------------- | ---------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Custom workflow steps** | Your app adds a step into Slack's no-code Workflow Builder | Salesforce, PagerDuty, Zapier steps | ❌ Out of scope — Slack is deprecating this model anyway in favour of next-gen Functions | 🟡 Medium — historically popular for no-code enterprise automation; declining demand as Slack deprecates it in favour of the next-gen platform |

> ⚠️ Note: Slack is deprecating "Steps from Apps" in favour of **Workflow Steps for Bolt** (the newer `functions` + `workflows` system in the next-gen platform).

---

## Slack Next-Gen Platform (Deno-based)

| Capability     | What it does                                 | Example app                              | Simulator                                                  | Developer demand                                                                                                 |
| -------------- | -------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Functions**  | Serverless functions hosted by Slack's infra | Custom steps in Workflow Builder         | ❌ Out of scope — next-gen platform requires Slack hosting | 🟢 Low — adoption is still early; most existing apps are on the classic platform. Growing but not yet mainstream |
| **Triggers**   | Link events/schedules/shortcuts to functions | Scheduled digests, form triggers         | ❌ Out of scope                                            | 🟢 Low — tied to next-gen Functions adoption                                                                     |
| **Datastores** | Built-in key-value storage per app           | Storing poll results without external DB | ❌ Out of scope — bots can use their own DB                | 🟢 Low — only relevant for next-gen apps that want zero-infrastructure storage; most bots bring their own DB     |

---

## Auth & Distribution

| Capability                      | What it does                                         | Example app           | Simulator                                                                                                  | Developer demand                                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **OAuth 2.0 flow**              | "Add to Slack" button — multi-workspace installation | Every marketplace app | ❌ Excluded from scope — static pre-configured tokens cover all local dev workflows; no OAuth dance needed | 🔥 High — essential for any app distributed beyond a single workspace; every public marketplace app uses this. Less critical for inner-loop bot dev where static tokens suffice |
| **Token rotation**              | Auto-rotating bot tokens for security                | Enterprise apps       | ❌ Not applicable — static pre-configured tokens are the design (no rotation needed locally)               | 🟢 Low — an enterprise security requirement rather than a developer feature; transparent to most app code                                                                       |
| **Granular permissions/scopes** | Request only the permissions your app needs          | All apps              | ❌ Not applicable — token-to-app mapping is pre-configured; no OAuth scope enforcement                     | 🟡 Medium — matters at distribution time (marketplace review, enterprise security review), but not during inner-loop development                                                |

---

## Enterprise / Admin APIs

| Capability         | What it does                                           | Example app                 | Simulator                  | Developer demand                                                         |
| ------------------ | ------------------------------------------------------ | --------------------------- | -------------------------- | ------------------------------------------------------------------------ |
| **Admin API**      | Manage users, channels, workspaces at org level        | IT provisioning tools       | ❌ Explicitly out of scope | 🟢 Low — enterprise IT tooling only; irrelevant for typical product bots |
| **SCIM API**       | Sync users/groups from identity providers (Okta, etc.) | Okta, OneLogin integrations | ❌ Explicitly out of scope | 🟢 Low — identity provider integrations only; a very specialised niche   |
| **Audit Logs API** | Stream security events for compliance                  | Splunk, Panther             | ❌ Explicitly out of scope | 🟢 Low — compliance and SIEM tooling only                                |
| **Discovery API**  | Export messages for e-discovery/compliance             | Aware, Theta Lake           | ❌ Explicitly out of scope | 🟢 Low — legal/compliance tooling only                                   |

---

## Simulator Coverage Summary

| Status           | Count | Capabilities                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ Supported     | 18    | Bot messages, ephemeral messages, `chat.update`, `chat.delete`, threaded replies, Block Kit rendering, modals + modal stack, buttons, static select, plain text input, slash commands (with usage hints), reaction events, `message` / `app_mention` events, `conversations.open` (DMs), `member_joined_channel`, incoming webhooks, `pin_added/removed`, link unfurling (`link_shared` + `chat.unfurl` + OG auto-preview) |
| 🔶 Partial       | 1     | `channel_created/renamed/archived` — created + archive/unarchive dispatched; channel rename deferred (Phase 7)                                                                                                                                                                                                                                                                                                             |
| 🔲 Planned       | 6     | App Home tab (Phase 9), `app_home_opened` (Phase 9), scheduled messages, `team_join`, message shortcuts (Phase 11 investigation), accessibility / keyboard navigation (Phase 13)                                                                                                                                                                                                                                           |
| ❌ Not supported | 15    | OAuth 2.0 flow (excluded from scope), global shortcuts, overflow menus, datepicker, checkboxes, rich text input, file input, `file_shared`, Files API, Canvases, user status/presence, Workflow Builder steps, Next-Gen Platform, token rotation, Enterprise/Admin/SCIM/Audit APIs                                                                                                                                         |

> **Note:** OAuth 2.0 flow is **excluded from scope entirely** — static pre-configured tokens are the design. If you need to test an install flow, use a real Slack Developer Sandbox.

> There are currently no 🔥 high-demand gaps — Incoming Webhooks (✅), Link Unfurling (✅), and OAuth (deliberately excluded) were the only ones.

### Medium demand gaps worth considering

| Capability                             | Why it matters                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Message shortcuts**                  | A very natural UX pattern ("create ticket from this message") used by Jira, Linear, and many productivity bots    |
| **Date / time pickers**                | Needed for any scheduling or reminder bot                                                                         |
| **Checkboxes & radio buttons**         | Survey and preference-collection bots rely on these; a natural complement to `plain_text_input` already supported |
| **`team_join`**                        | HR onboarding automation — very common in enterprise                                                              |
| **`users_select` / `channels_select`** | The other `static_select` variants; used heavily in assignment and routing bots                                   |

> The simulator targets **the inner dev loop for bot developers**: the surfaces a Bolt app actually uses when receiving events, posting messages, and driving modal interactions. Capabilities that exist for human Slack users (presence, file previews, workflow builder) or for enterprise IT (Admin/SCIM APIs) are deliberately out of scope.
