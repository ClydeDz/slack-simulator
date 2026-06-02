import crypto from 'crypto'
import type { FastifyInstance } from 'fastify'
import type { App } from '../shared/types'
import { insertMessage, generateTs, generateId } from './db'
import { broadcast } from './realtime'
import { issueTrigger } from './interactivity'
import { SIMULATOR_BASE_URL } from './index'

// ── response_url token store (in-memory, 30-min TTL) ─────────────────────────
interface ResponseToken { channelId: string; userId: string; appBotUserId: string; appId: string; expiresAt: number }
const _responseTokens = new Map<string, ResponseToken>()

const RESPONSE_URL_TTL = 30 * 60 * 1000

function createResponseToken(channelId: string, userId: string, appBotUserId: string, appId: string): string {
  const token = crypto.randomBytes(16).toString('hex')
  _responseTokens.set(token, { channelId, userId, appBotUserId, appId, expiresAt: Date.now() + RESPONSE_URL_TTL })
  return token
}

// ── Signing ───────────────────────────────────────────────────────────────────
function sign(signingSecret: string, timestamp: number, body: string): string {
  const base = `v0:${timestamp}:${body}`
  return 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex')
}

// ── Post a bot response to a channel ─────────────────────────────────────────
function postBotResponse(
  channelId: string,
  botUserId: string,
  response: { text?: string; blocks?: unknown[] },
  appId?: string,
) {
  const text = response.text ?? ''
  const blocks = Array.isArray(response.blocks) ? response.blocks : undefined
  const id = generateId('M')
  const ts = generateTs()
  const message = insertMessage({ id, channelId, userId: botUserId, text, ts, blocks, appId })
  broadcast({ type: 'message_new', message })
}

// ── Main dispatch ─────────────────────────────────────────────────────────────
export async function dispatchSlashCommand(params: {
  app: App
  command: string       // e.g. "/hello"
  text: string          // args after the command
  channelId: string
  channelName: string
  userId: string
  username: string
  teamId: string
}): Promise<void> {
  const responseToken = createResponseToken(params.channelId, params.userId, params.app.botUserId, params.app.id)
  const responseUrl = `${SIMULATOR_BASE_URL}/_response_url/${responseToken}`
  const triggerId = issueTrigger(params.app.id)

  const payload: Record<string, string> = {
    token: params.app.signingSecret,
    team_id: params.teamId,
    team_domain: 'slacksim',
    channel_id: params.channelId,
    channel_name: params.channelName,
    user_id: params.userId,
    user_name: params.username,
    command: params.command,
    text: params.text,
    api_app_id: params.app.id,
    is_enterprise_install: 'false',
    response_url: responseUrl,
    trigger_id: triggerId,
  }

  if (params.app.socketModeEnabled) {
    const { enqueueSocketModeSlashCommand } = await import('./socketModeServer')
    const envelopeId = `Ev${Date.now()}${Math.random().toString(36).slice(2, 8)}`
    const result = await enqueueSocketModeSlashCommand(params.app.id, envelopeId, payload)
    if (result.acked && result.responsePayload) {
      const r = result.responsePayload as { text?: string; blocks?: unknown[] }
      if (r.text || r.blocks) {
        postBotResponse(params.channelId, params.app.botUserId, r, params.app.id)
      }
    }
  } else if (params.app.requestUrl) {
    const timestamp = Math.floor(Date.now() / 1000)
    const body = new URLSearchParams(payload).toString()
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Slack-Signature': sign(params.app.signingSecret, timestamp, body),
      'X-Slack-Request-Timestamp': String(timestamp),
    }
    try {
      const res = await fetch(params.app.requestUrl, { method: 'POST', headers, body })
      if (res.ok) {
        const ct = res.headers.get('content-type') ?? ''
        if (ct.includes('application/json')) {
          const json = await res.json() as { text?: string; blocks?: unknown[] }
          if (json.text || json.blocks) {
            postBotResponse(params.channelId, params.app.botUserId, json, params.app.id)
          }
        }
      }
    } catch (_) { /* bot offline — silent */ }
  }
}

// ── response_url route ────────────────────────────────────────────────────────
export function registerResponseUrlRoute(app: FastifyInstance): void {
  app.post('/_response_url/:token', async (req, reply) => {
    const { token } = req.params as { token: string }
    const entry = _responseTokens.get(token)

    if (!entry || Date.now() > entry.expiresAt) {
      return reply.status(410).send({ ok: false, error: 'expired_url' })
    }

    const body = req.body as { text?: string; blocks?: unknown; response_type?: string }
    const blocks = Array.isArray(body.blocks)
      ? body.blocks
      : typeof body.blocks === 'string'
        ? (() => { try { return JSON.parse(body.blocks as string) } catch { return undefined } })()
        : undefined

    if (body.text || blocks) {
      postBotResponse(entry.channelId, entry.appBotUserId, { text: body.text, blocks }, entry.appId)
    }

    return reply.send({ ok: true })
  })
}
