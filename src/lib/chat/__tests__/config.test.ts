import { describe, expect, it } from 'vitest'
import { defineChatConfig } from '../config'
import { makeTestConfig } from './fixtures'

describe('defineChatConfig', () => {
  it('accepts a well-formed config', () => {
    expect(() => makeTestConfig()).not.toThrow()
  })

  it('rejects duplicate question ids', () => {
    const base = makeTestConfig()
    expect(() =>
      defineChatConfig({ ...base, questions: [...base.questions, { ...base.questions[0]! }] }),
    ).toThrow(/duplicate question id/)
  })

  it('rejects a reserved option id', () => {
    const base = makeTestConfig()
    const [first, ...rest] = base.questions
    expect(() =>
      defineChatConfig({
        ...base,
        questions: [{ ...first!, options: { ...first!.options, unclear: { label: 'x', meaning: 'x' } } }, ...rest],
      }),
    ).toThrow(/reserved/)
  })

  it('rejects a question with no options', () => {
    const base = makeTestConfig()
    const [first, ...rest] = base.questions
    expect(() => defineChatConfig({ ...base, questions: [{ ...first!, options: {} }, ...rest] })).toThrow(/no options/)
  })

  it('rejects duplicate faq ids', () => {
    const base = makeTestConfig()
    expect(() => defineChatConfig({ ...base, faq: [...base.faq, { ...base.faq[0]! }] })).toThrow(/duplicate faq id/)
  })

  it('rejects scoring.weights referencing an unknown question', () => {
    const base = makeTestConfig()
    expect(() =>
      defineChatConfig({ ...base, scoring: { ...base.scoring, weights: { ...base.scoring.weights, ghost: { x: 1 } } } }),
    ).toThrow(/unknown question/)
  })

  it('rejects scoring.weights referencing an unknown option', () => {
    const base = makeTestConfig()
    expect(() =>
      defineChatConfig({ ...base, scoring: { ...base.scoring, weights: { ...base.scoring.weights, need: { ghost: 1 } } } }),
    ).toThrow(/unknown option/)
  })

  it('rejects scoring.questionWeights referencing an unknown question', () => {
    const base = makeTestConfig()
    expect(() =>
      defineChatConfig({ ...base, scoring: { ...base.scoring, questionWeights: { ...base.scoring.questionWeights, ghost: 10 } } }),
    ).toThrow(/unknown question/)
  })
})
