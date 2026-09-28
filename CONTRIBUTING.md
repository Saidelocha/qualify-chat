# Contributing

Thanks for considering a contribution to qualify-chat.

## Setup

```sh
pnpm i
cp .env.example .env.local
pnpm dev
```

The demo works with no API key — the regex heuristic fallback handles understanding.

## Before opening a PR

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

If you touch `src/lib/chat/`, run `pnpm eval` too (it's skipped automatically without
`TYPESAFE_API_KEY`).

## Scope

Keep the core (`src/lib/chat`, `src/components/chat`) framework-agnostic in spirit: no
brand-specific copy, no hardcoded offers or prices. Anything specific to an example flow
belongs in `config/*.ts`, not in the library.
