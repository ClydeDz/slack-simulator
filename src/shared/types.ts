export interface Workspace { id: string; name: string; domain: string; avatarUrl?: string; emojiMap?: Record<string, string> }
export interface User { id: string; username: string; fullName: string; email: string; avatarSeed: string; avatarUrl?: string }
export interface Channel { id: string; name: string; type: 'public' | 'private' | 'im' | 'mpim'; members: string[]; archived?: boolean }
export interface Reaction { name: string; users: string[] }
export interface UnfurlAttachment {
  title?: string
  title_link?: string
  text?: string
  image_url?: string
  thumb_url?: string
  color?: string
  footer?: string
  blocks?: Block[]
}

export interface Message {
  id: string; channel: string; user: string; text: string;
  ts: string; threadTs?: string; reactions: Reaction[]
  blocks?: Block[]
  subtype?: string
  pinned?: boolean
  appId?: string            // set when a bot posts via chat.postMessage — used for block_action routing
  ephemeralRecipient?: string
  unfurls?: Record<string, UnfurlAttachment>
  // Thread metadata (only set on parent/root messages)
  replyCount?: number; replyUsers?: string[]; latestReplyTs?: string
}

// ── Block Kit types ───────────────────────────────────────────────────────────

export interface TextObject {
  type: 'plain_text' | 'mrkdwn'
  text: string
  emoji?: boolean
}

export interface ImageElement {
  type: 'image'
  image_url: string
  alt_text: string
}

export interface ButtonElement {
  type: 'button'
  text: TextObject
  action_id?: string
  block_id?: string
  value?: string
  style?: 'primary' | 'danger'
  url?: string
}

export interface StaticSelectOption {
  text: TextObject
  value: string
}

export interface StaticSelectElement {
  type: 'static_select'
  action_id?: string
  placeholder?: TextObject
  options: StaticSelectOption[]
  initial_option?: StaticSelectOption
}

export type BlockElement = ImageElement | ButtonElement | StaticSelectElement

export interface SectionBlock {
  type: 'section'
  text?: TextObject
  fields?: TextObject[]
  accessory?: BlockElement
}

export interface HeaderBlock {
  type: 'header'
  text: TextObject
}

export interface DividerBlock {
  type: 'divider'
}

export interface ContextBlock {
  type: 'context'
  elements: Array<TextObject | ImageElement>
}

export interface ImageBlock {
  type: 'image'
  image_url: string
  alt_text: string
  title?: TextObject
}

export interface ActionsBlock {
  type: 'actions'
  block_id?: string
  elements: Array<ButtonElement | StaticSelectElement>
}

export type Block =
  | SectionBlock
  | HeaderBlock
  | DividerBlock
  | ContextBlock
  | ImageBlock
  | ActionsBlock
export interface SlashCommand {
  command: string      // e.g. "/hello"
  description: string
  usage?: string       // e.g. "[question] [option1] [option2]" — shown in the autocomplete dropdown
}

export interface IncomingWebhook {
  channelId: string
  token: string
}

export interface App {
  id: string; name: string; botUserId: string; botUserName: string;
  botToken: string; appToken: string; signingSecret: string;
  requestUrl: string; subscribedEvents: string[]; socketModeEnabled: boolean;
  description?: string
  avatarUrl?: string
  slashCommands: SlashCommand[]
  incomingWebhooks: IncomingWebhook[]
  unfurlDomains: string[]
}

export interface LogEntry {
  id: string
  ts: number          // unix ms
  appId: string
  appName: string
  direction: 'outbound' | 'inbound'
  eventType: string   // e.g. 'message', 'reaction_added', 'chat.postMessage'
  transport: 'http' | 'socket_mode' | 'api'
  status?: number     // HTTP status for outbound, or 'ack' for socket mode
  durationMs?: number
  payload: unknown
  error?: string
}

// ── Modal / Block Kit interactivity ──────────────────────────────────────────

export interface InputBlock {
  type: 'input'
  block_id?: string
  label: TextObject
  element: InputElement
  hint?: TextObject
  optional?: boolean
}

export interface PlainTextInputElement {
  type: 'plain_text_input'
  action_id?: string
  placeholder?: TextObject
  initial_value?: string
  multiline?: boolean
}

export type InputElement = PlainTextInputElement | StaticSelectElement

export interface ModalView {
  id: string
  type: 'modal'
  title: TextObject
  submit?: TextObject
  close?: TextObject
  blocks: Array<Block | InputBlock>
  callback_id?: string
  private_metadata?: string
  notify_on_close?: boolean
}

// WebSocket push events (server → SPA)
export type WsEvent =
  | { type: 'message_new'; message: Message }
  | { type: 'message_updated'; message: Message }
  | { type: 'message_deleted'; channelId: string; ts: string }
  | { type: 'reaction_updated'; ts: string; channelId: string; reactions: Reaction[] }
  | { type: 'channel_created'; channel: Channel }
  | { type: 'channel_updated'; channel: Channel }
  | { type: 'workspace_reset' }
  | { type: 'log_entry'; entry: LogEntry }
  | { type: 'modal_open'; view: ModalView; appId: string }
  | { type: 'modal_close'; viewId: string }
  | { type: 'modal_update'; view: ModalView }
  | { type: 'modal_push'; view: ModalView; appId: string }
