import { defineChatConfig, type ChatConfig } from '../config'

/** Minimal but structurally complete config used across unit tests. */
export function makeTestConfig(overrides: Partial<ChatConfig> = {}): ChatConfig {
  return defineChatConfig({
    lang: 'en',
    scope: 'A test assistant for widgets.',
    questions: [
      {
        id: 'need',
        prompt: 'What do you need?',
        options: {
          widget: { label: 'A widget', meaning: 'they need a widget', patterns: [/widget/] },
          gadget: { label: 'A gadget', meaning: 'they need a gadget', patterns: [/gadget/] },
        },
      },
      {
        id: 'timeline',
        prompt: 'When do you need it?',
        options: {
          soon: { label: 'Soon', meaning: 'urgently, within days', patterns: [/urgent|asap|soon/] },
          later: { label: 'Later', meaning: 'no rush', patterns: [/later|no rush|whenever/] },
        },
      },
    ],
    faq: [
      { id: 'pricing', question: 'How much?', answer: 'It depends.', patterns: [/how much|price|cost/] },
    ],
    messages: {
      welcome: 'Welcome!',
      turnLimit: 'Turn limit reached.',
      closed: 'Closed.',
      jailbreak: 'Jailbreak warning.',
      abuse: 'Abuse warning.',
      offTopic: 'Off topic warning.',
      notUnderstood: 'Not understood.',
      noted: (understood) => `Noted: ${understood}`,
      book: () => 'Book a call.',
      human: (email) => `Contact ${email}.`,
      leadSent: (firstName) => `Thanks ${firstName}.`,
      alreadySent: 'Already sent.',
      recommendation: {
        chosen: (title, description) => `Chosen: ${title} - ${description}`,
        recommended: (title, description) => `Recommended: ${title} - ${description}`,
        next: () => 'Next step.',
      },
    },
    ui: {
      toggleLabel: 'Chat',
      toggleAriaLabel: 'Open chat',
      headerTitle: 'Assistant',
      headerSubtitle: 'Subtitle',
      closeAriaLabel: 'Close',
      dialogAriaLabel: 'Dialog',
      typingAriaLabel: 'Typing',
      inputLabel: 'Message',
      inputPlaceholder: 'Type…',
      inputPlaceholderLocked: 'Locked',
      sendAriaLabel: 'Send',
      bookingButtonLabel: 'Book',
      contactButtonLabel: 'Contact',
      chosenFormatLabel: 'Chosen',
      recommendedFormatLabel: 'Recommended',
      sessionExpiredText: 'Expired.',
      fallbackErrorText: 'Error.',
      confirmation: { title: 'Sent!', emailPrefix: 'We will reach', emailSuffix: 'soon.', secondaryCtaLabel: 'Book now' },
      contact: {
        title: 'Contact',
        firstNameLabel: 'First name',
        emailLabel: 'Email',
        phoneLabel: 'Phone',
        consentPrefix: 'I agree,',
        consentLinkLabel: 'policy',
        submitLabel: 'Send',
        submitBusyLabel: 'Sending…',
        cancelLabel: 'Cancel',
        sendFailedText: 'Failed,',
        sendFailedCtaLabel: 'book instead',
        errors: {
          firstNameRequired: 'First name required.',
          emailInvalid: 'Invalid email.',
          phoneInvalid: 'Invalid phone.',
          consentRequired: 'Consent required.',
        },
      },
    },
    scoring: {
      questionWeights: { need: 60, timeline: 40 },
      weights: {
        need: { widget: 100, gadget: 60 },
        timeline: { soon: 100, later: 50 },
      },
      recommend(answers) {
        if (answers['need'] === 'gadget') return { id: 'gadget', title: 'Gadget plan', description: 'For gadgets.' }
        return { id: 'widget', title: 'Widget plan', description: 'For widgets.' }
      },
    },
    contact: { enabled: true, ownerEmail: 'owner@example.com' },
    ...overrides,
  })
}
