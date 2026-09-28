'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { ChatUiCopy } from '@/lib/chat/config'
import type { QualifyResponse } from '@/lib/chat/schemas'
import './chat.css'

type Message = { id: number; from: 'bot' | 'user'; text: string }
type ApiBody = Record<string, unknown> & { action: 'start' | 'choose' | 'say' | 'contact' }

const MAX_LENGTH = 500

let messageId = 0
const toMessages = (from: Message['from'], texts: string[]) => texts.map((text) => ({ id: ++messageId, from, text }))

export interface ChatProps {
  ui: ChatUiCopy
  bookingUrl?: string
  privacyHref?: string
  /** Called with lightweight analytics events; wire it to your own tracker. */
  onEvent?: (name: string, data?: Record<string, unknown>) => void
}

export default function Chat({ ui, bookingUrl, privacyHref, onEvent }: ChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [session, setSession] = useState<QualifyResponse | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [draft, setDraft] = useState('')
  const [view, setView] = useState<'chat' | 'contact'>('chat')
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const postOnce = useCallback(async (body: ApiBody): Promise<Response> => {
    return fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }, [])

  const call = useCallback(
    async (body: ApiBody, silent = false): Promise<QualifyResponse | null> => {
      setBusy(true)
      try {
        let response = await postOnce(body)
        if (response.status === 401 && body.action !== 'start') {
          // Session expired: restart cleanly with a fresh one.
          setMessages(toMessages('bot', [ui.sessionExpiredText]))
          response = await postOnce({ action: 'start' })
        }
        if (!response.ok) throw new Error(String(response.status))
        const data = (await response.json()) as QualifyResponse
        setSession(data)
        setMessages((previous) => [...previous, ...toMessages('bot', data.messages)])
        if (data.recommendation) onEvent?.('chat_recommendation', { id: data.recommendation.id })
        return data
      } catch {
        if (silent) return null
        setFailed(true)
        setMessages((previous) => [...previous, ...toMessages('bot', [ui.fallbackErrorText])])
        return null
      } finally {
        setBusy(false)
      }
    },
    [ui, onEvent, postOnce],
  )

  const toggle = () => {
    setOpen((value) => !value)
    if (!open && !session && !busy) {
      onEvent?.('chat_open')
      void call({ action: 'start' })
    }
  }

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, view])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const choose = (value: string, label: string) => {
    if (!session?.prompt || busy) return
    setMessages((previous) => [...previous, ...toMessages('user', [label])])
    void call({ action: 'choose', token: session.token, questionId: session.prompt.questionId, value })
  }

  const say = (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || !session || busy) return
    setDraft('')
    setMessages((previous) => [...previous, ...toMessages('user', [text])])
    void call({ action: 'say', token: session.token, text })
  }

  const locked = !session || session.closed || session.submitted || failed

  return (
    <div className="qc-root">
      {!open && (
        <button type="button" onClick={toggle} className="qc-toggle" aria-label={ui.toggleAriaLabel}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
          </svg>
          <span>{ui.toggleLabel}</span>
        </button>
      )}

      {open && (
        <section role="dialog" aria-label={ui.dialogAriaLabel} className="qc-dialog">
          <header className="qc-header">
            <div>
              <h2>{ui.headerTitle}</h2>
              <p>{ui.headerSubtitle}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="qc-close" aria-label={ui.closeAriaLabel}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div ref={logRef} className="qc-log" role="log" aria-live="polite">
            {messages.map((message) => (
              <p key={message.id} className={message.from === 'bot' ? 'qc-msg qc-msg-bot' : 'qc-msg qc-msg-user'}>
                {message.text}
              </p>
            ))}

            {busy && (
              <span className="qc-typing" aria-label={ui.typingAriaLabel}>
                <span />
                <span />
                <span />
              </span>
            )}

            {session?.recommendation && !session.submitted && view === 'chat' && (
              <div className="qc-recommendation">
                <p className="qc-tag">{session.recommendation.source === 'chosen' ? ui.chosenFormatLabel : ui.recommendedFormatLabel}</p>
                <h3>{session.recommendation.title}</h3>
                <p>{session.recommendation.description}</p>
              </div>
            )}

            {session?.submitted && session.recommendation && view === 'chat' && (
              <div role="status" className="qc-recommendation qc-status">
                <div>
                  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="currentColor" />
                    <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="var(--chat-bg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <div>
                  <p className="qc-tag">{ui.confirmation.title}</p>
                  {submittedEmail && (
                    <p>
                      {ui.confirmation.emailPrefix} <strong>{submittedEmail}</strong> {ui.confirmation.emailSuffix}
                    </p>
                  )}
                  <h3>{session.recommendation.title}</h3>
                </div>
              </div>
            )}

            {session?.submitted && view === 'chat' && bookingUrl && (
              <a href={bookingUrl} target="_blank" rel="noopener noreferrer" onClick={() => onEvent?.('chat_booking_after_lead')} className="qc-btn-secondary" style={{ textAlign: 'center' }}>
                {ui.confirmation.secondaryCtaLabel}
              </a>
            )}

            {view === 'contact' && session && !session.submitted && (
              <ContactForm
                copy={ui.contact}
                bookingUrl={bookingUrl}
                privacyHref={privacyHref}
                busy={busy}
                onCancel={() => setView('chat')}
                onSubmit={async (contact) => {
                  const data = await call({ action: 'contact', token: session.token, ...contact }, true)
                  if (!data?.submitted) return false
                  setSubmittedEmail(contact.email)
                  onEvent?.('chat_lead')
                  setView('chat')
                  return true
                }}
              />
            )}
          </div>

          <footer className="qc-footer">
            {session?.prompt && !busy && view === 'chat' && (
              <div className="qc-chips">
                {session.prompt.chips.map((chip) => (
                  <button key={chip.value} type="button" onClick={() => choose(chip.value, chip.label)} className="qc-chip">
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {(session?.showBooking || failed) && view === 'chat' && (
              <div className="qc-actions">
                {bookingUrl && (
                  <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="qc-btn-primary">
                    {ui.bookingButtonLabel}
                  </a>
                )}
                {session?.canContact && (
                  <button type="button" onClick={() => setView('contact')} className="qc-btn-secondary">
                    {ui.contactButtonLabel}
                  </button>
                )}
              </div>
            )}

            {view === 'chat' && (
              <form onSubmit={say} className="qc-form">
                <label htmlFor="qc-chat-input" className="qc-sr-only">
                  {ui.inputLabel}
                </label>
                <input
                  id="qc-chat-input"
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  maxLength={MAX_LENGTH}
                  disabled={locked}
                  autoComplete="off"
                  placeholder={locked ? ui.inputPlaceholderLocked : ui.inputPlaceholder}
                  className="qc-input"
                />
                <button type="submit" disabled={locked || busy || !draft.trim()} className="qc-send" aria-label={ui.sendAriaLabel}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M2 21 23 12 2 3v7l15 2-15 2z" />
                  </svg>
                </button>
              </form>
            )}
          </footer>
        </section>
      )}
    </div>
  )
}

interface ContactValues {
  firstName: string
  email: string
  phone?: string
  consent: true
  website: string
}

function ContactForm({
  copy,
  bookingUrl,
  privacyHref,
  busy,
  onSubmit,
  onCancel,
}: {
  copy: ChatUiCopy['contact']
  bookingUrl?: string
  privacyHref?: string
  busy: boolean
  onSubmit: (values: ContactValues) => Promise<boolean>
  onCancel: () => void
}) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sendFailed, setSendFailed] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const value = (name: string) => String(form.get(name) ?? '').trim()
    const next: Record<string, string> = {}
    if (!value('firstName')) next['firstName'] = copy.errors.firstNameRequired
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value('email'))) next['email'] = copy.errors.emailInvalid
    if (value('phone') && !/^[+()\d\s.-]{6,30}$/.test(value('phone'))) next['phone'] = copy.errors.phoneInvalid
    if (form.get('consent') !== 'on') next['consent'] = copy.errors.consentRequired
    setErrors(next)
    if (Object.keys(next).length > 0) return
    const sent = await onSubmit({
      firstName: value('firstName'),
      email: value('email'),
      ...(value('phone') ? { phone: value('phone') } : {}),
      consent: true,
      website: value('website'),
    })
    setSendFailed(!sent)
  }

  const errorFor = (name: string) => (errors[name] ? <span className="qc-field-error">{errors[name]}</span> : null)

  return (
    <form onSubmit={submit} noValidate className="qc-contact">
      <p style={{ margin: 0, fontWeight: 600 }}>{copy.title}</p>
      <div className="qc-field">
        <label htmlFor="qc-contact-firstName">{copy.firstNameLabel}</label>
        <input id="qc-contact-firstName" name="firstName" maxLength={60} autoComplete="given-name" aria-invalid={Boolean(errors['firstName'])} />
        {errorFor('firstName')}
      </div>
      <div className="qc-field">
        <label htmlFor="qc-contact-email">{copy.emailLabel}</label>
        <input id="qc-contact-email" name="email" type="email" maxLength={254} autoComplete="email" aria-invalid={Boolean(errors['email'])} />
        {errorFor('email')}
      </div>
      <div className="qc-field">
        <label htmlFor="qc-contact-phone">{copy.phoneLabel}</label>
        <input id="qc-contact-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" aria-invalid={Boolean(errors['phone'])} />
        {errorFor('phone')}
      </div>
      {/* Honeypot: invisible to humans, a bot fills every field. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="qc-honeypot" />
      <label className="qc-consent">
        <input id="qc-contact-consent" name="consent" type="checkbox" aria-invalid={Boolean(errors['consent'])} />
        <span>
          {copy.consentPrefix}{' '}
          {privacyHref ? (
            <a href={privacyHref} target="_blank" rel="noreferrer">
              {copy.consentLinkLabel}
            </a>
          ) : (
            copy.consentLinkLabel
          )}
        </span>
      </label>
      {errorFor('consent')}
      {sendFailed && (
        <p role="alert" className="qc-alert">
          {copy.sendFailedText}{' '}
          {bookingUrl && (
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
              {copy.sendFailedCtaLabel}
            </a>
          )}
        </p>
      )}
      <div className="qc-form-actions">
        <button type="submit" disabled={busy} className="qc-btn-primary">
          {busy ? copy.submitBusyLabel : copy.submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="qc-btn-cancel">
          {copy.cancelLabel}
        </button>
      </div>
    </form>
  )
}
