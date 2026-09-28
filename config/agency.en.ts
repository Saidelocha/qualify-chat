import { defineChatConfig, type ChatConfig, type Recommendation } from '../src/lib/chat/config'

/**
 * Example flow: a freelance web agency qualifying an incoming website project.
 * Nothing here is special-cased by the library — it's all driven by this file.
 * Swap it for your own flow by editing `chat.config.ts` at the repo root.
 */

const OFFERS: Record<'landing' | 'website' | 'shop', Recommendation> = {
  landing: {
    id: 'landing',
    title: 'One-page launch',
    description: 'A fast, focused landing page — built and shipped in about a week.',
  },
  website: {
    id: 'website',
    title: 'Full website build',
    description: 'A multi-page site with your own design system, content and a CMS.',
  },
  shop: {
    id: 'shop',
    title: 'Online store',
    description: 'A complete e-commerce build: catalog, checkout, and payments wired up.',
  },
}

const config: ChatConfig = defineChatConfig({
  lang: 'en',
  scope:
    'An assistant for a freelance web design and development agency. It only helps visitors describe their website project (new site, redesign, online store, web app), answers questions about the process, timeline and pricing, then recommends a package.',

  intents: {
    answer: 'answers the assistant question or describes their own project, timeline or budget',
    faq: 'asks a question about the agency: pricing, process, timeline, technology, ownership of the code',
    book: 'wants to book a call or be contacted now',
    human: 'wants to talk directly to a human rather than the assistant',
    other: 'none of these: greeting, chit-chat, gibberish or an unrelated request',
  },

  questions: [
    {
      id: 'project',
      prompt: 'What kind of project is this?',
      options: {
        newSite: {
          label: 'A brand-new website',
          meaning: 'a brand-new website built from scratch, no existing site',
          patterns: [/new (site|website)/, /from scratch/, /starting fresh/, /don.?t have a (site|website)/],
        },
        redesign: {
          label: 'Redesigning an existing site',
          meaning: 'redesigning or rebuilding an existing website',
          patterns: [/redesign/, /rebuild/, /revamp/, /existing (site|website)/, /current (site|website)/],
        },
        shop: {
          label: 'An online store',
          meaning: 'an online store or e-commerce site to sell products',
          patterns: [/(online )?(store|shop)\b/, /e-?commerce/, /sell (products|online)/, /shopify|woocommerce/],
        },
        webapp: {
          label: 'A web app or portal',
          meaning: 'a web application, customer portal, or product with login and custom features',
          patterns: [/web ?app/, /\bportal\b/, /dashboard/, /saas/, /custom (app|application|tool)/],
        },
        other: {
          label: 'Something else',
          meaning: 'another kind of project not listed above',
          patterns: [/something else|\bother\b/],
        },
      },
    },
    {
      id: 'timeline',
      prompt: 'When do you need it live?',
      options: {
        asap: {
          label: 'As soon as possible',
          meaning: 'within the next two weeks, urgently',
          patterns: [/asap|urgent/, /this week|next week/, /(a )?few days/, /in (\d|1[0-3]) days?/],
        },
        weeks: {
          label: 'In a few weeks',
          meaning: 'two to six weeks from now',
          patterns: [/in ([2-6]|two|three|four|five|six) weeks/, /in (a|one) month/, /next month/],
        },
        months: {
          label: 'In one to three months',
          meaning: 'one to three months from now',
          patterns: [/in ([2-3]|two|three) months/, /within (2|3|two|three) months/],
        },
        flexible: {
          label: 'No fixed date',
          meaning: 'more than three months away, or no date set yet',
          patterns: [/no (fixed )?date/, /no deadline/, /no rush/, /flexible/, /(four|five|six|4|5|6) months/, /next year/],
        },
      },
    },
    {
      id: 'status',
      prompt: 'Where are you starting from?',
      options: {
        nothing: {
          label: 'Nothing yet, just an idea',
          meaning: 'nothing prepared, just an idea',
          patterns: [/nothing (ready|yet)/, /just an idea/, /from scratch|blank page/, /(haven.?t|not) started/],
        },
        brief: {
          label: 'I have a brief or content',
          meaning: 'a written brief, content or requirements already exist',
          patterns: [/(have|got) a brief/, /content is ready/, /requirements/, /\bspec\b/],
        },
        designs: {
          label: 'I have designs or mockups',
          meaning: 'designs, mockups or wireframes already exist',
          patterns: [/(have|got) (designs?|mockups?|wireframes?)/, /figma/, /already designed/],
        },
        existingSite: {
          label: 'I have an existing site to improve',
          meaning: 'an existing live site that needs improving or migrating',
          patterns: [/existing site/, /current site/, /already (have|live)/, /migrat/],
        },
      },
    },
    {
      id: 'package',
      prompt: 'Which package sounds right, or should we figure it out together?',
      options: {
        landing: {
          label: 'One-page launch — smallest budget',
          meaning: 'a single landing page, the smallest budget',
          patterns: [/one[- ]page/, /landing page/, /small budget|tight budget/],
        },
        website: {
          label: 'Full website build',
          meaning: 'a full multi-page website with a CMS',
          patterns: [/full (site|website)/, /multi[- ]page/, /\bcms\b/],
        },
        shop: {
          label: 'Online store — largest budget',
          meaning: 'a full online store with checkout and payments, the largest budget',
          patterns: [/(store|shop|e-?commerce) (package|plan|option)/, /full (shop|e-?commerce)/, /checkout|payments?/, /(largest|biggest) budget/],
        },
        unsure: {
          label: "I'm not sure, advise me",
          meaning: 'undecided about the package or budget, wants advice',
          patterns: [/(don.?t|do not) know|not sure|no idea/, /advise me|recommend/, /undecided/],
        },
      },
    },
  ],

  faq: [
    {
      id: 'pricing',
      question: 'How much does a project cost?',
      answer:
        'One-page launch starts at $1,200. A full website build starts at $3,500. An online store starts at $6,000. Exact pricing depends on scope — happy to give you a precise number on a quick call.',
      patterns: [/how much|what does it cost|\bcosts?\b/, /\bprices?\b|pricing|\brates?\b|\bfees?\b|\bbudget\b/],
    },
    {
      id: 'timeline_faq',
      question: 'How long does a project take?',
      answer: 'A landing page usually ships in about a week. A full website takes three to six weeks. Online stores take four to eight weeks depending on catalog size.',
      patterns: [/how long|turnaround|timeline/],
    },
    {
      id: 'tech',
      question: 'What technology do you use?',
      answer: 'Modern, fast, maintainable stacks — typically Next.js and a headless CMS, or Shopify for stores. You always own the code and the content.',
      patterns: [/tech(nology|stack)?/, /wordpress|shopify|next\.?js/, /who owns|ownership/],
    },
    {
      id: 'remote',
      question: 'Do we work remotely?',
      answer: 'Yes — everything is remote, with async updates and a short weekly call if useful.',
      patterns: [/remote|online|video|zoom|in person|face to face/],
    },
    {
      id: 'guarantee',
      question: 'Is there a guarantee?',
      answer: 'If you are not happy with the first milestone, you can stop with no obligation beyond that milestone.',
      patterns: [/guarantee|refund|money back/],
    },
  ],

  messages: {
    welcome: "Hi! I'll ask a few quick questions to understand your project, then recommend a package.",
    turnLimit: "We've covered a lot — let's continue this over a quick call.",
    closed: "I'll pause here — please reach out directly and we'll pick this up with a human.",
    jailbreak: "I can only help with questions about your website project — let's get back to it.",
    abuse: "Let's keep this friendly — I'm only able to help with your project questions.",
    offTopic: "That's outside what I can help with — I'm here for your website project.",
    notUnderstood: "I didn't quite catch that — you can also just tap one of the options below.",
    noted: (understood) => `Got it — noted: ${understood}.`,
    book: () => 'Want to jump on a quick call? Use the button below.',
    human: (contactEmail) => `You can reach a human directly at ${contactEmail}.`,
    leadSent: (firstName) => `Thanks, ${firstName} — we'll be in touch shortly!`,
    alreadySent: "We've already got your details — talk soon!",
    recommendation: {
      chosen: (title, description) => `Great choice: ${title}. ${description}`,
      recommended: (title, description) => `Based on what you've told me, I'd recommend: ${title}. ${description}`,
      next: () => 'Next step: book a free call, or leave your details and we will reach out.',
    },
  },

  ui: {
    toggleLabel: 'Chat with us',
    toggleAriaLabel: 'Open the project chat',
    headerTitle: 'Project assistant',
    headerSubtitle: 'Usually replies in a few seconds',
    closeAriaLabel: 'Close the chat',
    dialogAriaLabel: 'Project qualification chat',
    typingAriaLabel: 'Typing',
    inputLabel: 'Your message',
    inputPlaceholder: 'Type a message…',
    inputPlaceholderLocked: 'Use the buttons above to continue',
    sendAriaLabel: 'Send',
    bookingButtonLabel: 'Book a free call',
    contactButtonLabel: 'Leave my details',
    chosenFormatLabel: 'Your pick',
    recommendedFormatLabel: 'Recommended for you',
    sessionExpiredText: "Your session expired — let's start again.",
    fallbackErrorText: 'Something went wrong on our end — please try again in a moment.',
    confirmation: {
      title: 'Thanks — details sent!',
      emailPrefix: "We'll follow up at",
      emailSuffix: 'shortly.',
      secondaryCtaLabel: 'Or book a call now',
    },
    contact: {
      title: 'Leave your details',
      firstNameLabel: 'First name',
      emailLabel: 'Email',
      phoneLabel: 'Phone (optional)',
      consentPrefix: 'I agree to be contacted about my project, per the',
      consentLinkLabel: 'privacy policy',
      submitLabel: 'Send',
      submitBusyLabel: 'Sending…',
      cancelLabel: 'Cancel',
      sendFailedText: 'Could not send — please try again, or',
      sendFailedCtaLabel: 'book a call instead',
      errors: {
        firstNameRequired: 'Please enter your first name.',
        emailInvalid: 'Please enter a valid email.',
        phoneInvalid: 'Please enter a valid phone number.',
        consentRequired: 'Please accept to be contacted.',
      },
    },
  },

  scoring: {
    questionWeights: { project: 35, timeline: 25, package: 30, status: 10 },
    weights: {
      project: { shop: 100, webapp: 90, redesign: 80, newSite: 75, other: 40 },
      timeline: { asap: 100, weeks: 85, months: 60, flexible: 25 },
      package: { shop: 100, website: 90, landing: 70, unsure: 50 },
      status: { brief: 100, designs: 90, existingSite: 85, nothing: 70 },
    },
    grades: [
      { min: 80, grade: 'A' },
      { min: 65, grade: 'B' },
      { min: 50, grade: 'C' },
      { min: 0, grade: 'D' },
    ],
    recommend(answers) {
      const { package: pkg, project, timeline } = answers
      if (pkg && pkg !== 'unsure' && pkg in OFFERS) return OFFERS[pkg as keyof typeof OFFERS]
      if (project === 'shop') return OFFERS.shop
      if (project === 'webapp' || project === 'redesign') return OFFERS.website
      if (timeline === 'asap') return OFFERS.landing
      return OFFERS.website
    },
  },

  thresholds: { guard: 0.7, currentQuestion: 0.5, otherQuestion: 0.6, faq: 0.55 },

  contact: {
    enabled: true,
    ownerEmail: 'hello@example.com',
    bookingUrl: 'https://example.com/book',
    privacyHref: '/privacy',
  },
})

export default config
