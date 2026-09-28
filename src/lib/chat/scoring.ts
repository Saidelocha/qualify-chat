import type { Answers } from './schemas'
import type { ChatConfig, Recommendation, ScoringConfig } from './config'

/**
 * Deterministic scoring: each answer earns a subscore (0-100), weighted per question.
 * Everything is config-driven — no built-in offers or thresholds.
 */

const DEFAULT_GRADES = [
  { min: 80, grade: 'A' },
  { min: 65, grade: 'B' },
  { min: 50, grade: 'C' },
  { min: 0, grade: 'D' },
]

export function scoreLead(answers: Answers, scoring: ScoringConfig): { score: number; grade: string } {
  let score = 0
  for (const [questionId, questionWeight] of Object.entries(scoring.questionWeights)) {
    const value = answers[questionId]
    const subscore = value ? (scoring.weights[questionId]?.[value] ?? 0) : 0
    score += (subscore * questionWeight) / 100
  }
  score = Math.round(score)
  const grades = scoring.grades ?? DEFAULT_GRADES
  const sorted = [...grades].sort((a, b) => b.min - a.min)
  const grade = sorted.find((tier) => score >= tier.min)?.grade ?? sorted[sorted.length - 1]?.grade ?? 'D'
  return { score, grade }
}

/**
 * `chosen`: some answer's option id equals the recommendation id directly (the visitor picked
 * that exact format/plan itself). `recommended`: deduced from the rest of their answers
 * (e.g. they picked an "undecided" option). Generic: works for any config whose option ids
 * line up with `scoring.recommend`'s possible `id`s.
 */
export function buildRecommendation(answers: Answers, config: ChatConfig): Recommendation & { source: 'chosen' | 'recommended' } {
  const result = config.scoring.recommend(answers)
  const source: 'chosen' | 'recommended' = Object.values(answers).includes(result.id) ? 'chosen' : 'recommended'
  return { ...result, source }
}
