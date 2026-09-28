import { DEFAULT_THRESHOLDS, type ChatConfig, type ChatThresholds } from './config'
import { LIMITS, type Answers, type QualifyResponse, type SessionState } from './schemas'
import { buildRecommendation } from './scoring'
import type { Understanding } from './understanding'

/**
 * Pure conversation engine: (state, event) -> (new state, messages). All policy lives here,
 * with explicit, adjustable thresholds.
 */

export type EngineEvent =
  | { type: 'start' }
  | { type: 'choose'; questionId: string; value: string }
  | { type: 'say'; text: string; understanding: Understanding }

export interface EngineResult {
  state: SessionState
  messages: string[]
  showBooking: boolean
}

export class EngineError extends Error {}

function resolveThresholds(config: ChatConfig): ChatThresholds {
  return { ...DEFAULT_THRESHOLDS, ...config.thresholds }
}

const questionIds = (config: ChatConfig) => config.questions.map((q) => q.id)

export const nextQuestion = (config: ChatConfig, answers: Answers): string | null =>
  questionIds(config).find((id) => !answers[id]) ?? null

const pendingQuestions = (config: ChatConfig, answers: Answers): string[] =>
  questionIds(config).filter((id) => !answers[id])

function isValidValue(config: ChatConfig, questionId: string, value: string): boolean {
  const question = config.questions.find((q) => q.id === questionId)
  return Boolean(question && value in question.options)
}

function setAnswer(config: ChatConfig, answers: Answers, questionId: string, value: string): Answers {
  if (!isValidValue(config, questionId, value)) throw new EngineError(`Invalid value for ${questionId}`)
  return { ...answers, [questionId]: value }
}

function optionLabel(config: ChatConfig, questionId: string, value: string): string {
  const question = config.questions.find((q) => q.id === questionId)
  return question?.options[value]?.label ?? value
}

export function chipsFor(config: ChatConfig, questionId: string) {
  const question = config.questions.find((q) => q.id === questionId)
  if (!question) return []
  return Object.entries(question.options).map(([value, option]) => ({ value, label: option.label }))
}

function recommendationMessages(config: ChatConfig, answers: Answers): string[] {
  const recommendation = buildRecommendation(answers, config)
  const { recommendation: text } = config.messages
  const summary = recommendation.source === 'chosen' ? text.chosen : text.recommended
  return [summary(recommendation.title, recommendation.description), text.next()]
}

function continueFlow(config: ChatConfig, state: SessionState, justCompleted: boolean): string[] {
  const questionId = nextQuestion(config, state.answers)
  if (questionId) {
    const question = config.questions.find((q) => q.id === questionId)
    return question ? [question.prompt] : []
  }
  if (justCompleted) return recommendationMessages(config, state.answers)
  return []
}

export function step(config: ChatConfig, state: SessionState, event: EngineEvent): EngineResult {
  const COPY = config.messages

  if (event.type === 'start') {
    const first = config.questions[0]
    return { state, messages: first ? [COPY.welcome, first.prompt] : [COPY.welcome], showBooking: false }
  }

  if (state.closed) return { state, messages: [COPY.closed], showBooking: true }

  const turns = state.turns + 1
  if (turns > LIMITS.maxTurns) {
    return { state: { ...state, closed: true }, messages: [COPY.turnLimit], showBooking: true }
  }

  if (event.type === 'choose') {
    const expected = nextQuestion(config, state.answers)
    if (event.questionId !== expected) throw new EngineError('Unexpected question')
    const next = { ...state, turns, answers: setAnswer(config, state.answers, event.questionId, event.value) }
    return { state: next, messages: continueFlow(config, next, nextQuestion(config, next.answers) === null), showBooking: false }
  }

  return handleFreeText(config, state, turns, event.text, event.understanding)
}

function handleFreeText(config: ChatConfig, state: SessionState, turns: number, text: string, understanding: Understanding): EngineResult {
  const COPY = config.messages
  const thresholds = resolveThresholds(config)
  const { guard } = understanding
  const current = nextQuestion(config, state.answers)
  const understoodSomething = Object.keys(understanding.slots).length > 0 || understanding.faq !== null

  const violation =
    guard.jailbreak >= thresholds.guard
      ? COPY.jailbreak
      : guard.abuse >= thresholds.guard
        ? COPY.abuse
        : guard.offTopic >= thresholds.guard && !understoodSomething
          ? COPY.offTopic
          : null

  if (violation) {
    const strikes = state.strikes + 1
    if (strikes >= LIMITS.maxStrikes) {
      return { state: { ...state, turns, strikes, closed: true }, messages: [COPY.closed], showBooking: true }
    }
    const reask = current ? [config.questions.find((q) => q.id === current)?.prompt ?? ''] : []
    return { state: { ...state, turns, strikes }, messages: [violation, ...reask.filter(Boolean)], showBooking: false }
  }

  let answers = state.answers
  for (const questionId of pendingQuestions(config, state.answers)) {
    const detected = understanding.slots[questionId]
    const threshold = questionId === current ? thresholds.currentQuestion : thresholds.otherQuestion
    if (detected && detected.confidence >= threshold) answers = setAnswer(config, answers, questionId, detected.value)
  }
  const filledNow = pendingQuestions(config, state.answers).length - pendingQuestions(config, answers).length

  const notes = state.notes.length < LIMITS.maxNotes ? [...state.notes, text.slice(0, LIMITS.noteChars)] : state.notes
  const next: SessionState = { ...state, turns, answers, notes }

  const messages: string[] = []
  const faq =
    understanding.faq && understanding.faq.confidence >= thresholds.faq
      ? config.faq.find((entry) => entry.id === understanding.faq?.id)
      : undefined
  if (faq) messages.push(faq.answer)

  const showBooking = understanding.intent === 'book'
  if (showBooking) messages.push(COPY.book())
  if (understanding.intent === 'human' && config.contact.ownerEmail) messages.push(COPY.human(config.contact.ownerEmail))

  if (filledNow > 0) {
    // Acknowledge with our own labels — never echo the visitor's raw text.
    const understood = pendingQuestions(config, state.answers)
      .filter((id) => answers[id])
      .map((id) => optionLabel(config, id, answers[id] as string).toLowerCase())
    messages.push(COPY.noted(understood.join(', ')), ...continueFlow(config, next, nextQuestion(config, answers) === null))
  } else if (messages.length === 0) {
    messages.push(COPY.notUnderstood, ...(current ? [config.questions.find((q) => q.id === current)?.prompt ?? ''].filter(Boolean) : []))
  } else if (current) {
    const prompt = config.questions.find((q) => q.id === current)?.prompt
    if (prompt) messages.push(prompt)
  }

  return { state: next, messages, showBooking }
}

/** API response derived from state: prompt, recommendation and allowed next actions. */
export function toResponse(config: ChatConfig, token: string, result: EngineResult): QualifyResponse {
  const { state } = result
  const questionId = state.closed ? null : nextQuestion(config, state.answers)
  const complete = nextQuestion(config, state.answers) === null
  const recommendation = complete && !state.closed ? buildRecommendation(state.answers, config) : null
  return {
    token,
    messages: result.messages,
    prompt: questionId ? { questionId, chips: chipsFor(config, questionId) } : null,
    recommendation,
    canContact: recommendation !== null && !state.submitted && config.contact.enabled,
    showBooking: !state.submitted && (result.showBooking || recommendation !== null || state.closed),
    closed: state.closed,
    submitted: state.submitted,
  }
}
