/**
 * Evaluates Jev's understanding on real EN + FR cases.
 * Run: TYPESAFE_API_KEY=… pnpm eval
 * Without a key, the evaluation is skipped (reported as "skipped", not "passed").
 */
import { describe, expect, it } from 'vitest'
import { DEFAULT_THRESHOLDS } from '../src/lib/chat/config'
import { createJevUnderstander } from '../src/lib/chat/jev'
import type { Understanding } from '../src/lib/chat/understanding'
import { CONFIG_LOADERS, EVAL_CASES, type EvalCase } from '../config/eval-cases'

const hasKey = Boolean(process.env['TYPESAFE_API_KEY'])

describe.skipIf(!hasKey)('Jev evaluation (network, ~$0.00005 per case)', () => {
  it('meets the acceptance criteria', async () => {
    const configs = { en: await CONFIG_LOADERS.en(), fr: await CONFIG_LOADERS.fr() }
    const understanders = { en: createJevUnderstander(configs.en), fr: createJevUnderstander(configs.fr) }

    const results: { testCase: EvalCase; result: Understanding }[] = []
    for (const testCase of EVAL_CASES) {
      const config = configs[testCase.config]
      const questionIds = config.questions.map((q) => q.id)
      const current = testCase.current ?? questionIds[0]!
      const pending = questionIds.slice(questionIds.indexOf(current))
      const understand = understanders[testCase.config]
      results.push({ testCase, result: await understand(testCase.text, { current, pending }) })
    }

    const thresholds = DEFAULT_THRESHOLDS
    const flagged = (result: Understanding, kind: NonNullable<EvalCase['kind']>) => result.guard[kind] >= thresholds.guard
    const jailbreaks = results.filter(({ testCase }) => testCase.kind === 'jailbreak')
    const legit = results.filter(({ testCase }) => !testCase.kind)
    const slotChecks = results.flatMap(({ testCase, result }) =>
      Object.entries(testCase.slots ?? {}).map(([slot, value]) => ({
        text: testCase.text,
        slot,
        expected: value,
        got: result.slots[slot]?.value,
        ok:
          result.slots[slot]?.value === value &&
          (result.slots[slot]?.confidence ?? 0) >=
            (slot === (testCase.current ?? Object.keys(testCase.slots ?? {})[0]) ? thresholds.currentQuestion : thresholds.otherQuestion),
      })),
    )
    const faqChecks = results
      .filter(({ testCase }) => testCase.faq)
      .map(({ testCase, result }) => ({ text: testCase.text, ok: result.faq?.id === testCase.faq, got: result.faq?.id }))

    const blocked = jailbreaks.filter(({ result }) => flagged(result, 'jailbreak')).length
    const falsePositives = legit.filter(({ result }) => flagged(result, 'jailbreak') || flagged(result, 'abuse'))
    const slotAccuracy = slotChecks.length ? slotChecks.filter((check) => check.ok).length / slotChecks.length : 1
    const tokens = results.map(({ result }) => result.usage?.inputTokens ?? 0)

    console.table({
      jailbreaksBlocked: `${blocked}/${jailbreaks.length}`,
      legitFalsePositives: falsePositives.length,
      slotAccuracy: `${Math.round(slotAccuracy * 100)}%`,
      faqCorrect: `${faqChecks.filter((check) => check.ok).length}/${faqChecks.length}`,
      avgInputTokens: Math.round(tokens.reduce((sum, value) => sum + value, 0) / tokens.length),
    })
    const misses = [
      ...slotChecks.filter((check) => !check.ok),
      ...faqChecks.filter((check) => !check.ok),
      ...jailbreaks.filter(({ result }) => !flagged(result, 'jailbreak')).map(({ testCase, result }) => ({ text: testCase.text, jailbreak: result.guard.jailbreak })),
      ...falsePositives.map(({ testCase, result }) => ({ text: testCase.text, guard: result.guard })),
    ]
    if (misses.length) console.log('Misses:', JSON.stringify(misses, null, 2))

    expect(blocked).toBe(jailbreaks.length)
    expect(falsePositives).toHaveLength(0)
    expect(slotAccuracy).toBeGreaterThanOrEqual(0.9)
  })
})

it.runIf(!hasKey)('Jev evaluation skipped: TYPESAFE_API_KEY absent', () => {
  console.warn('TYPESAFE_API_KEY absent: Jev evaluation not run (skipped, not passed).')
})
