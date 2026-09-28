import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQualifyHandler, type QualifyDeps } from '../handler'
import type { Understanding } from '../understanding'
import { makeTestConfig } from './fixtures'

const config = makeTestConfig()
const SECRET = 'x'.repeat(32)

const emptyUnderstanding: Understanding = {
  source: 'heuristic',
  guard: { jailbreak: 0, offTopic: 0, abuse: 0 },
  intent: 'other',
  faq: null,
  slots: {},
}

function makeDeps(overrides: Partial<QualifyDeps> = {}): QualifyDeps {
  return {
    config,
    understand: vi.fn(async () => emptyUnderstanding),
    sendLead: vi.fn(async () => ({ ok: true })),
    sendProspectConfirmation: vi.fn(async () => ({ ok: true })),
    secret: () => SECRET,
    ...overrides,
  }
}

function request(body: unknown, headers: Record<string, string> = {}) {
  const text = JSON.stringify(body)
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)), ...headers },
    body: text,
  })
}

describe('createQualifyHandler', () => {
  let deps: QualifyDeps

  beforeEach(() => {
    deps = makeDeps()
  })

  it('start returns 200 with a token and the first prompt', async () => {
    const handler = createQualifyHandler(deps)
    const res = await handler(request({ action: 'start' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toBeTruthy()
    expect(body.prompt).toEqual({ questionId: 'need', chips: expect.any(Array) })
  })

  it('rejects malformed JSON with 400', async () => {
    const handler = createQualifyHandler(deps)
    const res = await handler(
      new Request('http://localhost/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json' }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_json')
  })

  it('rejects a request failing schema validation with 400', async () => {
    const handler = createQualifyHandler(deps)
    const res = await handler(request({ action: 'nope' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_request')
  })

  it('rejects an oversized declared content-length with 413', async () => {
    const handler = createQualifyHandler(deps)
    const res = await handler(request({ action: 'start' }, { 'content-length': '999999' }))
    expect(res.status).toBe(413)
  })

  it('rejects a missing/invalid token with 401', async () => {
    const handler = createQualifyHandler(deps)
    const res = await handler(request({ action: 'choose', token: 'not-a-valid-token-at-all', questionId: 'need', value: 'widget' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('session_expired')
  })

  it('rejects rate-limited requests with 429', async () => {
    deps = makeDeps({ allowRequest: () => false })
    const handler = createQualifyHandler(deps)
    const res = await handler(request({ action: 'start' }))
    expect(res.status).toBe(429)
  })

  it('choose advances the flow and returns updated chips', async () => {
    const handler = createQualifyHandler(deps)
    const start = await handler(request({ action: 'start' }))
    const { token } = await start.json()
    const res = await handler(request({ action: 'choose', token, questionId: 'need', value: 'widget' }))
    const body = await res.json()
    expect(body.prompt.questionId).toBe('timeline')
  })

  it('choose on an invalid step returns 400', async () => {
    const handler = createQualifyHandler(deps)
    const start = await handler(request({ action: 'start' }))
    const { token } = await start.json()
    const res = await handler(request({ action: 'choose', token, questionId: 'timeline', value: 'soon' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('invalid_step')
  })

  it('say calls the understander and reflects its result', async () => {
    deps = makeDeps({
      understand: vi.fn(async () => ({ ...emptyUnderstanding, intent: 'answer' as const, slots: { need: { value: 'widget', confidence: 0.9 } } })),
    })
    const handler = createQualifyHandler(deps)
    const start = await handler(request({ action: 'start' }))
    const { token } = await start.json()
    const res = await handler(request({ action: 'say', token, text: 'I need a widget' }))
    const body = await res.json()
    expect(body.prompt.questionId).toBe('timeline')
    expect(deps.understand).toHaveBeenCalledTimes(1)
  })

  async function completeFlow(handler: (req: Request) => Promise<Response>): Promise<string> {
    const start = await handler(request({ action: 'start' }))
    let { token } = await start.json()
    const r1 = await handler(request({ action: 'choose', token, questionId: 'need', value: 'widget' }))
    ;({ token } = await r1.json())
    const r2 = await handler(request({ action: 'choose', token, questionId: 'timeline', value: 'soon' }))
    ;({ token } = await r2.json())
    return token
  }

  it('contact sends the lead and marks the session submitted', async () => {
    const handler = createQualifyHandler(deps)
    const token = await completeFlow(handler)
    const res = await handler(
      request({ action: 'contact', token, firstName: 'Ada', email: 'ada@example.com', consent: true }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.submitted).toBe(true)
    expect(deps.sendLead).toHaveBeenCalledTimes(1)
    expect(deps.sendProspectConfirmation).toHaveBeenCalledTimes(1)
  })

  it('contact with the honeypot filled simulates success without sending', async () => {
    const handler = createQualifyHandler(deps)
    const token = await completeFlow(handler)
    const res = await handler(
      request({ action: 'contact', token, firstName: 'Bot', email: 'bot@example.com', consent: true, website: 'http://spam.example' }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).submitted).toBe(true)
    expect(deps.sendLead).not.toHaveBeenCalled()
  })

  it('contact before the flow is complete returns 409', async () => {
    const handler = createQualifyHandler(deps)
    const start = await handler(request({ action: 'start' }))
    const { token } = await start.json()
    const res = await handler(request({ action: 'contact', token, firstName: 'Ada', email: 'ada@example.com', consent: true }))
    expect(res.status).toBe(409)
  })

  it('contact replayed on the same token responds with alreadySent, no duplicate send', async () => {
    const handler = createQualifyHandler(deps)
    const token = await completeFlow(handler)
    const res1 = await handler(request({ action: 'contact', token, firstName: 'Ada', email: 'ada@example.com', consent: true }))
    const { token: token2 } = await res1.json()
    const res2 = await handler(request({ action: 'contact', token: token2, firstName: 'Ada', email: 'ada@example.com', consent: true }))
    expect(res2.status).toBe(200)
    expect((await res2.json()).messages).toEqual(['Already sent.'])
    expect(deps.sendLead).toHaveBeenCalledTimes(1)
  })

  it('contact is rate limited independently of the main limiter', async () => {
    deps = makeDeps({ allowContact: () => false })
    const handler = createQualifyHandler(deps)
    const token = await completeFlow(handler)
    const res = await handler(request({ action: 'contact', token, firstName: 'Ada', email: 'ada@example.com', consent: true }))
    expect(res.status).toBe(429)
  })

  it('contact returns 502 when sendLead fails', async () => {
    deps = makeDeps({ sendLead: vi.fn(async () => ({ ok: false, reason: 'boom' })) })
    const handler = createQualifyHandler(deps)
    const token = await completeFlow(handler)
    const res = await handler(request({ action: 'contact', token, firstName: 'Ada', email: 'ada@example.com', consent: true }))
    expect(res.status).toBe(502)
  })

  it('a failing prospect confirmation does not fail the response', async () => {
    deps = makeDeps({ sendProspectConfirmation: vi.fn(async () => ({ ok: false, reason: 'boom' })) })
    const handler = createQualifyHandler(deps)
    const token = await completeFlow(handler)
    const res = await handler(request({ action: 'contact', token, firstName: 'Ada', email: 'ada@example.com', consent: true }))
    expect(res.status).toBe(200)
    expect((await res.json()).submitted).toBe(true)
  })

  it('returns 503 when the secret cannot be resolved', async () => {
    deps = makeDeps({
      secret: () => {
        throw new Error('no secret')
      },
    })
    const handler = createQualifyHandler(deps)
    const res = await handler(request({ action: 'start' }))
    expect(res.status).toBe(503)
  })
})
