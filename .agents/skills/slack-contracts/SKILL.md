---
name: slack-contracts
description: Preserve and extend the Slack-compatible interfaces implemented by Slack Simulator, including Web API methods, events, signing, interactivity, webhooks, and Socket Mode. Use when changing simulator behavior exposed to Slack apps or when evaluating contract compatibility.
---

# Slack contracts

Use this skill whenever a change can affect a Bolt app, `@slack/web-api` client, webhook sender, Socket Mode client, Block Kit interaction, event subscriber, or the simulator's documented API behavior.

## Contract boundary

Slack Simulator is a local emulator for the Slack app inner loop. It must provide stable, useful Slack-compatible interfaces, but it is not a complete Slack implementation. Do not silently expand the supported surface or claim compatibility for features that are unsupported or partial.

Before changing behavior, classify the capability as:

- **Supported:** implemented and documented in `docs/capabilities.md`.
- **Partial:** implemented with known deviations or missing variants.
- **Planned/excluded:** do not implement as an incidental side effect; update scope documentation only when the product decision changes.

Treat the current code, tests, and `docs/tech-spec.md` / `docs/capabilities.md` as the repository contract. Consult the official Slack API, Events API, Socket Mode, Block Kit, and Bolt documentation when exact wire behavior is uncertain. Prefer a documented, tested deviation over an undocumented approximation.

## Contract surfaces

When relevant, inspect and preserve these surfaces:

- `src/server/routes/slackApi.ts` — authenticated `POST /api/:method` Web API methods.
- `src/server/routes/hooks.ts` — incoming webhook `POST /hooks/:token`.
- `src/server/slashCommands.ts` — slash command payloads and expiring `response_url` callbacks.
- `src/server/dispatcher.ts` — Events API envelopes, event subscriptions, HTTP signatures, retries, and logging.
- `src/server/socketModeServer.ts` — Socket Mode tickets, WebSocket envelopes, hello frames, acknowledgements, and timeouts.
- `src/server/interactivity.ts` — `block_actions`, `view_submission`, `view_closed`, trigger IDs, modal state, and HTTP/Sockets transports.
- `src/shared/types.ts` — shared domain and Block Kit types.
- `src/server/routes/*.test.ts`, `src/server/*test.ts` — route, event, signing, interactivity, and Socket Mode expectations.
- `config/apps.json` / `config/apps.schema.json` — app tokens, signing secrets, request URLs, subscriptions, webhooks, and supported app configuration.
- `docs/tech-spec.md` and `docs/capabilities.md` — documented protocol and support boundaries.

## Non-negotiable invariants

### Web API

- Bot calls use `Authorization: Bearer <bot token>` and map the token to the configured app.
- Preserve Slack-style JSON responses with an `ok` boolean and stable `error` values.
- Existing invalid-auth behavior returns `{ ok: false, error: "invalid_auth" }`; do not change status semantics without a deliberate compatibility decision and tests.
- The API accepts SDK-style form bodies, including JSON-stringified arrays and objects such as `blocks`, `view`, and `unfurls`.
- Preserve timestamps, IDs, channel IDs, user IDs, thread relationships, pagination metadata, and response field names.
- Keep the simulator's static-token model. Do not introduce OAuth, token rotation, or scope enforcement unless explicitly requested as a product change.
- Unknown methods must remain distinguishable from valid methods and return the repository's established error shape.

### Events and HTTP delivery

- Event subscriptions control delivery; wildcard subscriptions use `*`.
- Events use an `event_callback` envelope with stable fields including `team_id`, `api_app_id`, `event`, `type`, `event_id`, `event_time`, and `authorizations`.
- Preserve event-specific fields such as `type`, `team`, `event_ts`, `channel`, `user`, `text`, `ts`, `subtype`, and blocks where applicable.
- HTTP deliveries use the configured app request URL, JSON body, `X-Slack-Signature`, and `X-Slack-Request-Timestamp` headers.
- Sign exactly the transmitted body using the Slack `v0:<timestamp>:<body>` HMAC-SHA256 convention and the configured signing secret.
- Preserve retry behavior: transient network/5xx failures may retry, while non-5xx responses must not be treated as transient without a documented reason.
- Keep outbound event logging useful for debugging without leaking new secrets into logs or committed files.

### Socket Mode

- `apps.connections.open` authenticates using the app token and returns a one-time WebSocket ticket.
- Tickets expire and are single-use.
- Preserve the hello frame and envelope types currently supported: `events_api`, `interactive`, and `slash_commands`.
- Every delivered envelope must have an `envelope_id`; the client acknowledgement must resolve the matching pending delivery.
- Preserve `accepts_response_payload` semantics and the current timeout behavior.
- Do not send protocol frames merely because they seem plausible; verify the behavior against the Socket Mode contract and existing client tests.

### Interactivity and slash commands

- Preserve the distinction between HTTP form-encoded payloads and Socket Mode JSON envelopes.
- Trigger IDs are one-time values with the existing TTL; redeeming one must consume it.
- Preserve modal identifiers, callback IDs, metadata, blocks, state values, and response actions.
- `block_actions`, `view_submission`, and `view_closed` must carry the expected app, team, user, view, action, and message context.
- Slash command payloads must preserve command text, channel/user/team identifiers, `response_url`, and `trigger_id`.
- `response_url` tokens expire according to the current implementation and must not become reusable indefinitely.

### Webhooks

- Incoming webhook URLs are app- and channel-bound through `config/apps.json`.
- Preserve the plain-text `ok` success response and established error responses.
- Accept text and/or blocks as currently documented; reject empty payloads rather than silently creating blank messages.
- Webhook-created messages must still follow the simulator's event and realtime update behavior.

## Safe change workflow

1. Read the relevant official Slack contract documentation if the requested behavior is ambiguous.
2. Read the implementation, shared types, adjacent tests, and the corresponding capability/spec documentation.
3. Identify the exact wire contract: method/path, auth, content type, request fields, response fields, status/error behavior, transport, TTLs, retries, and side effects.
4. Decide whether the change is a bug fix within an existing supported capability or a new/partial capability. Do not hide a scope expansion inside a refactor.
5. Update the smallest appropriate implementation surface.
6. Add or update tests for both the happy path and meaningful contract failures. Assert exact externally visible fields and headers where appropriate, not only `ok: true`.
7. Update `docs/capabilities.md` or `docs/tech-spec.md` when support status, a deliberate deviation, or a public interface changes.
8. Run the focused tests, then `yarn typecheck`, then `yarn test:ci`; run `yarn build` when server/client wiring or production behavior changed.
9. Report any known Slack deviations explicitly in the final response.

## Contract review checklist

Before declaring a contract change complete, verify:

- [ ] Existing Bolt or `@slack/web-api` request encoding still works.
- [ ] Authentication and signing behavior is covered.
- [ ] Request and response field names match the intended contract.
- [ ] Error values and status behavior are intentional and tested.
- [ ] IDs, timestamps, threads, pagination, and metadata remain consistent.
- [ ] HTTP and Socket Mode behavior are both handled when the capability supports both.
- [ ] Expiring or one-time values cannot be reused.
- [ ] Realtime UI updates, event dispatch, and database side effects remain synchronized.
- [ ] Unsupported and partial features are not accidentally represented as supported.
- [ ] Relevant docs and capability status are current.
- [ ] Focused tests and the appropriate broader validation commands pass.

## Avoid

- Do not replace Slack-compatible payloads with internal database objects.
- Do not use broad `any` casts to bypass a contract mismatch without a test and explanation.
- Do not change IDs, timestamps, envelope types, header names, or error strings casually.
- Do not add OAuth, scopes, presence, files, or other excluded platform areas as incidental improvements.
- Do not “fix” a failing compatibility test by weakening the assertion before reproducing the behavior.
- Do not claim full Slack compatibility; describe the simulator's supported, partial, planned, and excluded surfaces precisely.
