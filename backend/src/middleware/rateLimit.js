import { GraphQLError, parse, visit } from 'graphql'

export function createFixedWindowRateLimiter({ limit, windowMs, maxKeys = 10000 }) {
  const windows = new Map()

  const consume = (key, now = Date.now()) => {
    let entry = windows.get(key)
    if (!entry || entry.expiresAt <= now) {
      if (windows.size >= maxKeys) {
        for (const [storedKey, storedEntry] of windows) {
          if (storedEntry.expiresAt <= now) windows.delete(storedKey)
        }
      }
      if (windows.size >= maxKeys) {
        return { allowed: false, retryAfterMs: windowMs, firstExceeded: false }
      }
      entry = { count: 0, expiresAt: now + windowMs, blocked: false }
      windows.set(key, entry)
    }

    if (entry.count >= limit) {
      const firstExceeded = !entry.blocked
      entry.blocked = true
      return { allowed: false, retryAfterMs: entry.expiresAt - now, firstExceeded }
    }

    entry.count += 1
    return { allowed: true, retryAfterMs: 0 }
  }

  return { consume }
}

const clientAddress = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'unknown'

const rejectTooManyRequests = (res, retryAfterMs) => {
  res.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterMs / 1000))))
  res.status(429).json({ errors: [{ message: 'Too many requests. Please try again later.' }] })
}

const logLimitExceeded = (scope) => {
  /* eslint-disable-next-line no-console */
  console.warn(`Rate limit exceeded: ${scope}`)
}

export function countLoginFields(query) {
  if (typeof query !== 'string' || !query) return 0

  let loginFields = 0
  let document
  try {
    document = parse(query)
  } catch (error) {
    if (error instanceof GraphQLError) return 0
    throw error
  }
  visit(document, {
    Field(node) {
      if (node.name.value === 'login') loginFields += 1
    },
  })
  return loginFields
}

export function createRateLimitMiddleware(limiter, scope = 'API') {
  return (req, res, next) => {
    const result = limiter.consume(clientAddress(req))
    if (!result.allowed) {
      if (result.firstExceeded) logLimitExceeded(scope)
      return rejectTooManyRequests(res, result.retryAfterMs)
    }
    next()
  }
}

export function createDisableBatchingMiddleware() {
  return (req, res, next) => {
    if (Array.isArray(req.body)) {
      return res.status(400).json({
        errors: [{ message: 'Batched GraphQL requests are not supported.' }],
      })
    }
    next()
  }
}

export function createLoginRateLimitMiddleware(limiter) {
  return (req, res, next) => {
    const query =
      (req.body && typeof req.body.query === 'string' && req.body.query) ||
      (req.query && typeof req.query.query === 'string' && req.query.query)
    const loginFields = countLoginFields(query)

    for (let attempt = 0; attempt < loginFields; attempt += 1) {
      const result = limiter.consume(clientAddress(req))
      if (!result.allowed) {
        if (result.firstExceeded) logLimitExceeded('login')
        return rejectTooManyRequests(res, result.retryAfterMs)
      }
    }
    next()
  }
}
