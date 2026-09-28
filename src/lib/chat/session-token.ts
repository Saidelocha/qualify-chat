import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { LIMITS, sessionStateSchema, type SessionState } from './schemas'

/**
 * Conversation state travels client-side in an HMAC-SHA256-signed token: no server storage,
 * and the client cannot forge answers or skip questions.
 */

export class SessionTokenError extends Error {}

let devSecret: string | undefined

export function resolveSecret(env: Record<string, string | undefined> = process.env): string {
  const secret = env['CHAT_SESSION_SECRET']
  if (secret && secret.length >= 32) return secret
  if (env['NODE_ENV'] === 'production') {
    throw new SessionTokenError('CHAT_SESSION_SECRET missing or too short (32 characters minimum)')
  }
  devSecret ??= randomBytes(32).toString('hex')
  return devSecret
}

export function createSession(now = Date.now()): SessionState {
  return {
    v: 1,
    nonce: randomBytes(8).toString('hex'),
    exp: now + LIMITS.sessionTtlMs,
    turns: 0,
    strikes: 0,
    closed: false,
    submitted: false,
    answers: {},
    notes: [],
  }
}

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url')

export function encodeSession(state: SessionState, secret: string): string {
  const payload = Buffer.from(JSON.stringify(state)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function decodeSession(token: string, secret: string, now = Date.now()): SessionState {
  const [payload, signature, ...rest] = token.split('.')
  if (!payload || !signature || rest.length > 0) throw new SessionTokenError('Malformed token')

  const expected = Buffer.from(sign(payload, secret))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new SessionTokenError('Invalid signature')
  }

  let json: unknown
  try {
    json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  } catch {
    throw new SessionTokenError('Unreadable payload')
  }

  const parsed = sessionStateSchema.safeParse(json)
  if (!parsed.success) throw new SessionTokenError('Payload does not match schema')
  if (parsed.data.exp < now) throw new SessionTokenError('Session expired')
  return parsed.data
}
