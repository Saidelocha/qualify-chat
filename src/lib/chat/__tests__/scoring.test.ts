import { describe, expect, it } from 'vitest'
import { buildRecommendation, scoreLead } from '../scoring'
import { makeTestConfig } from './fixtures'

const config = makeTestConfig()

describe('scoreLead', () => {
  it('scores a fully answered lead', () => {
    const { score, grade } = scoreLead({ need: 'widget', timeline: 'soon' }, config.scoring)
    expect(score).toBe(100)
    expect(grade).toBe('A')
  })

  it('scores a partially answered lead lower', () => {
    const { score } = scoreLead({ need: 'gadget' }, config.scoring)
    expect(score).toBeLessThan(100)
  })

  it('defaults grade tiers when none supplied', () => {
    const { grade } = scoreLead({}, { ...config.scoring, grades: undefined })
    expect(grade).toBe('D')
  })
})

describe('buildRecommendation', () => {
  it('marks source as chosen when an answer matches the recommendation id', () => {
    const result = buildRecommendation({ need: 'widget', timeline: 'soon' }, config)
    expect(result.id).toBe('widget')
    expect(result.source).toBe('chosen')
  })

  it('handles an empty answers object', () => {
    const result = buildRecommendation({}, config)
    expect(result.id).toBe('widget')
    expect(result.source).toBe('recommended')
  })
})
