import { defineChatConfig, type ChatConfig, type Recommendation } from '../src/lib/chat/config'

/**
 * Même parcours qu'agency.en.ts, en français — preuve que le chat est multilingue.
 * `meaning` reste en anglais (transmis à Jev), `label`/`prompt`/messages sont en français.
 */

const OFFERS: Record<'landing' | 'website' | 'shop', Recommendation> = {
  landing: {
    id: 'landing',
    title: 'Site vitrine une page',
    description: 'Une landing page rapide et efficace — livrée en une semaine environ.',
  },
  website: {
    id: 'website',
    title: 'Site complet',
    description: 'Un site multi-pages avec votre identité, votre contenu et un CMS.',
  },
  shop: {
    id: 'shop',
    title: 'Boutique en ligne',
    description: 'Un site e-commerce complet : catalogue, paiement, tout branché.',
  },
}

const config: ChatConfig = defineChatConfig({
  lang: 'fr',
  scope:
    'An assistant for a French freelance web design and development agency. It only helps visitors describe their website project (new site, redesign, online store, web app), answers questions about the process, timeline and pricing, then recommends a package.',

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
      prompt: 'Quel type de projet avez-vous en tête ?',
      options: {
        newSite: {
          label: 'Un nouveau site',
          meaning: 'a brand-new website built from scratch, no existing site',
          patterns: [/nouveau site/, /a partir de zero|page blanche/, /pas encore de site/],
        },
        redesign: {
          label: 'Une refonte de site existant',
          meaning: 'redesigning or rebuilding an existing website',
          patterns: [/refonte/, /reconstruire/, /site existant/, /site actuel/],
        },
        shop: {
          label: 'Une boutique en ligne',
          meaning: 'an online store or e-commerce site to sell products',
          patterns: [/boutique/, /e-?commerce/, /vendre en ligne/, /shopify|woocommerce/],
        },
        webapp: {
          label: 'Une application web',
          meaning: 'a web application, customer portal, or product with login and custom features',
          patterns: [/application web|web ?app/, /\bportail\b/, /tableau de bord/, /saas/, /outil sur mesure/],
        },
        other: {
          label: 'Autre chose',
          meaning: 'another kind of project not listed above',
          patterns: [/\bautre\b/],
        },
      },
    },
    {
      id: 'timeline',
      prompt: 'Pour quand en avez-vous besoin ?',
      options: {
        asap: {
          label: 'Le plus vite possible',
          meaning: 'within the next two weeks, urgently',
          patterns: [/urgent/, /cette semaine|semaine prochaine/, /quelques jours/, /dans (\d|1[0-3]) jours?/],
        },
        weeks: {
          label: 'Dans quelques semaines',
          meaning: 'two to six weeks from now',
          patterns: [/dans ([2-6]|deux|trois|quatre|cinq|six) semaines/, /dans un mois/, /le mois prochain/],
        },
        months: {
          label: 'Dans un a trois mois',
          meaning: 'one to three months from now',
          patterns: [/dans ([2-3]|deux|trois) mois/, /d.?ici (2|3|deux|trois) mois/],
        },
        flexible: {
          label: 'Pas de date fixe',
          meaning: 'more than three months away, or no date set yet',
          patterns: [/pas (encore )?de date/, /pas presse/, /(quatre|cinq|six|4|5|6) mois/, /l.?annee prochaine/],
        },
      },
    },
    {
      id: 'status',
      prompt: 'Où en êtes-vous aujourd\'hui ?',
      options: {
        nothing: {
          label: 'Rien encore, juste une idée',
          meaning: 'nothing prepared, just an idea',
          patterns: [/rien (de pret|encore)/, /juste une idee/, /partir de zero/],
        },
        brief: {
          label: 'J\'ai un brief ou du contenu',
          meaning: 'a written brief, content or requirements already exist',
          patterns: [/j.?ai un brief/, /contenu (pret|deja pret)/, /cahier des charges/],
        },
        designs: {
          label: 'J\'ai des maquettes',
          meaning: 'designs, mockups or wireframes already exist',
          patterns: [/maquettes?/, /figma/, /deja designe/],
        },
        existingSite: {
          label: 'J\'ai un site à améliorer',
          meaning: 'an existing live site that needs improving or migrating',
          patterns: [/site existant/, /site actuel/, /deja en ligne/, /migrat/],
        },
      },
    },
    {
      id: 'package',
      prompt: 'Quelle formule vous semble adaptée, ou on en discute ensemble ?',
      options: {
        landing: {
          label: 'Site vitrine une page — petit budget',
          meaning: 'a single landing page, the smallest budget',
          patterns: [/une page/, /landing page/, /petit budget/],
        },
        website: {
          label: 'Site complet',
          meaning: 'a full multi-page website with a CMS',
          patterns: [/site complet/, /plusieurs pages/, /\bcms\b/],
        },
        shop: {
          label: 'Boutique en ligne — budget le plus important',
          meaning: 'a full online store with checkout and payments, the largest budget',
          patterns: [/formule (boutique|e-?commerce)/, /e-?commerce complet/, /paiement/, /(plus gros|gros) budget/],
        },
        unsure: {
          label: 'Je ne sais pas, conseillez-moi',
          meaning: 'undecided about the package or budget, wants advice',
          patterns: [/ne sais pas|sais pas encore|aucune idee/, /conseill?e?[rz]?-?moi/, /hesite/],
        },
      },
    },
  ],

  faq: [
    {
      id: 'pricing',
      question: 'Combien coûte un projet ?',
      answer:
        'Le site vitrine une page démarre à 1 200 €. Un site complet démarre à 3 500 €. Une boutique en ligne démarre à 6 000 €. Le prix exact dépend du périmètre — on peut vous donner un chiffre précis lors d\'un appel rapide.',
      patterns: [/c.?est combien|combien (ca |coute|pour|de |faut)/, /\bprix\b|tarif|\bcout(e|ent|s)?\b|budget/],
    },
    {
      id: 'timeline_faq',
      question: 'Combien de temps prend un projet ?',
      answer: 'Une landing page est livrée en une semaine environ. Un site complet prend trois à six semaines. Une boutique en ligne prend quatre à huit semaines selon le catalogue.',
      patterns: [/combien de temps|delai/],
    },
    {
      id: 'tech',
      question: 'Quelle technologie utilisez-vous ?',
      answer: 'Des stacks modernes, rapides et maintenables — généralement Next.js et un CMS headless, ou Shopify pour les boutiques. Vous êtes toujours propriétaire du code et du contenu.',
      patterns: [/technologie|stack/, /wordpress|shopify|next\.?js/, /propriete|proprietaire/],
    },
    {
      id: 'remote',
      question: 'Travaille-t-on à distance ?',
      answer: 'Oui — tout se fait à distance, avec des points asynchrones et un court appel hebdomadaire si utile.',
      patterns: [/distance|visio|en ligne|presentiel/],
    },
    {
      id: 'guarantee',
      question: 'Y a-t-il une garantie ?',
      answer: 'Si le premier jalon ne vous convient pas, vous pouvez arrêter sans engagement au-delà de ce jalon.',
      patterns: [/garantie|rembours/],
    },
  ],

  messages: {
    welcome: 'Bonjour ! Je vais vous poser quelques questions rapides sur votre projet, puis vous recommander une formule.',
    turnLimit: 'On a fait le tour — continuons plutôt lors d\'un appel rapide.',
    closed: 'Je m\'arrête ici — contactez-nous directement pour reprendre avec une personne de l\'équipe.',
    jailbreak: 'Je ne peux vous aider que sur votre projet de site — revenons-y.',
    abuse: 'Restons courtois — je ne peux vous aider que sur vos questions de projet.',
    offTopic: 'Cela sort de ce que je peux traiter — je suis là pour votre projet de site.',
    notUnderstood: 'Je n\'ai pas bien compris — vous pouvez aussi choisir une des options ci-dessous.',
    noted: (understood) => `Noté : ${understood}.`,
    book: () => 'Envie d\'un appel rapide ? Utilisez le bouton ci-dessous.',
    human: (contactEmail) => `Vous pouvez joindre une personne directement à ${contactEmail}.`,
    leadSent: (firstName) => `Merci ${firstName}, nous revenons vers vous rapidement !`,
    alreadySent: 'Nous avons déjà vos coordonnées — à bientôt !',
    recommendation: {
      chosen: (title, description) => `Excellent choix : ${title}. ${description}`,
      recommended: (title, description) => `D'après ce que vous m'avez dit, je recommande : ${title}. ${description}`,
      next: () => 'Prochaine étape : réservez un appel gratuit, ou laissez vos coordonnées.',
    },
  },

  ui: {
    toggleLabel: 'Discuter',
    toggleAriaLabel: 'Ouvrir le chat projet',
    headerTitle: 'Assistant projet',
    headerSubtitle: 'Répond en quelques secondes',
    closeAriaLabel: 'Fermer le chat',
    dialogAriaLabel: 'Chat de qualification projet',
    typingAriaLabel: 'En train d\'écrire',
    inputLabel: 'Votre message',
    inputPlaceholder: 'Écrivez un message…',
    inputPlaceholderLocked: 'Utilisez les boutons ci-dessus pour continuer',
    sendAriaLabel: 'Envoyer',
    bookingButtonLabel: 'Réserver un appel gratuit',
    contactButtonLabel: 'Laisser mes coordonnées',
    chosenFormatLabel: 'Votre choix',
    recommendedFormatLabel: 'Recommandé pour vous',
    sessionExpiredText: 'Votre session a expiré — on recommence.',
    fallbackErrorText: 'Un problème est survenu de notre côté — réessayez dans un instant.',
    confirmation: {
      title: 'Merci, coordonnées envoyées !',
      emailPrefix: 'Nous vous répondrons à',
      emailSuffix: 'rapidement.',
      secondaryCtaLabel: 'Ou réservez un appel maintenant',
    },
    contact: {
      title: 'Laissez vos coordonnées',
      firstNameLabel: 'Prénom',
      emailLabel: 'E-mail',
      phoneLabel: 'Téléphone (optionnel)',
      consentPrefix: 'J\'accepte d\'être contacté au sujet de mon projet, selon la',
      consentLinkLabel: 'politique de confidentialité',
      submitLabel: 'Envoyer',
      submitBusyLabel: 'Envoi…',
      cancelLabel: 'Annuler',
      sendFailedText: 'Échec de l\'envoi — réessayez, ou',
      sendFailedCtaLabel: 'réservez un appel à la place',
      errors: {
        firstNameRequired: 'Merci d\'indiquer votre prénom.',
        emailInvalid: 'Merci d\'indiquer un e-mail valide.',
        phoneInvalid: 'Merci d\'indiquer un numéro valide.',
        consentRequired: 'Merci d\'accepter d\'être contacté.',
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
    ownerEmail: 'bonjour@example.com',
    bookingUrl: 'https://example.com/reserver',
    privacyHref: '/confidentialite',
  },
})

export default config
