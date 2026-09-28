# qualify-chat

A lead-qualification chat that never generates text.

![Demo: a visitor types a free-text answer, clicks an option, tries a prompt injection that gets refused, then receives a recommendation](docs/demo.gif)

## Why

LLM chatbots get jailbroken. Someone types the right incantation and the bot starts saying
things you never wrote, in your brand's voice, on your website. This template sidesteps the
whole problem: the AI never writes a sentence. It only classifies — jailbreak? off-topic?
which answer does this map to? — and a deterministic engine turns those typed judgments into
one of a fixed set of replies you wrote in advance. There's no generated output for an
injection to hijack, because there's no generation.

The visitor gets a fixed flow of questions with clickable chips. They can also just type — a
model ([TypeSafe Jev](https://typesafe.ai)) reads the free text and returns structured
judgments (intent, FAQ match, which answer this looks like, guard probabilities), never prose.
No API key configured? A regex heuristic fallback handles the same job, less subtly but for
free.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/Saidelocha/qualify-chat&env=CHAT_SESSION_SECRET&envDescription=Random%20string%20of%20at%20least%2032%20characters%20used%20to%20sign%20chat%20sessions&envLink=https://github.com/Saidelocha/qualify-chat%23deploy)

## Quickstart

```sh
git clone https://github.com/Saidelocha/qualify-chat.git
cd qualify-chat
pnpm i
cp .env.example .env.local
pnpm dev
```

Open http://127.0.0.1:3000 — the demo works with **no API key**: the regex heuristic
fallback handles understanding. Add `TYPESAFE_API_KEY` to `.env.local` to switch on the AI
understanding layer for better paraphrase handling.

## Deploy

Any Node host that runs Next.js works. Set these environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `CHAT_SESSION_SECRET` | **Yes, in production** | Signs session tokens. At least 32 random characters (`openssl rand -hex 32`). Without it the API answers 503. |
| `TYPESAFE_API_KEY` | No | Switches on Jev understanding. Without it, the regex fallback is used. |
| `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, `LEAD_TO_EMAIL` | No | Sends leads by e-mail through Resend. Without them, leads are logged to the server console. |

## Write your own flow

Edit `chat.config.ts` at the repo root — it just re-exports the active config. See
[`docs/customizing.md`](docs/customizing.md) for a full walkthrough: questions, FAQ, messages,
scoring, and running it in a second language.

## How it works

```mermaid
flowchart LR
    U[Visitor types free text] --> J[Jev: typed judgments only]
    U -.no key / Jev down.-> H[Regex heuristic]
    J --> E[engine.ts: pure state machine]
    H --> E
    E --> R[Pre-written reply from chat.config.ts]
```

Full breakdown, including the session model and cost, in
[`docs/how-it-works.md`](docs/how-it-works.md).

## Security model

Stateless, HMAC-signed session tokens (no database), server-side validation of every
answer/step, a honeypot and a separate rate limit on the contact form, and defense-in-depth
guard checks (heuristic always runs, even alongside Jev). Details in
[`docs/security.md`](docs/security.md).

## Evaluation

```sh
TYPESAFE_API_KEY=… pnpm eval
```

Runs `config/eval-cases.ts` (English and French, including jailbreak attempts and
paraphrased multi-answer messages) against the real Jev API and checks: every jailbreak
blocked, zero false positives on legitimate messages, and at least 90% slot-detection
accuracy. Skipped (not "passed") when no key is set — `pnpm test` never depends on it.

## Cost

TypeSafe Jev calls are a handful of small typed questions per message, not a generated
response — fractions of a cent per message; see [TypeSafe's pricing](https://typesafe.ai) for
current numbers. Without a key, understanding is entirely free (regex only).

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on `127.0.0.1` |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm eval` | Jev evaluation against real cases (needs `TYPESAFE_API_KEY`) |

## Project layout

```
chat.config.ts            <- the one file you edit
config/                     example flows (English, French) + eval cases
src/lib/chat/                engine, understanding, scoring, session, handler — framework-agnostic
src/components/chat/         the widget (Chat.tsx, DeferredChat.tsx, chat.css)
src/app/                     demo Next.js app (landing page + /api/chat route)
docs/                        how it works, customizing, security
```

## License

MIT, see [LICENSE](LICENSE).

---

Built by Leo Barcet. Extracted from a production site, where it replaced an LLM chatbot that kept getting talked out of its script.
