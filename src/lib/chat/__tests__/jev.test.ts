import { describe, expect, it } from 'vitest'
import { buildQuestions, createJevUnderstander, parseJevResult } from '../jev'
import { makeTestConfig } from './fixtures'

const config = makeTestConfig()

function rawResult(overrides: Record<string, unknown> = {}) {
  return {
    answers: {
      jailbreak: { type: 'noul', noul: 0 },
      off_topic: { type: 'noul', noul: 0 },
      abuse: { type: 'noul', noul: 0 },
      intent: { type: 'choice', choice: 'answer', confidence: 0.9 },
      faq: { type: 'choice', choice: 'none', confidence: 0.9 },
      slot_need: { type: 'choice', choice: 'widget', confidence: 0.8 },
      slot_timeline: { type: 'choice', choice: 'not_mentioned', confidence: 0.9 },
      ...overrides,
    },
    usage: { input_tokens: 42 },
  }
}

describe('buildQuestions', () => {
  it('builds a slot question per pending question id', () => {
    const questions = buildQuestions(config, { current: 'need', pending: ['need', 'timeline'] })
    expect(Object.keys(questions)).toEqual(
      expect.arrayContaining(['jailbreak', 'off_topic', 'abuse', 'intent', 'faq', 'slot_need', 'slot_timeline']),
    )
  })
})

describe('parseJevResult', () => {
  it('parses a well-formed result into an Understanding', () => {
    const result = parseJevResult(rawResult(), config, { current: 'need', pending: ['need', 'timeline'] })
    expect(result.source).toBe('jev')
    expect(result.slots['need']).toEqual({ value: 'widget', confidence: 0.8 })
    expect(result.slots['timeline']).toBeUndefined()
    expect(result.usage).toEqual({ inputTokens: 42 })
  })

  it('rejects an unknown option id for a slot', () => {
    const raw = rawResult({ slot_need: { type: 'choice', choice: 'not-a-real-option', confidence: 0.9 } })
    expect(() => parseJevResult(raw, config, { current: 'need', pending: ['need', 'timeline'] })).toThrow(/Unknown option/)
  })

  it('rejects an unknown faq id', () => {
    const raw = rawResult({ faq: { type: 'choice', choice: 'not-a-real-faq', confidence: 0.9 } })
    expect(() => parseJevResult(raw, config, { current: 'need', pending: ['need', 'timeline'] })).toThrow(/Unknown FAQ/)
  })

  it('rejects a malformed payload', () => {
    expect(() => parseJevResult({ nope: true }, config, { current: 'need', pending: ['need'] })).toThrow()
  })
})

describe('createJevUnderstander', () => {
  it('calls systemOne with the configured scope and question prompt', async () => {
    let captured: unknown
    const call = async (request: unknown) => {
      captured = request
      return rawResult()
    }
    const understand = createJevUnderstander(config, call)
    await understand('I need a widget', { current: 'need', pending: ['need', 'timeline'] })
    expect(captured).toMatchObject({ state: { assistant_scope: config.scope, assistant_question: 'What do you need?' } })
  })
})
