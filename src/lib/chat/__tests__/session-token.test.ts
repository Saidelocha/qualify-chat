import { describe, expect, it } from 'vitest'
import { createSession, decodeSession, encodeSession, resolveSecret, SessionTokenError } from '../session-token'

const SECRET = 'a'.repeat(32)

describe('session-token', () => {
  it('round-trips a session through encode/decode', () => {
    const state = createSession(1000)
    const token = encodeSession(state, SECRET)
    const decoded = decodeSession(token, SECRET, 2000)
    expect(decoded).toEqual(state)
  })

  it('rejects a token signed with a different secret', () => {
    const state = createSession()
    const token = encodeSession(state, SECRET)
    expect(() => decodeSession(token, 'b'.repeat(32))).toThrow(SessionTokenError)
  })

  it('rejects a tampered payload', () => {
    const state = createSession()
    const token = encodeSession(state, SECRET)
    const [payload, signature] = token.split('.')
    const tamperedPayload = Buffer.from(JSON.stringify({ ...state, turns: 99 })).toString('base64url')
    expect(() => decodeSession(`${tamperedPayload}.${signature}`, SECRET)).toThrow(SessionTokenError)
    void payload
  })

  it('rejects a malformed token', () => {
    expect(() => decodeSession('not-a-real-token', SECRET)).toThrow(SessionTokenError)
    expect(() => decodeSession('a.b.c', SECRET)).toThrow(SessionTokenError)
  })

  it('rejects an expired session', () => {
    const state = createSession(1000)
    const token = encodeSession(state, SECRET)
    expect(() => decodeSession(token, SECRET, state.exp + 1)).toThrow(SessionTokenError)
  })

  it('resolveSecret returns the env secret when long enough', () => {
    expect(resolveSecret({ CHAT_SESSION_SECRET: SECRET })).toBe(SECRET)
  })

  it('resolveSecret throws in production without a secret', () => {
    expect(() => resolveSecret({ NODE_ENV: 'production' })).toThrow(SessionTokenError)
  })

  it('resolveSecret generates a throwaway dev secret outside production', () => {
    const secret = resolveSecret({})
    expect(secret.length).toBeGreaterThanOrEqual(32)
  })
})
