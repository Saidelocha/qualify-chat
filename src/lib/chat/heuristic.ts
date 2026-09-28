import type { ChatConfig, HeuristicGuards } from './config'
import type { UnderstandContext, Understanding } from './understanding'

/**
 * Local, AI-free fallback: used when no TypeSafe key is configured, or when Jev fails.
 * Less subtle than Jev on paraphrases, but safe — worst case, the flow re-asks with chips.
 */

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

/** Generic EN+FR default guard patterns. Brand-neutral: no product names, no URLs. */
export const DEFAULT_HEURISTIC_GUARDS: HeuristicGuards = {
  jailbreak: [
    /ignore[rsz]? (toutes? )?(tes|vos|les) (instructions|consignes|regles)/,
    /oublie[rsz]? (toutes? )?(tes|vos|les) (instructions|consignes|regles)/,
    /(ignore|disregard|forget) (all |your |the |previous )+(instructions|rules|prompt)/,
    /tu (es|seras) (desormais|maintenant|a present) (un|une|mon)/,
    /(tu n.?es|vous n.?etes) plus (un|une|l.?assistant)/,
    /(tu peux|reponds?) (repondre )?librement/,
    /(system|systeme) ?prompt|prompt (systeme|initial)|tes instructions (initiales|systeme)/,
    /(montre|affiche|revele|donne|repete)[a-z]* (moi )?(ton|tes|le) (prompt|instructions|consignes)/,
    /mode (developpeur|dev|dan|jailbreak)|\bdan\b|jailbreak/,
    /you are now|act as|pretend (to be|you are)|roleplay/,
    /fais comme si tu (etais|n.?avais)|joue le role/,
    /tu dois m.?obeir|obeis/,
  ],
  abuse: [
    /\b(connard|connasse|encule|salope|pute|batard|abruti|debile|idiot|cretin|ta gueule|fdp|ntm|nique|merde)\b/,
    /\b(fuck|shit|bitch|asshole)\b/,
  ],
  offTopic: [
    /meteo|temperature exterieure|weather/,
    /poeme|chanson|blague|histoire drole|\bpoem\b|\bsong\b|\bjoke\b/,
    /recette|cuisine|recipe|cooking/,
    /\b(code|python|javascript|programme informatique|sql)\b/,
    /capitale de|qui a gagne|resultat du match|capital of|who won/,
    /\d+\s*[+*/x-]\s*\d+/,
    /tradui[st]|translate/,
    /bitcoin|crypto|bourse|stock market/,
  ],
  book: [
    /reserv|prendre (un )?(rdv|rendez-vous)|creneau|appel(er)?|dispo/,
    /\bbook|schedule (a|the)|\bslot\b|\bcall\b|appointment|availab/,
  ],
  human: [
    /parler a (un humain|quelqu.?un)|humain|vrai personne/,
    /(talk|speak) (to|with) (a human|someone|a person)|\bhuman\b|real person/,
  ],
}

const matches = (text: string, patterns: readonly RegExp[]) => patterns.some((pattern) => pattern.test(text))

export function createHeuristicUnderstander(config: ChatConfig) {
  const guards: HeuristicGuards = {
    jailbreak: config.heuristicGuards?.jailbreak ?? DEFAULT_HEURISTIC_GUARDS.jailbreak,
    abuse: config.heuristicGuards?.abuse ?? DEFAULT_HEURISTIC_GUARDS.abuse,
    offTopic: config.heuristicGuards?.offTopic ?? DEFAULT_HEURISTIC_GUARDS.offTopic,
    book: config.heuristicGuards?.book ?? DEFAULT_HEURISTIC_GUARDS.book,
    human: config.heuristicGuards?.human ?? DEFAULT_HEURISTIC_GUARDS.human,
  }
  const questionsById = new Map(config.questions.map((question) => [question.id, question]))
  const faqPatterns = config.faq
    .filter((entry) => entry.patterns && entry.patterns.length > 0)
    .map((entry) => [entry.id, entry.patterns as RegExp[]] as const)

  return function understandSync(text: string, context: UnderstandContext): Understanding {
    const normalized = normalize(text)

    const slots: Understanding['slots'] = {}
    for (const questionId of context.pending) {
      const question = questionsById.get(questionId)
      if (!question) continue
      const hit = Object.entries(question.options).find(([, option]) => matches(normalized, option.patterns ?? []))
      if (hit) slots[questionId] = { value: hit[0], confidence: 0.75 }
    }

    const faqHit = faqPatterns.find(([, patterns]) => matches(normalized, patterns))
    const isQuestion =
      /\?|^(comment|combien|est-ce|pourquoi|quel|quelle|quand|ou|vous|c'est|how|what|when|where|why|do|does|is|are|can|will)\b/.test(
        normalized,
      )
    const faq = faqHit && (isQuestion || Object.keys(slots).length === 0) ? { id: faqHit[0], confidence: 0.7 } : null

    const jailbreak = matches(normalized, guards.jailbreak) ? 0.95 : 0
    const abuse = matches(normalized, guards.abuse) ? 0.9 : 0
    const understoodSomething = Object.keys(slots).length > 0 || faq !== null
    const offTopic = !understoodSomething && matches(normalized, guards.offTopic) ? 0.85 : 0

    const intent: Understanding['intent'] = matches(normalized, guards.human)
      ? 'human'
      : matches(normalized, guards.book)
        ? 'book'
        : faq
          ? 'faq'
          : Object.keys(slots).length > 0
            ? 'answer'
            : 'other'

    return { source: 'heuristic', guard: { jailbreak, offTopic, abuse }, intent, faq, slots }
  }
}
