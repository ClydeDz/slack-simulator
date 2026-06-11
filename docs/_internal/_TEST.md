# Test Plan for Slack Simulator

This document outlines a comprehensive testing strategy for the Slack Simulator codebase to prevent regression issues and ensure code quality.

## Test Setup Recommendations

Before implementing tests, the following dependencies should be added:

**Client-side testing:**

- `vitest` - Fast unit test runner (works with Vite)
- `@testing-library/react` - React component testing
- `@testing-library/jest-dom` - Custom Jest matchers
- `@testing-library/user-event` - User interaction simulation
- `msw` (Mock Service Worker) - API mocking for HTTP requests

**Server-side testing:**

- `vitest` - For unit tests (shared with client)
- `supertest` - HTTP endpoint testing
- `better-sqlite3` - Already installed, can use in-memory DB for tests

**Shared testing:**

- `vitest` - Type validation and utility tests

**E2E testing (optional but recommended):**

- `playwright` - End-to-end testing for critical user flows

---

## Client-Side Tests (`src/client/`)

### 1. State Management Tests (`store/index.ts`) ✅ COMPLETED (34 tests)

**Test Suite: `WorkspaceState`**

- **Initial State**: Verify default state values (workspace, users, channels, apps, actingUserId, activeChannelId, etc.)
- **setWorkspaceData**:
  - Verify workspace, users, channels, apps are set correctly
  - Verify actingUserId defaults to first user
  - Verify activeChannelId defaults to first channel
- **setActingUser**: Verify actingUserId updates correctly
- **setActiveChannel**:
  - Verify activeChannelId updates
  - Verify activeThreadTs is cleared
  - Verify unreadCount for the channel is reset to 0
- **setActiveThread**: Verify activeThreadTs updates
- **setActiveTab**: Verify tab switching works
- **setChannelMessages**: Verify messages are stored per channel
- **addChannel**: Verify new channel is added to channels array
- **Modal Stack Operations**:
  - `openModal`: Verify modal is pushed to stack
  - `closeModal`: Verify top modal is removed
  - `closeAllModals`: Verify all modals are cleared
  - `updateTopModal`: Verify top modal is updated
- **Log Operations**:
  - `setLogs`: Verify logs are replaced
  - `addLog`: Verify log is added to front and limited to 300 entries
- **updateAppConfig**: Verify app is updated in apps array
- **WebSocket Event Handling** (`applyWsEvent`):
  - `message_new`: Verify message added to correct channel, thread handling, unread count logic
  - `message_updated`: Verify message is updated in place
  - `message_deleted`: Verify message is removed
  - `reaction_updated`: Verify reactions are updated
  - `channel_created`: Verify channel added
  - `channel_updated`: Verify channel updated
  - `workspace_reset`: Verify state is cleared and refetch triggered
  - `modal_open`, `modal_push`, `modal_update`, `modal_close`: Verify modal stack operations
  - `log_entry`: Verify log is added

### 2. Hook Tests (`hooks/useRealtimeWS.ts`) ✅ COMPLETED (6 tests)

**Test Suite: `useRealtimeWS`**

- **Connection**: Verify WebSocket connects to correct URL
- **Message Handling**: Verify incoming messages are parsed and passed to `applyWsEvent`
- **Reconnection**: Verify reconnection logic on disconnect (2-second delay)
- **Cleanup**: Verify cleanup on unmount (close connection, clear timers)
- **Error Handling**: Verify malformed messages are ignored

### 3. API Client Tests (`lib/api.ts`) ✅ COMPLETED (30 tests)

**Test Suite: `controlFetch` and `controlApi`**

- **controlFetch**:
  - Verify acting user header is included (X-Slacksim-Acting-User)
  - Verify content-type is set to JSON
  - Verify error handling (parses error from response body)
  - Verify successful responses return JSON
- **controlApi methods** (integration tests with mocked fetch):
  - `getChannelMessages`: Correct endpoint and method
  - `postMessage`: Correct payload structure (channelId, text, threadTs)
  - `toggleReaction`: Correct endpoint and payload
  - `pinMessage`: Correct endpoint and payload
  - `createChannel`: Correct payload with type conversion (isPrivate → 'private'/'public')
  - `addAppToChannel`: Correct payload
  - `joinChannel`, `leaveChannel`, `archiveChannel`: Correct methods (empty body)
  - `resetWorkspace`: Correct endpoint
  - `getLogs`: Correct endpoint
  - `postSlashCommand`: Correct payload (channelId, command, text)
  - `postModalBlockAction`: Correct payload (viewId, blockId, actionId, value, appId, selectedOption)
  - `postBlockAction`: Correct payload (channelId, messageTs, blockId, actionId, value, appId, selectedOption)
  - `submitView`: Correct payload (viewId, values)
  - `closeView`: Correct payload (viewId)
  - `openDm`: Correct payload (botUserId)
  - `updateApp`: Correct method and payload (requestUrl, socketModeEnabled, subscribedEvents)
  - `getDbTables`: Correct endpoint
  - `getDbTableRows`: Correct query parameter handling (limit, offset, orderBy, order)

### 4. Component Tests (Critical Components) ⚠️ PARTIALLY COMPLETED (23 tests)

**Test Suite: `App.tsx`** ✅ COMPLETED (10 tests)

- **Loading State**: Verify loading message is shown when data is loading
- **Render Structure**: Verify ControlBar, correct view based on activeTab, modals
- **Data Fetching**: Verify workspace data is fetched on mount
- **WebSocket Hook**: Verify useRealtimeWS is called

**Test Suite: `ControlBar`** ✅ COMPLETED (13 tests)

- **Tab Switching** (TabSwitcher): Verify clicking tabs changes activeTab ✅ COMPLETED (5 tests)
- **Identity Switcher** (IdentitySwitcher): Verify user selection changes actingUserId ✅ COMPLETED (8 tests)
- **Active State**: Verify active tab is visually indicated

**Test Suite: `MessageList` & `Message`**

- **Message Rendering**: Verify messages display correctly with text, reactions, blocks
- **Thread Indicators**: Verify thread reply count and users display
- **Reaction Rendering**: Verify reactions show count and user avatars
- **Pinned State**: Verify pinned messages are indicated
- **Ephemeral Messages**: Verify ephemeral messages only show to recipient

**Test Suite: `Composer`**

- **Message Submission**: Verify form submission calls API with correct payload
- **Thread Replies**: Verify threadTs is included when replying
- **Clear Input**: Verify input clears after submission

**Test Suite: `SlackModal`**

- **Modal Rendering**: Verify modal content renders based on view type
- **Stack Depth**: Verify stack depth affects z-index/positioning
- **Block Kit Rendering**: Verify blocks render correctly (sections, buttons, inputs, etc.)
- **Form Submission**: Verify view_submit calls correct API
- **Close Action**: Verify close button calls correct API

**Test Suite: `Sidebar` (ChannelList, DmList, AppList)**

- **Channel Filtering**: Verify channels are filtered by type
- **Unread Indicators**: Verify unread counts display
- **Active Channel**: Verify active channel is highlighted
- **DM Detection**: Verify DMs are identified correctly

### 5. Integration Tests

- **Message Flow**: User posts message → API call → WebSocket event → State update → UI re-render
- **Reaction Flow**: User adds reaction → API call → WebSocket event → State update
- **Channel Creation**: Create channel → WebSocket event → Sidebar update
- **Modal Flow**: Block action → Modal open → User input → Submit → Modal close/response

---

## Server-Side Tests (`src/server/`)

### 1. Database Tests (`db.ts`) ✅ COMPLETED (50 tests)

**Test Suite: Database Operations**

- **Migration**: Verify tables are created correctly on init
- **Column Migrations**: Verify ALTER TABLE statements run safely (idempotent)
- **getAllUsers**: Verify users are fetched with correct field mapping
- **getChannel**:
  - Verify channel data with members
  - Verify archived flag
  - Verify null handling for non-existent channels
- **getChannelMessages**:
  - Verify pagination (limit, cursor)
  - Verify thread messages are excluded
  - Verify ascending order for display
  - Verify nextCursor return value
- **getThreadMessages**:
  - Verify parent and replies are fetched (by channelId and parentTs)
  - Verify correct ordering
- **insertMessage**:
  - Verify message is inserted with all fields (id, channelId, userId, text, ts, blocks, threadTs, appId)
  - Verify blocks JSON serialization
  - Verify threadTs handling
- **updateMessage**:
  - Verify text and blocks update (by messageId)
  - Verify null handling for non-existent messages
- **deleteMessage**: Verify deletion and return value (by messageId)
- **getMessageByTs**: Verify message retrieval (by channelId and ts)
- **toggleReaction**:
  - Verify adding new reaction (by messageId, name, userId)
  - Verify removing existing reaction
  - Verify return value ("added" vs "removed")
- **setPinned**: Verify pin state update (by messageId)
- **setMessageUnfurls**: Verify unfurls JSON serialization (by messageId)
- **getApps**: Verify apps are fetched with correct field mapping
- **getAppByToken**:
  - Verify lookup by bot_token
  - Verify lookup by app_token
- **getAppByWebhookToken**: Verify webhook token matching (returns app and channelId)
- **updateApp**: Verify field updates (by id: requestUrl, socketModeEnabled, subscribedEvents)
- **generateTs**: Verify timestamp format (unix.timestamp + counter)
- **generateId**: Verify ID format (prefix + timestamp + random)

### 2. Dispatcher Tests (`dispatcher.ts`) ✅ COMPLETED (15 tests)

**Test Suite: Event Dispatching**

- **sign**: Verify HMAC-SHA256 signature generation matches Slack format (v0= signature)
- **postWithRetry**:
  - Verify successful request returns immediately
  - Verify retry logic for 5xx errors (3 attempts, exponential backoff)
  - Verify network errors trigger retry
  - Verify 4xx errors return immediately
- **dispatchEvent**:
  - Verify event envelope structure (token, team_id, api_app_id, event, type, event_id, event_time, authorizations)
  - Verify only subscribed apps receive events (checks subscribedEvents array)
  - Verify wildcard subscription ("\*") works
  - Verify HTTP dispatch with signing headers (X-Slack-Signature, X-Slack-Request-Timestamp)
  - Verify Socket Mode dispatch (via enqueueSocketModeEvent)
  - Verify log entry creation (outbound logs)
- **dispatchEventToApp**:
  - Verify single-app dispatch (for link_shared)
  - Verify envelope structure
- **logInbound**: Verify inbound log entry creation (direction: "inbound")
- **getLogs**: Verify logs are returned in reverse chronological order
- **Log Rotation**: Verify logs are limited to 300 entries

### 3. Interactivity Tests (`interactivity.ts`) ✅ COMPLETED (26 tests)

**Test Suite: Trigger Management**

- **issueTrigger**: Verify trigger ID format and 5-minute TTL
- **redeemTrigger**:
  - Verify valid trigger returns appId
  - Verify expired trigger returns null
  - Verify consumed trigger returns null

**Test Suite: Modal Management**

- **storeModal**: Verify modal is stored with appId (in-memory Map)
- **getModal**: Verify modal retrieval by viewId
- **deleteModal**: Verify modal deletion

**Test Suite: Block Actions Dispatch**

- **dispatchBlockActions**:
  - Verify button action payload structure
  - Verify static_select action payload structure
  - Verify message context (channel, message_ts, blocks)
  - Verify modal context (view, callback_id)
  - Verify HTTP dispatch with signing
  - Verify Socket Mode dispatch (via enqueueSocketModeInteractive)

**Test Suite: View Submission**

- **dispatchViewSubmission**:
  - Verify payload structure (type, view with state.values)
  - Verify response_action handling (errors, push, update)
  - Verify HTTP vs Socket Mode dispatch

**Test Suite: View Closed**

- **dispatchViewClosed**: Verify payload structure and dispatch

**Test Suite: Modal Operations**

- **openModal**:
  - Verify viewId generation
  - Verify view structure validation
  - Verify storage and broadcast (modal_open event)
- **updateModal**:
  - Verify view update in place
  - Verify null for non-existent view
  - Verify broadcast (modal_update event)
- **pushModal**:
  - Verify new view creation
  - Verify storage and broadcast (modal_push event)

### 4. Socket Mode Server Tests (`socketModeServer.ts`) ✅ COMPLETED (15 tests)

**Test Suite: Ticket Management**

- **issueTicket**: Verify ticket format and 60-second TTL
- **redeemTicket**: Verify valid/invalid/expired ticket handling (returns appId or null)

**Test Suite: Connection Management**

- **initSocketModeServer**: Verify WebSocket server initialization (via handleUpgrade)
- **Connection Handling**:
  - Verify valid ticket accepts connection
  - Verify invalid ticket rejects with code 4001
  - Verify previous connection is evicted (single connection per app)
  - Verify hello message is sent
- **Message Handling**:
  - Verify ack messages resolve pending promises
  - Verify envelope_id matching
- **Connection Cleanup**: Verify cleanup on close/error

**Test Suite: Event Enqueueing**

- **enqueueSocketModeEvent**:
  - Verify envelope structure (envelope_id, type: events_api)
  - Verify send to correct WebSocket (by appId)
  - Verify ack timeout (30s)
  - Verify return value (true if acked, false if timeout)
- **enqueueSocketModeInteractive**:
  - Verify envelope structure (type: interactive, accepts_response_payload: true)
  - Verify response payload is returned
- **enqueueSocketModeSlashCommand**:
  - Verify envelope structure (type: slash_commands)
  - Verify response payload handling

### 5. Route Tests (`routes/`)

**Test Suite: Slack API Routes (`slackApi.ts`) ✅ COMPLETED (17 tests) - Critical endpoints only**

\*\*Test Suite: Webhook Routes (`hooks.ts`) ✅ COMPLETED (1 test) - Basic export test

- **Token Validation**: Verify webhook token extraction from URL params
- **App Lookup**: Verify app lookup by webhook token returns app and channelId
- **Message Insertion**: Verify message is inserted with bot user ID
- **Broadcast**: Verify message is broadcast via WebSocket
- **Event Dispatch**: Verify message event is dispatched to subscribed apps
- **App Mention Detection**: Verify @mentions trigger app_mention events
- **Error Handling**: Verify 404 for invalid tokens, 400 for missing text/blocks

- **Authentication**:
  - Verify Bearer token extraction
  - Verify invalid token returns auth error
  - Verify auth.test works without full validation
- **auth.test**: Verify response structure
- **users.list**: Verify users + bot user in response
- **users.info**: Verify single user lookup
- **conversations.list**: Verify channel listing with member counts
- **conversations.history**:
  - Verify pagination (limit, cursor)
  - Verify message structure (reactions, thread_ts)
- **conversations.replies**: Verify thread message fetching
- **conversations.create**:
  - Verify channel creation
  - Verify name normalization
  - Verify private flag
  - Verify broadcast
- **conversations.members**: Verify member listing
- **conversations.open**:
  - Verify DM creation with user IDs
  - Verify existing DM reuse
  - Verify bot user auto-inclusion
- **conversations.info**: Verify channel info
- **users.conversations**: Verify user's channel list
- **chat.postMessage**:
  - Verify message insertion
  - Verify DM auto-open when channel is user ID
  - Verify archived channel rejection
  - Verify blocks parsing (array or JSON string)
  - Verify thread support
  - Verify broadcast
  - Verify event dispatch (message, app_mention)
- **chat.update**: Verify message update and broadcast
- **chat.delete**: Verify deletion and broadcast
- **chat.postEphemeral**: Verify ephemeral message insertion
- **chat.unfurl**: Verify unfurl update and broadcast
- **chat.getPermalink**: Verify permalink generation
- **reactions.add**: Verify reaction addition and broadcast
- **reactions.remove**: Verify reaction removal and broadcast
- **reactions.get**: Verify reaction retrieval
- **apps.connections.open**: Verify Socket Mode ticket issuance
- **views.open**:
  - Verify trigger redemption
  - Verify view parsing (string or object)
  - Verify modal opening
- **views.update**: Verify modal update
- **views.push**: Verify modal push
- **Unknown Method**: Verify 404 response

\*\*Test Suite: Control Routes (`control.ts`) ✅ COMPLETED (2 tests) - Basic export tests

- **GET /\_control/workspace**: Verify workspace data structure
- **POST /\_control/workspace/reset**: Verify database reset and broadcast
- **GET /\_control/channels**: Verify channel listing
- **POST /\_control/channels**: Verify channel creation with members
- **POST /\_control/channels/:id/archive**: Verify archive/unarchive toggle and system message
- **POST /\_control/channels/:id/join**: Verify member addition and system message
- **POST /\_control/channels/:id/leave**: Verify member removal and system message
- **POST /\_control/channels/:id/apps**: Verify app addition (acknowledgment)
- **POST /\_control/dm**: Verify DM creation with bot (finds existing or creates new)
- **GET /\_control/channels/:id/messages**: Verify message fetching
- **POST /\_control/messages**:
  - Verify message insertion
  - Verify event dispatch (message, app_mention)
  - Verify link unfurling trigger
- **POST /\_control/messages/:id/reactions**: Verify reaction toggle and event dispatch
- **POST /\_control/messages/:id/pin**: Verify pin toggle and event dispatch
- **GET /\_control/apps**: Verify app listing
- **PATCH /\_control/apps/:id**: Verify app config update
- **POST /\_control/slash_command**:
  - Verify mention resolution (@username, #channel)
  - Verify command dispatch
- **POST /\_control/block_action**:
  - Verify appId resolution (message.appId, body.appId, message author)
  - Verify block action dispatch
- **POST /\_control/modal_block_action**: Verify modal block action dispatch
- **POST /\_control/view_submit**:
  - Verify view submission dispatch
  - Verify response_action handling (errors, push, update)
- **POST /\_control/view_close**: Verify view close dispatch
- **GET /\_control/logs**: Verify log retrieval
- **GET /\_control/db/tables**: Verify table listing
- **GET /\_control/db/tables/:name**: Verify table row fetching with pagination (limit, offset, orderBy, order)

**Test Suite: Link Unfurling Helpers**

- **extractUrls**: Verify URL extraction from text
- **extractDomain**: Verify domain extraction
- **scrapeOgPreview**:
  - Verify OG tag parsing
  - Verify timeout handling (5s)
  - Verify error handling
- **processUnfurls**:
  - Verify URL grouping by app (unfurlDomains)
  - Verify link_shared dispatch per app
  - Verify OG scraping for unclaimed URLs
  - Verify unfurl update and broadcast

### 6. Seed Tests (`seed.ts`) ❌ NOT IMPLEMENTED

**Test Suite: Database Seeding**

- **seedDatabase**:
  - Verify workspace insertion with emoji set
  - Verify user insertion
  - Verify channel insertion with members
  - Verify DM insertion
  - Verify message insertion with timestamps
  - Verify reaction insertion
  - Verify thread reply insertion
  - Verify app insertion with webhooks
  - Verify deterministic webhook token generation
  - Verify credentials file creation (.slack-simulator/credentials.json)
- **resetDatabase**:
  - Verify all tables are cleared
  - Verify re-seeding after clear

### 7. Server Integration Tests ❌ NOT IMPLEMENTED

- **Full Slack API Flow**: Bot auth → post message → event dispatch → bot receives event
- **Socket Mode Flow**: Bot connects via ticket → receives events → sends acks
- **Interactivity Flow**: User clicks button → block_actions → bot responds → UI updates
- **Modal Flow**: Bot opens modal → user submits → view_submission → bot responds with update/push/errors
- **Link Unfurling Flow**: User posts link → link_shared dispatch → bot responds with unfurls → message updated
- **Webhook Flow**: External service posts to webhook → message inserted → event dispatched → apps notified

### 8. Slack App Integration Tests (SDK Compatibility) ❌ NOT IMPLEMENTED

**Test Suite: @slack/web-api Integration**

- **HTTP Mode Connection**:
  - Verify bot can authenticate with bot_token via Bearer header
  - Verify auth.test returns correct workspace/team info
  - Verify bot can post messages via chat.postMessage
  - Verify bot can update messages via chat.update
  - Verify bot can delete messages via chat.delete
  - Verify bot can fetch conversations via conversations.list
  - Verify bot can fetch users via users.list
  - Verify bot can open modals via views.open
  - Verify bot can update modals via views.update
  - Verify bot can push modals via views.push

**Test Suite: @slack/socket-mode Integration**

- **Socket Mode Connection**:
  - Verify app.connections.open returns valid WebSocket URL with ticket
  - Verify bot connects via WebSocket with ticket
  - Verify hello message is received and parsed correctly
  - Verify bot can receive events_api envelopes
  - Verify bot can send ack responses
  - Verify bot can receive interactive envelopes (block_actions, view_submission)
  - Verify bot can send response payloads in acks
  - Verify bot can receive slash_commands envelopes
  - Verify connection reconnection after disconnect

**Test Suite: Signature Validation**

- **Verify Slack SDK validates simulator signatures**:
  - HTTP dispatch: SDK should accept X-Slack-Signature from simulator
  - Socket Mode: No signature needed (ticket-based auth)
  - Verify timestamp validation (reject stale requests)
  - Verify replay attack protection (if implemented)

**Test Suite: Round-Trip Event Flows**

- **Message Event Round-Tip**:
  - Bot posts message → simulator dispatches message event → bot receives event
  - Verify event structure matches Slack Events API format
  - Verify bot can respond to message events
- **App Mention Round-Trip**:
  - User @mentions bot → simulator dispatches app_mention → bot receives event
  - Verify bot can respond with chat.postMessage
- **Reaction Event Round-Trip**:
  - User adds reaction → simulator dispatches reaction_added → bot receives event
  - Verify event includes reaction name, user, message context
- **Block Action Round-Tip**:
  - User clicks button → simulator sends block_actions → bot receives → bot responds with chat.update
  - Verify UI updates with bot's response
- **Slash Command Round-Tip**:
  - User types /command → simulator sends slash_command → bot receives → bot responds with message
  - Verify response appears in channel

**Test Suite: Error Scenarios**

- **Invalid Token**: Verify SDK handles auth errors gracefully
- **Network Failure**: Verify SDK retry logic works with simulator
- **Malformed Events**: Verify simulator handles invalid app responses
- **Timeout**: Verify Socket Mode ack timeout handling

---

## Shared Tests (`src/shared/`) ❌ NOT IMPLEMENTED

### 1. Type Validation Tests (`types.ts`)

**Test Suite: Type Definitions**

- **Workspace**: Verify required fields (id, name, domain)
- **User**: Verify required fields (id, username, fullName, email, avatarSeed)
- **Channel**: Verify type enum values ("public", "private", "im", "mpim")
- **Message**: Verify required fields and optional fields (threadTs, reactions, blocks, etc.)
- **Block Kit Types**:
  - Verify TextObject structure (type: "plain_text" | "mrkdwn")
  - Verify BlockElement union types
  - Verify Block union types
- **App**: Verify required fields and optional arrays (slashCommands, incomingWebhooks, unfurlDomains)
- **LogEntry**: Verify direction enum ("outbound" | "inbound"), transport enum
- **ModalView**: Verify structure (blocks, callback_id, private_metadata, etc.)
- **WsEvent**: Verify all event type variants have correct structure

### 2. Zod Schema Validation (Recommended)

Add Zod schemas for runtime validation of:

- Incoming API payloads
- WebSocket events
- Configuration files (seed.json, apps.json)

Test that:

- Valid data passes validation
- Invalid data is rejected with clear error messages
- Optional fields are handled correctly

---

## End-to-End Tests (Critical User Flows) ❌ NOT IMPLEMENTED

### 1. Basic Messaging Flow

- User posts message in channel
- Message appears in UI
- Message is persisted to database
- Event is dispatched to subscribed apps

### 2. Thread Reply Flow

- User replies to message
- Thread view opens
- Reply count updates on parent
- Thread messages are fetched correctly

### 3. Reaction Flow

- User adds reaction to message
- Reaction appears in UI
- Reaction is persisted
- Event is dispatched

### 4. Channel Management Flow

- User creates new channel
- Channel appears in sidebar
- User joins channel
- System message appears
- User leaves channel
- Channel is archived

### 5. Bot Interaction Flow

- Bot posts message via API
- Message appears in UI
- User clicks button in message
- Bot receives block_actions
- Bot updates message
- UI reflects update

### 6. Modal Flow

- Bot opens modal via views.open
- Modal appears in UI
- User fills form and submits
- Bot receives view_submission
- Bot responds with errors/update/push
- UI handles response correctly

### 7. Slash Command Flow

- User types slash command
- Command is dispatched to bot
- Bot responds with message
- Message appears in UI

### 8. DM Flow

- User opens DM with bot
- DM appears in sidebar
- User sends message to bot
- Bot receives message
- Bot responds
- Response appears in DM

### 9. App Configuration Flow

- User navigates to admin view
- User updates app request URL
- App config is saved
- Subsequent events use new URL

### 10. Workspace Reset Flow

- User triggers workspace reset
- Database is cleared and re-seeded
- UI refreshes with new data
- WebSocket clients receive reset event

---

## Performance Tests ❌ NOT IMPLEMENTED

### 1. Database Performance

- Insert 1000 messages and measure time
- Query messages with pagination
- Verify WAL mode performance

### 2. WebSocket Performance

- Simulate 100 concurrent connections
- Measure message broadcast latency
- Verify reconnection handling under load

### 3. API Performance

- Measure response time for common endpoints
- Verify retry logic doesn't cause excessive delays

---

## Robustness Tests (Input Handling) ❌ NOT IMPLEMENTED

### 1. Authentication Logic

- Verify token extraction from Bearer header works correctly
- Verify signing signature validation matches expected format (Slack compatibility)
- Verify invalid tokens are rejected with appropriate error responses

### 2. Input Validation

- Verify parameterized queries handle special characters correctly (SQL safety)
- Verify message rendering escapes/displays special characters correctly (XSS safety)
- Verify static file serving handles malformed paths gracefully (path safety)

### 3. Error Handling

- Verify malformed JSON payloads return clear error messages
- Verify missing required fields return 400 with descriptive errors
- Verify unknown endpoints return 404

---

## Test Implementation Summary

**Total Tests Implemented: 399 tests across 25 test files**

### Completed Test Suites:

- ✅ Database operations tests (db.ts) - 50 tests
- ✅ Dispatcher tests (dispatcher.ts) - 15 tests
- ✅ State management tests (store/index.ts) - 34 tests
- ✅ Critical API route tests (slackApi.ts) - 36 tests
- ✅ WebSocket hook tests (useRealtimeWS.ts) - 6 tests
- ✅ API Client Tests (lib/api.ts) - 30 tests
- ✅ Component Tests (App.tsx, TabSwitcher, IdentitySwitcher) - 23 tests
- ✅ Component Tests (MessageList, Message) - 29 tests
- ✅ Component Tests (Composer) - 29 tests
- ✅ Component Tests (SlackModal) - 22 tests
- ✅ Component Tests (Sidebar) - 13 tests
- ✅ Seed tests (seed.ts) - 2 tests
- ✅ Component Tests (AdminView, DatabaseView, LogsView) - 36 tests
- ✅ Type validation tests (types.ts) - 23 tests
- ✅ Interactivity tests (interactivity.ts) - 26 tests
- ✅ Socket Mode Server tests (socketModeServer.ts) - 15 tests
- ✅ Control Routes tests (control.ts) - 2 tests (basic export tests)
- ✅ Webhook Routes tests (hooks.ts) - 1 test (basic export test)
- ✅ Realtime tests (realtime.ts) - 4 tests
- ✅ Slash Commands tests (slashCommands.ts) - 3 tests (basic export tests)

### Not Yet Implemented:

- ❌ Webhook Routes detailed tests (hooks.ts) - only basic export test implemented
- ❌ Control Routes detailed tests (control.ts) - only basic export tests implemented
- ❌ E2E tests
- ❌ Performance tests

---

## Test Implementation Priority

### Phase 1: Critical Path (High Priority) ✅ COMPLETED

1. ✅ Database operations tests (`db.ts`) - 50 tests
2. ✅ Dispatcher tests (`dispatcher.ts`) - 15 tests
3. ✅ State management tests (`store/index.ts`) - 34 tests
4. ✅ Critical API route tests (`slackApi.ts` - chat.postMessage, conversations.\*) - 17 tests
5. ✅ WebSocket hook tests (`useRealtimeWS.ts`) - 6 tests
6. ✅ API client tests (`api.ts`) - 30 tests
7. ✅ Component tests for core UI (App, TabSwitcher, IdentitySwitcher) - 23 tests

### Phase 2: Core Features (Medium Priority)

1. Interactivity tests (`interactivity.ts`)
2. Socket Mode tests (`socketModeServer.ts`)
3. Control route tests (`control.ts`)
4. Component tests for core UI (MessageList, Composer, ControlBar)
5. API client tests (`api.ts`)

### Phase 3: Edge Cases (Low Priority)

1. Seed tests (`seed.ts`)
2. Component tests for secondary UI (AdminView, DatabaseView, LogsView)
3. Type validation tests
4. E2E tests
5. Performance tests

---

## Test Coverage Goals

- **Unit Tests**: 80%+ coverage for business logic
- **Integration Tests**: Critical flows covered
- **E2E Tests**: Top 10 user flows covered

---

## Continuous Integration

Add GitHub Actions workflow to:

1. Run unit tests on every push
2. Run integration tests on every PR
3. Run E2E tests on merge to main
4. Generate coverage reports
5. Fail PR if coverage drops below threshold

---

## Mocking Strategy

- **Database**: Use in-memory SQLite for tests
- **External HTTP**: Use MSW to mock fetch calls
- **WebSocket**: Mock WebSocket class for client tests
- **Time**: Use vi.useFakeTimers() for timeout/retry tests
