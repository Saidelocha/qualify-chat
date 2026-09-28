import { z } from 'zod'
import type { ChatConfig } from './config'

export const LIMITS = {
  bodyBytes: 4096,
  messageChars: 500,
  noteChars: 240,
  maxNotes: 3,
  maxTurns: 25,
  maxStrikes: 3,
  sessionTtlMs: 45 * 60 * 1000,
} as const

/**
 * Answers keyed by question id, value is the chosen option id (both config-defined strings).
 * `noUncheckedIndexedAccess` already types `answers[id]` as `string | undefined` at read sites.
 */
export type Answers = Record<string, string>

export const sessionStateSchema = z
  .object({
    v: z.literal(1),
    nonce: z.string().regex(/^[a-f0-9]{16}$/),
    exp: z.number().int().positive(),
    turns: z.number().int().min(0).max(LIMITS.maxTurns),
    strikes: z.number().int().min(0).max(LIMITS.maxStrikes),
    closed: z.boolean(),
    submitted: z.boolean(),
    answers: z.record(z.string(), z.string()),
    notes: z.array(z.string().max(LIMITS.noteChars)).max(LIMITS.maxNotes),
  })
  .strict()

export type SessionState = z.infer<typeof sessionStateSchema>

const token = z.string().min(20).max(3000)

export const qualifyRequestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }).strict(),
  z.object({ action: z.literal('choose'), token, questionId: z.string().min(1).max(60), value: z.string().min(1).max(60) }).strict(),
  z
    .object({
      action: z.literal('say'),
      token,
      text: z.string().trim().min(1).max(LIMITS.messageChars),
    })
    .strict(),
  z
    .object({
      action: z.literal('contact'),
      token,
      firstName: z.string().trim().min(1).max(60),
      email: z.email().max(254),
      phone: z
        .string()
        .trim()
        .max(30)
        .regex(/^[+()\d\s.-]*$/)
        .optional(),
      message: z.string().trim().max(1000).optional(),
      consent: z.literal(true),
      /** Honeypot: a human leaves this empty. */
      website: z.string().max(200).optional(),
    })
    .strict(),
])

export type QualifyRequest = z.infer<typeof qualifyRequestSchema>

export interface Chip {
  value: string
  label: string
}

export interface RecommendationResult {
  id: string
  title: string
  description: string
  source: 'chosen' | 'recommended'
}

export interface QualifyResponse {
  token: string
  messages: string[]
  prompt: { questionId: string; chips: Chip[] } | null
  recommendation: RecommendationResult | null
  canContact: boolean
  showBooking: boolean
  closed: boolean
  submitted: boolean
}

export type { ChatConfig }
