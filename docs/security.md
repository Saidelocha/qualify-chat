# Security model

## No server-side session storage

Conversation state (answers, turn count, strikes, submitted flag) is a small JSON object,
serialized and HMAC-SHA256 signed with `CHAT_SESSION_SECRET`, then handed to the client as an
opaque token. Every request round-trips it. There is no database and nothing to leak from one.

- The client cannot forge an answer: `choose` is validated against the current question's
  option ids server-side (`src/lib/chat/engine.ts`), and a mismatched question id throws.
- The client cannot skip ahead: the engine always asks for `nextQuestion(config, answers)`.
- Tampering with the payload invalidates the signature (`timingSafeEqual` comparison,
  `src/lib/chat/session-token.ts`), so the request is rejected with 401 and the client
  restarts cleanly.
- Sessions expire after 45 minutes (`LIMITS.sessionTtlMs`).

`CHAT_SESSION_SECRET` must be at least 32 characters and is required in production; in
development a throwaway secret is generated automatically so `pnpm dev` works with zero setup.

## Prompt injection has no output to hijack

The understanding model (Jev) only ever returns labels from a closed set you defined — never
free text. There is no generated sentence for an injected instruction to produce, because
nothing is ever generated. A jailbreak attempt at best gets classified `jailbreak: 0.95` and
receives your own pre-written refusal message.

Guard checks run twice: once via the regex heuristic (always, zero cost), once via Jev (when
configured) — the two are combined by taking the max of the two jailbreak/abuse scores, so a
Jev miss doesn't bypass an obvious heuristic hit.

## Request validation, in order

`src/lib/chat/handler.ts` checks, in this order, and nothing after a failed check runs:

1. Rate limit (`allowRequest`, default 40 requests/minute per IP)
2. Declared and actual body size (`LIMITS.bodyBytes`, 4KB)
3. JSON parse
4. Zod schema (`qualifyRequestSchema`) — a discriminated union on `action`, `.strict()` so
   unknown fields are rejected
5. Secret resolution (fails closed with 503 if misconfigured in production)
6. Token decode/verify (401 on failure, client restarts)
7. The action itself

## Contact form

- **Honeypot**: an invisible `website` field. A human never fills it; if it's non-empty, the
  handler simulates success without sending anything or consuming the contact rate limit.
- **Separate rate limit** for `contact` (default 3/hour per IP) — a spammer that fills the
  question flow cheaply still can't flood your inbox.
- **Anti-replay**: a `submitted` flag on the token plus an in-memory nonce set — resubmitting
  the same session's contact request returns "already sent" instead of sending twice.
- A failed prospect confirmation email never fails the visitor-facing response (best effort).

## What this doesn't cover

The in-memory rate limiter is best-effort per serverless instance — put a real edge/WAF rate
limit in front in production if you expect abuse at scale. This template also doesn't include
CAPTCHA or bot detection beyond the honeypot; add one if you need it.
