/** Typed judgments extracted from a free-text message, regardless of source (Jev or heuristic). */
export interface Understanding {
  source: 'jev' | 'heuristic'
  /** Guard probabilities (0-1). */
  guard: { jailbreak: number; offTopic: number; abuse: number }
  intent: 'answer' | 'faq' | 'book' | 'human' | 'other'
  /** Targeted FAQ entry, with confidence. */
  faq: { id: string; confidence: number } | null
  /** Detected answers for questions still open, keyed by question id. */
  slots: Record<string, { value: string; confidence: number } | undefined>
  usage?: { inputTokens: number }
}

export interface UnderstandContext {
  /** The question just asked (whose answer is expected next), or null once the flow is complete. */
  current: string | null
  /** Question ids still unanswered, including `current`. */
  pending: string[]
}

export type Understander = (text: string, context: UnderstandContext) => Promise<Understanding>
