import { logger } from './logger'
import { createHeuristicUnderstander } from './heuristic'
import { createJevUnderstander } from './jev'
import type { ChatConfig } from './config'
import type { UnderstandContext, Understander, Understanding } from './understanding'

/**
 * Understanding entry point: Jev when a TypeSafe key is configured, heuristic fallback
 * otherwise or on Jev failure. The heuristic guards always run in addition (defense in
 * depth, zero cost).
 */
export function createUnderstander(config: ChatConfig, options: { jev?: Understander | null } = {}): Understander {
  const local = createHeuristicUnderstander(config)
  const jev = options.jev === undefined ? (process.env['TYPESAFE_API_KEY'] ? createJevUnderstander(config) : null) : options.jev

  return async (text: string, context: UnderstandContext): Promise<Understanding> => {
    const heuristic = local(text, context)
    if (!jev) return heuristic

    try {
      const remote = await jev(text, context)
      return {
        ...remote,
        guard: {
          jailbreak: Math.max(remote.guard.jailbreak, heuristic.guard.jailbreak),
          offTopic: remote.guard.offTopic,
          abuse: Math.max(remote.guard.abuse, heuristic.guard.abuse),
        },
      }
    } catch (error) {
      logger.warn('Jev unavailable, falling back to heuristic', { reason: error instanceof Error ? error.name : 'unknown' })
      return heuristic
    }
  }
}
