import { logger } from './logger'
import { EngineError, nextQuestion, step, toResponse, type EngineResult } from './engine'
import type { ChatConfig } from './config'
import type { LeadSender, ProspectConfirmationSender } from './lead-email'
import { clientIp, createRateLimiter } from './rate-limit'
import { LIMITS, qualifyRequestSchema, type QualifyResponse, type SessionState } from './schemas'
import { buildRecommendation, scoreLead } from './scoring'
import { SessionTokenError, createSession, decodeSession, encodeSession, resolveSecret } from './session-token'
import type { Understander, Understanding } from './understanding'

export interface QualifyDeps {
  config: ChatConfig
  understand: Understander
  sendLead: LeadSender
  /** Short confirmation email to the visitor, best effort (a failure never affects the response). */
  sendProspectConfirmation: ProspectConfirmationSender
  secret?: () => string
  allowRequest?: (ip: string) => boolean
  allowContact?: (ip: string) => boolean
  now?: () => number
}

const EMPTY_UNDERSTANDING: Understanding = {
  source: 'heuristic',
  guard: { jailbreak: 0, offTopic: 0, abuse: 0 },
  intent: 'other',
  faq: null,
  slots: {},
}

const json = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

const fail = (status: number, error: string) => json({ error }, status)

/**
 * POST /api/chat handler, dependencies injected for testing. Check order: rate limit -> body
 * size -> JSON -> schema -> secret -> token -> action. Nothing bypasses these checks.
 */
export function createQualifyHandler(deps: QualifyDeps) {
  const { config } = deps
  const allowRequest = deps.allowRequest ?? createRateLimiter(40, 60_000)
  const allowContact = deps.allowContact ?? createRateLimiter(3, 60 * 60_000)
  const getSecret = deps.secret ?? (() => resolveSecret())
  const now = deps.now ?? Date.now
  // Best-effort anti-replay (per instance), in addition to the token's `submitted` flag.
  const submittedNonces = new Set<string>()

  return async function POST(request: Request): Promise<Response> {
    const ip = clientIp(request.headers)
    if (!allowRequest(ip)) return fail(429, 'rate_limited')

    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    if (declaredLength > LIMITS.bodyBytes) return fail(413, 'payload_too_large')
    const raw = await request.text()
    if (Buffer.byteLength(raw) > LIMITS.bodyBytes) return fail(413, 'payload_too_large')

    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return fail(400, 'invalid_json')
    }

    const parsed = qualifyRequestSchema.safeParse(body)
    if (!parsed.success) return fail(400, 'invalid_request')
    const input = parsed.data

    let secret: string
    try {
      secret = getSecret()
    } catch (error) {
      logger.error('chat unavailable: missing secret')
      return fail(503, error instanceof SessionTokenError ? 'unavailable' : 'error')
    }

    const respond = (result: EngineResult): Response =>
      json(toResponse(config, encodeSession(result.state, secret), result) satisfies QualifyResponse)

    if (input.action === 'start') {
      return respond(step(config, createSession(now()), { type: 'start' }))
    }

    let state: SessionState
    try {
      state = decodeSession(input.token, secret, now())
    } catch {
      return fail(401, 'session_expired')
    }

    try {
      switch (input.action) {
        case 'choose':
          return respond(step(config, state, { type: 'choose', questionId: input.questionId, value: input.value }))

        case 'say': {
          if (state.closed || state.turns >= LIMITS.maxTurns) {
            return respond(step(config, state, { type: 'say', text: input.text, understanding: EMPTY_UNDERSTANDING }))
          }
          const pending = config.questions.map((q) => q.id).filter((id) => !state.answers[id])
          const understanding = await deps.understand(input.text, { current: nextQuestion(config, state.answers), pending })
          logger.info('chat:say', { source: understanding.source, inputTokens: understanding.usage?.inputTokens ?? 0 })
          return respond(step(config, state, { type: 'say', text: input.text, understanding }))
        }

        case 'contact':
          return await handleContact(state, input)
      }
    } catch (error) {
      if (error instanceof EngineError) return fail(400, 'invalid_step')
      throw error
    }

    async function handleContact(current: SessionState, contact: Extract<typeof input, { action: 'contact' }>): Promise<Response> {
      const done = (next: SessionState, messages: string[]) => respond({ state: next, messages, showBooking: true })
      const COPY = config.messages

      // Honeypot filled in: simulate success without sending anything.
      if (contact.website) return done({ ...current, submitted: true }, [COPY.leadSent(contact.firstName)])

      if (current.closed || nextQuestion(config, current.answers) !== null) return fail(409, 'not_ready')
      if (current.submitted || submittedNonces.has(current.nonce)) return done(current, [COPY.alreadySent])
      if (!allowContact(ip)) return fail(429, 'rate_limited')

      const { score, grade } = scoreLead(current.answers, config.scoring)
      const recommendation = buildRecommendation(current.answers, config)
      const sent = await deps.sendLead({
        firstName: contact.firstName,
        email: contact.email,
        phone: contact.phone,
        message: contact.message,
        answers: current.answers,
        notes: current.notes,
        score,
        grade,
        recommendation,
        contactedAt: new Date(now()),
      })
      if (!sent.ok) {
        logger.error('chat:lead_failed', { reason: sent.reason ?? 'unknown' })
        return fail(502, 'send_failed')
      }

      submittedNonces.add(current.nonce)
      logger.info('chat:lead', { grade, simulated: sent.simulated ?? false })

      try {
        const confirmation = await deps.sendProspectConfirmation({ email: contact.email, recommendation })
        if (!confirmation.ok) logger.error('chat:prospect_confirmation_failed', { reason: confirmation.reason ?? 'unknown' })
      } catch (error) {
        logger.error('chat:prospect_confirmation_failed', { reason: error instanceof Error ? error.message : 'unknown' })
      }

      return done({ ...current, submitted: true }, [COPY.leadSent(contact.firstName)])
    }
  }
}
