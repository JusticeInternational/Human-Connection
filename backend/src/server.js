import express from 'express'
import http from 'http'
import helmet from 'helmet'
import { ApolloServer } from 'apollo-server-express'
import CONFIG from './config'
import middleware from './middleware'
import { getNeode, getDriver } from './db/neo4j'
import decode from './jwt/decode'
import schema from './schema'
import webfinger from './activitypub/routes/webfinger'
import { RedisPubSub } from 'graphql-redis-subscriptions'
import { PubSub } from 'graphql-subscriptions'
import Redis from 'ioredis'
import bodyParser from 'body-parser'
import graphqlLimits from './middleware/graphqlLimits'
import {
  countLoginFields,
  createDisableBatchingMiddleware,
  createFixedWindowRateLimiter,
  createLoginRateLimitMiddleware,
  createRateLimitMiddleware,
} from './middleware/rateLimit'
import { specifiedRules } from 'graphql'

export const NOTIFICATION_ADDED = 'NOTIFICATION_ADDED'
const { REDIS_DOMAIN, REDIS_PORT, REDIS_PASSWORD } = CONFIG
let prodPubsub, devPubsub
const options = {
  host: REDIS_DOMAIN,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  retryStrategy: (times) => {
    return Math.min(times * 50, 2000)
  },
}
if (options.host && options.port && options.password) {
  prodPubsub = new RedisPubSub({
    publisher: new Redis(options),
    subscriber: new Redis(options),
  })
} else {
  devPubsub = new PubSub()
}
export const pubsub = prodPubsub || devPubsub
const driver = getDriver()
const neode = getNeode()
const apiRateLimiter = createFixedWindowRateLimiter({
  limit: 120,
  windowMs: 60 * 1000,
})
const loginRateLimiter = createFixedWindowRateLimiter({
  limit: 10,
  windowMs: 15 * 60 * 1000,
})
const subscriptionConnectionRateLimiter = createFixedWindowRateLimiter({
  limit: 20,
  windowMs: 60 * 1000,
})
const logGraphqlLimitRejections = {
  requestDidStart: () => ({
    didEncounterErrors: ({ errors }) => {
      if (errors.some(({ message }) => message.startsWith('GraphQL operation exceeds'))) {
        /* eslint-disable-next-line no-console */
        console.warn('GraphQL operation limit exceeded.')
      }
    },
  }),
}

const getContext = async (req) => {
  const user = await decode(driver, req.headers.authorization)
  return {
    driver,
    neode,
    user,
    req,
    cypherParams: {
      currentUserId: user ? user.id : null,
    },
  }
}
export const context = async (options) => {
  const { connection, req } = options
  if (connection) {
    return connection.context
  } else {
    return getContext(req)
  }
}

const createServer = (options) => {
  const defaults = {
    context,
    schema: middleware(schema),
    plugins: [logGraphqlLimitRejections],
    persistedQueries: false,
    validationRules: [graphqlLimits()],
    subscriptions: {
      validationRules: [...specifiedRules, graphqlLimits()],
      onConnect: (connectionParams, webSocket) => {
        const address =
          webSocket &&
          webSocket.upgradeReq &&
          webSocket.upgradeReq.socket &&
          webSocket.upgradeReq.socket.remoteAddress
        if (!address) return false

        const result = subscriptionConnectionRateLimiter.consume(address)
        if (!result.allowed) {
          if (result.firstExceeded) {
            /* eslint-disable-next-line no-console */
            console.warn('Rate limit exceeded: WebSocket connections')
          }
          return false
        }
        return getContext(connectionParams)
      },
      onOperation: async (message, params, webSocket) => {
        const address =
          webSocket &&
          webSocket.upgradeReq &&
          webSocket.upgradeReq.socket &&
          webSocket.upgradeReq.socket.remoteAddress
        if (!address) throw new Error('Unable to determine WebSocket client address.')

        const result = apiRateLimiter.consume(address)
        if (!result.allowed) {
          if (result.firstExceeded) {
            /* eslint-disable-next-line no-console */
            console.warn('Rate limit exceeded: WebSocket operations')
          }
          throw new Error('Too many requests. Please try again later.')
        }
        const query = (message && message.payload && message.payload.query) || params.query
        for (let attempt = 0; attempt < countLoginFields(query); attempt += 1) {
          const loginResult = loginRateLimiter.consume(address)
          if (!loginResult.allowed) {
            if (loginResult.firstExceeded) {
              /* eslint-disable-next-line no-console */
              console.warn('Rate limit exceeded: WebSocket login')
            }
            throw new Error('Too many login attempts. Please try again later.')
          }
        }
        return params
      },
    },
    debug: !!CONFIG.DEBUG,
    tracing: !!CONFIG.DEBUG,
    formatError: (error) => {
      if (error.message === 'ERROR_VALIDATION') {
        return new Error(error.originalError.details.map((d) => d.message))
      }
      return error
    },
  }
  const server = new ApolloServer(Object.assign({}, defaults, options))

  const app = express()

  app.set('driver', driver)
  app.set('trust proxy', false)
  app.use(helmet())
  app.use('/.well-known/', webfinger())
  app.use(express.static('public'))
  app.use(createRateLimitMiddleware(apiRateLimiter))
  app.use(bodyParser.json({ limit: '1mb' }))
  app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }))
  app.use(createDisableBatchingMiddleware())
  app.use(createLoginRateLimitMiddleware(loginRateLimiter))
  server.applyMiddleware({ app, path: '/' })
  const httpServer = http.createServer(app)
  httpServer.requestTimeout = 30 * 1000
  httpServer.headersTimeout = 15 * 1000
  server.installSubscriptionHandlers(httpServer)

  return { server, httpServer, app }
}

export default createServer
