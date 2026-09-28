# Write your own flow

Everything lives in one file: `chat.config.ts` at the repo root. It just re-exports a config
object — swap it for your own, or edit `config/agency.en.ts` in place.

## 1. Start from an example

```ts
// config/my-flow.ts
import { defineChatConfig, type ChatConfig } from '../src/lib/chat/config'

const config: ChatConfig = defineChatConfig({
  lang: 'en',
  scope: 'An assistant for ... (English, sent to the AI, never shown to visitors)',
  questions: [ /* ... */ ],
  faq: [ /* ... */ ],
  messages: { /* ... */ },
  ui: { /* ... */ },
  scoring: { /* ... */ },
  contact: { enabled: true, ownerEmail: 'you@example.com' },
})

export default config
```

```ts
// chat.config.ts
export { default } from './config/my-flow'
```

`defineChatConfig` validates the shape at import time: duplicate question ids, an option id
colliding with a reserved word (`unclear`, `not_mentioned`, `none`), or a `scoring` reference
to a question/option that doesn't exist all throw immediately with a clear message.

## 2. Questions

Each question is a fixed set of clickable options. `label` is shown to the visitor. `meaning`
is English text sent to the AI understanding layer — write it as a clear, unambiguous
description of what that answer means, since the model never sees your `label`.

```ts
{
  id: 'timeline',
  prompt: 'When do you need this?',
  options: {
    asap: { label: 'ASAP', meaning: 'within the next two weeks, urgently', patterns: [/asap|urgent/] },
    later: { label: 'No rush', meaning: 'no fixed date', patterns: [/no rush|flexible/] },
  },
}
```

`patterns` are optional regexes tested against lowercased, accent-stripped text — they only
matter for the heuristic fallback (no API key, or Jev unavailable). Skip them if you don't
need the fallback to be smart about a given option.

## 3. FAQ

```ts
{ id: 'pricing', question: 'How much does it cost?', answer: 'Starts at $X...', patterns: [/how much|cost|price/] }
```

## 4. Messages and UI copy

`messages` are what the bot says (see `src/lib/chat/config.ts` for the full `ChatMessages`
shape). `ui` is what's printed on buttons, labels and the contact form — see `ChatUiCopy`.
Both are plain strings or small functions; there's no templating engine.

## 5. Scoring and recommendation

```ts
scoring: {
  questionWeights: { project: 35, timeline: 25, package: 30, status: 10 }, // should sum to ~100
  weights: {
    project: { shop: 100, webapp: 90, redesign: 80, newSite: 75 },
    // ...
  },
  recommend(answers) {
    if (answers.package && answers.package !== 'unsure') return PLANS[answers.package]
    return PLANS.website // fallback logic based on other answers
  },
}
```

`recommend()` returns `{ id, title, description }`. The engine labels the recommendation
"chosen" when some answer's option id equals that `id` directly (the visitor picked exactly
that plan), and "recommended" otherwise (deduced from context, e.g. they picked "not sure").

## 6. Multiple languages

Duplicate the config file per language (see `config/agency.en.ts` and `config/agency.fr.ts`):
same question/option/faq ids (so scoring and tests stay language-agnostic), translated
`label`/`prompt`/`messages`/`ui` text, and `meaning` left in English since that's what the AI
reads regardless of the visitor's language.

## 7. Test it

```sh
pnpm test          # unit tests against your config via src/lib/chat/__tests__/fixtures.ts pattern
TYPESAFE_API_KEY=… pnpm eval   # evaluates real Jev understanding against config/eval-cases.ts
```

Add your own cases to `config/eval-cases.ts` as you add questions — especially paraphrased
answers, multi-answer messages, and anything that could plausibly look off-topic but isn't.

## 8. Theming

The widget ships its own stylesheet (`src/components/chat/chat.css`) and does not depend on
Tailwind, so it can be dropped into any project. Override the CSS variables on `.qc-root`:

```css
.qc-root {
  --chat-accent: #7c3aed;     /* buttons, focus rings, selected chips */
  --chat-accent-fg: #ffffff;  /* text on accent backgrounds */
  --chat-bg: #ffffff;
  --chat-fg: #0a0a0a;
  --chat-muted: #6b7280;
  --chat-border: #e5e7eb;
  --chat-radius: 16px;
}
```

Dark mode values are set under `@media (prefers-color-scheme: dark)` in the same file.
