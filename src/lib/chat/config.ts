import { z } from 'zod'

/**
 * The shape of a qualification flow. One file (`chat.config.ts` at the repo root) picks the
 * active config; everything the bot ever says comes from here — the engine never generates text.
 */

export interface QuestionOption {
  /** Shown on the clickable chip, in the flow's language. */
  label: string
  /** English description sent to the AI understanding layer (Jev). Not shown to the visitor. */
  meaning: string
  /** Regexes tested against normalized (lowercase, accent-stripped) free text, for the heuristic fallback. */
  patterns?: RegExp[]
}

export interface Question {
  id: string
  /** The question text shown to the visitor. */
  prompt: string
  options: Record<string, QuestionOption>
}

export interface FaqEntry {
  id: string
  question: string
  answer: string
  patterns?: RegExp[]
}

export interface RecommendationMessages {
  /** The visitor picked this option directly. */
  chosen: (title: string, description: string) => string
  /** Deduced from their other answers (e.g. they picked an "undecided" option). */
  recommended: (title: string, description: string) => string
  /** Call to action shown after the summary, e.g. "Book your free call" or "Reach out". */
  next: () => string
}

export interface ContactCopy {
  title: string
  firstNameLabel: string
  emailLabel: string
  phoneLabel: string
  consentPrefix: string
  consentLinkLabel: string
  submitLabel: string
  submitBusyLabel: string
  cancelLabel: string
  sendFailedText: string
  sendFailedCtaLabel: string
  errors: {
    firstNameRequired: string
    emailInvalid: string
    phoneInvalid: string
    consentRequired: string
  }
}

export interface ChatMessages {
  welcome: string
  turnLimit: string
  closed: string
  jailbreak: string
  abuse: string
  offTopic: string
  notUnderstood: string
  noted: (understood: string) => string
  book: () => string
  human: (contactEmail: string) => string
  leadSent: (firstName: string) => string
  alreadySent: string
  recommendation: RecommendationMessages
}

export interface ChatUiCopy {
  toggleLabel: string
  toggleAriaLabel: string
  headerTitle: string
  headerSubtitle: string
  closeAriaLabel: string
  dialogAriaLabel: string
  typingAriaLabel: string
  inputLabel: string
  inputPlaceholder: string
  inputPlaceholderLocked: string
  sendAriaLabel: string
  bookingButtonLabel: string
  contactButtonLabel: string
  chosenFormatLabel: string
  recommendedFormatLabel: string
  sessionExpiredText: string
  fallbackErrorText: string
  confirmation: {
    title: string
    emailPrefix: string
    emailSuffix: string
    secondaryCtaLabel: string
  }
  contact: ContactCopy
}

export interface Recommendation {
  id: string
  title: string
  description: string
}

export interface ScoringConfig {
  /** weights[questionId][optionId] = 0-100 subscore contribution for that answer */
  weights: Record<string, Record<string, number>>
  /** questionId -> relative importance (0-100, should sum to ~100 across questions) */
  questionWeights: Record<string, number>
  grades?: { min: number; grade: string }[]
  recommend: (answers: Record<string, string | undefined>) => Recommendation
}

export interface IntentDescriptions {
  answer: string
  faq: string
  book: string
  human: string
  other: string
}

export interface HeuristicGuards {
  jailbreak: RegExp[]
  abuse: RegExp[]
  offTopic: RegExp[]
  book: RegExp[]
  human: RegExp[]
}

export interface ContactConfig {
  enabled: boolean
  ownerEmail?: string
  bookingUrl?: string
  privacyHref?: string
}

export interface ChatThresholds {
  guard: number
  currentQuestion: number
  otherQuestion: number
  faq: number
}

export interface ChatConfig {
  lang: string
  /** English text describing the assistant's scope, sent to the understanding layer. */
  scope: string
  intents?: Partial<IntentDescriptions>
  questions: Question[]
  faq: FaqEntry[]
  messages: ChatMessages
  ui: ChatUiCopy
  scoring: ScoringConfig
  thresholds?: Partial<ChatThresholds>
  contact: ContactConfig
  heuristicGuards?: Partial<HeuristicGuards>
}

export const DEFAULT_THRESHOLDS: ChatThresholds = {
  guard: 0.7,
  currentQuestion: 0.5,
  otherQuestion: 0.6,
  faq: 0.55,
}

export const DEFAULT_INTENTS: IntentDescriptions = {
  answer: 'answers the assistant question or describes their own situation, needs, timeline or budget',
  faq: 'asks a question about the product or service: pricing, process, format, guarantee, availability',
  book: 'wants to book a call, schedule a meeting or be contacted now',
  human: 'wants to talk directly to a human rather than the assistant',
  other: 'none of these: greeting, chit-chat, gibberish or an unrelated request',
}

const RESERVED_OPTION_IDS = new Set(['unclear', 'not_mentioned', 'none'])

const questionOptionSchema = z.object({
  label: z.string().min(1),
  meaning: z.string().min(1),
  patterns: z.array(z.instanceof(RegExp)).optional(),
})

const questionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  options: z.record(z.string().min(1), questionOptionSchema),
})

const faqEntrySchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  patterns: z.array(z.instanceof(RegExp)).optional(),
})

const chatConfigSchema = z.object({
  lang: z.string().min(2),
  scope: z.string().min(1),
  intents: z
    .object({
      answer: z.string().min(1),
      faq: z.string().min(1),
      book: z.string().min(1),
      human: z.string().min(1),
      other: z.string().min(1),
    })
    .partial()
    .optional(),
  questions: z.array(questionSchema).min(1),
  faq: z.array(faqEntrySchema),
  messages: z.custom<ChatMessages>((value) => typeof value === 'object' && value !== null),
  ui: z.custom<ChatUiCopy>((value) => typeof value === 'object' && value !== null),
  scoring: z.custom<ScoringConfig>((value) => typeof value === 'object' && value !== null),
  thresholds: z.custom<Partial<ChatThresholds>>().optional(),
  contact: z.object({
    enabled: z.boolean(),
    ownerEmail: z.email().optional(),
    bookingUrl: z.url().optional(),
    privacyHref: z.string().optional(),
  }),
  heuristicGuards: z.custom<Partial<HeuristicGuards>>().optional(),
})

/**
 * Validates and normalizes a raw config object at load time. Fails fast on structural
 * mistakes that would otherwise surface as confusing runtime errors: duplicate question ids,
 * option ids colliding with the reserved sentinels, or a scoring reference to an unknown
 * question/option.
 */
export function defineChatConfig(config: ChatConfig): ChatConfig {
  const parsed = chatConfigSchema.parse(config)

  const questionIds = new Set<string>()
  for (const question of parsed.questions) {
    if (questionIds.has(question.id)) throw new Error(`defineChatConfig: duplicate question id "${question.id}"`)
    questionIds.add(question.id)

    const optionIds = Object.keys(question.options)
    if (optionIds.length === 0) throw new Error(`defineChatConfig: question "${question.id}" has no options`)
    for (const optionId of optionIds) {
      if (RESERVED_OPTION_IDS.has(optionId)) {
        throw new Error(`defineChatConfig: option id "${optionId}" on question "${question.id}" is reserved`)
      }
    }
  }

  const faqIds = new Set<string>()
  for (const entry of parsed.faq) {
    if (faqIds.has(entry.id)) throw new Error(`defineChatConfig: duplicate faq id "${entry.id}"`)
    faqIds.add(entry.id)
  }

  for (const questionId of Object.keys(parsed.scoring.weights)) {
    const question = parsed.questions.find((q) => q.id === questionId)
    if (!question) throw new Error(`defineChatConfig: scoring.weights references unknown question "${questionId}"`)
    for (const optionId of Object.keys(parsed.scoring.weights[questionId] ?? {})) {
      if (!(optionId in question.options)) {
        throw new Error(`defineChatConfig: scoring.weights["${questionId}"] references unknown option "${optionId}"`)
      }
    }
  }
  for (const questionId of Object.keys(parsed.scoring.questionWeights)) {
    if (!questionIds.has(questionId)) {
      throw new Error(`defineChatConfig: scoring.questionWeights references unknown question "${questionId}"`)
    }
  }

  return config
}
