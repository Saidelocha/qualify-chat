import { Resend } from 'resend'
import { logger } from './logger'
import type { Answers } from './schemas'
import type { ChatConfig, Recommendation } from './config'

/**
 * Lead notification emails. Deliberately minimal and generic: this file is written from
 * scratch for the open-source template and does not reuse any private project's copy or
 * template — swap it freely for your own transactional email design.
 */

export interface LeadPayload {
  firstName: string
  email: string
  phone?: string
  message?: string
  answers: Answers
  notes: string[]
  score: number
  grade: string
  recommendation: Recommendation & { source: 'chosen' | 'recommended' }
  contactedAt: Date
}

export interface ProspectConfirmationPayload {
  email: string
  recommendation: Recommendation & { source: 'chosen' | 'recommended' }
}

export interface SendResult {
  ok: boolean
  reason?: string
  simulated?: boolean
}

export type LeadSender = (payload: LeadPayload) => Promise<SendResult>
export type ProspectConfirmationSender = (payload: ProspectConfirmationPayload) => Promise<SendResult>

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

function answersTable(config: ChatConfig, answers: Answers): string {
  const rows = config.questions
    .map((question) => {
      const value = answers[question.id]
      if (!value) return null
      const label = question.options[value]?.label ?? value
      return `<tr><td style="padding:4px 12px 4px 0;color:#666;">${escapeHtml(question.prompt)}</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(label)}</td></tr>`
    })
    .filter(Boolean)
    .join('')
  return `<table cellpadding="0" cellspacing="0">${rows}</table>`
}

function ownerEmailHtml(config: ChatConfig, payload: LeadPayload): string {
  const notesHtml = payload.notes.length
    ? `<p style="margin-top:16px;color:#666;">Notes:</p><ul>${payload.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
    : ''
  const messageHtml = payload.message
    ? `<p style="margin-top:16px;"><strong>Message:</strong><br/>${escapeHtml(payload.message)}</p>`
    : ''
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;">
      <h2 style="margin-bottom:4px;">New qualified lead</h2>
      <p style="color:#666;margin-top:0;">${escapeHtml(payload.firstName)} &lt;${escapeHtml(payload.email)}&gt;${payload.phone ? ` &middot; ${escapeHtml(payload.phone)}` : ''}</p>
      <p><strong>Score:</strong> ${payload.score}/100 (grade ${escapeHtml(payload.grade)})</p>
      <p><strong>Recommendation:</strong> ${escapeHtml(payload.recommendation.title)} (${payload.recommendation.source})</p>
      <p style="color:#666;">${escapeHtml(payload.recommendation.description)}</p>
      <h3>Answers</h3>
      ${answersTable(config, payload.answers)}
      ${messageHtml}
      ${notesHtml}
      <p style="margin-top:24px;color:#999;font-size:12px;">Contacted at ${payload.contactedAt.toISOString()}</p>
    </div>
  `
}

function prospectEmailHtml(config: ChatConfig, payload: ProspectConfirmationPayload): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;">
      <p>Thanks for reaching out! We received your details.</p>
      <p><strong>${escapeHtml(payload.recommendation.title)}</strong></p>
      <p style="color:#666;">${escapeHtml(payload.recommendation.description)}</p>
      <p style="margin-top:24px;color:#999;font-size:12px;">${escapeHtml(config.scope)}</p>
    </div>
  `
}

/**
 * Builds the lead sender. Uses Resend when `RESEND_API_KEY` is set; otherwise logs to the
 * console (dev mode) and reports success so local testing doesn't require an API key.
 */
export function createLeadSender(config: ChatConfig): LeadSender {
  const apiKey = process.env['RESEND_API_KEY']
  const from = process.env['LEAD_FROM_EMAIL']
  const to = process.env['LEAD_TO_EMAIL'] ?? config.contact.ownerEmail

  return async (payload) => {
    if (!apiKey || !from || !to) {
      logger.info('lead:dev_log', { email: payload.email, score: payload.score, grade: payload.grade })
      return { ok: true, simulated: true }
    }
    try {
      const resend = new Resend(apiKey)
      const { error } = await resend.emails.send({
        from,
        to: [to],
        subject: `New lead: ${payload.firstName} (${payload.grade})`,
        html: ownerEmailHtml(config, payload),
      })
      if (error) return { ok: false, reason: error.message }
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'unknown' }
    }
  }
}

export function createProspectConfirmationSender(config: ChatConfig): ProspectConfirmationSender {
  const apiKey = process.env['RESEND_API_KEY']
  const from = process.env['LEAD_FROM_EMAIL']

  return async (payload) => {
    if (!apiKey || !from) {
      logger.info('lead:prospect_confirmation_dev_log', { email: payload.email })
      return { ok: true, simulated: true }
    }
    try {
      const resend = new Resend(apiKey)
      const { error } = await resend.emails.send({
        from,
        to: [payload.email],
        subject: 'We received your request',
        html: prospectEmailHtml(config, payload),
      })
      if (error) return { ok: false, reason: error.message }
      return { ok: true }
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'unknown' }
    }
  }
}
