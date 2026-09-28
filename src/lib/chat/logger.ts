/**
 * Minimal leveled logger. Never pass raw visitor text to it — only structured metadata
 * (ids, counts, booleans). Level is controlled by `LOG_LEVEL` (debug|info|warn|error), default info.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const
type Level = keyof typeof LEVELS

function currentLevel(): Level {
  const raw = process.env['LOG_LEVEL']?.toLowerCase()
  return raw === 'debug' || raw === 'info' || raw === 'warn' || raw === 'error' ? raw : 'info'
}

function log(level: Level, message: string, meta?: Record<string, unknown>) {
  if (LEVELS[level] < LEVELS[currentLevel()]) return
  const line = { level, message, ...meta }
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  fn(JSON.stringify(line))
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log('debug', message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
}
