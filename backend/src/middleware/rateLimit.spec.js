import {
  createDisableBatchingMiddleware,
  createFixedWindowRateLimiter,
  createLoginRateLimitMiddleware,
  createRateLimitMiddleware,
} from './rateLimit'

describe('fixed-window rate limiter', () => {
  it('limits requests per key and resets after the window expires', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 2, windowMs: 1000 })

    expect(limiter.consume('client', 0).allowed).toBe(true)
    expect(limiter.consume('client', 1).allowed).toBe(true)
    expect(limiter.consume('client', 2)).toEqual({
      allowed: false,
      retryAfterMs: 998,
      firstExceeded: true,
    })
    expect(limiter.consume('client', 1000).allowed).toBe(true)
  })

  it('bounds stored client keys', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 1 })
    limiter.consume('first', 0)

    expect(limiter.consume('second', 1)).toEqual({
      allowed: false,
      retryAfterMs: 1000,
      firstExceeded: false,
    })
    expect(limiter.consume('second', 1000).allowed).toBe(true)
  })

  it('returns 429 with a retry delay after the request limit is reached', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 1000 })
    const middleware = createRateLimitMiddleware(limiter)
    const req = { ip: '192.0.2.1' }
    const res = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const next = jest.fn()

    middleware(req, res, next)
    middleware(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String))
  })
})

describe('batched request middleware', () => {
  it('rejects request batches', () => {
    const middleware = createDisableBatchingMiddleware()
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const next = jest.fn()

    middleware({ body: [{ query: '{ isLoggedIn }' }] }, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      errors: [{ message: 'Batched GraphQL requests are not supported.' }],
    })
  })
})

describe('login rate-limit middleware', () => {
  it('counts aliased login fields, including those in fragments', () => {
    const limiter = createFixedWindowRateLimiter({ limit: 1, windowMs: 1000 })
    const middleware = createLoginRateLimitMiddleware(limiter)
    const req = {
      ip: '192.0.2.2',
      body: {
        query: `
          mutation {
            first: login(email: "a", password: "b")
            ...LoginAgain
          }
          fragment LoginAgain on Mutation {
            second: login(email: "c", password: "d")
          }
        `,
      },
    }
    const res = {
      set: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    }
    const next = jest.fn()

    middleware(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(429)
  })

  it('lets GraphQL handle malformed query syntax', () => {
    const middleware = createLoginRateLimitMiddleware(
      createFixedWindowRateLimiter({ limit: 1, windowMs: 1000 }),
    )
    const next = jest.fn()

    middleware({ ip: '192.0.2.3', body: { query: 'mutation {' } }, {}, next)

    expect(next).toHaveBeenCalledTimes(1)
  })
})
