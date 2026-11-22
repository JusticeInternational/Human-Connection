import createServer from './server'
import CONFIG from './config'

const { server, httpServer } = createServer()
httpServer.listen({ port: CONFIG.PORT }, () => {
  /* eslint-disable-next-line no-console */
  console.log(`🚀 Server ready at http://localhost:${CONFIG.PORT}${server.graphqlPath}`)
  /* eslint-disable-next-line no-console */
  console.log(`🚀 Subscriptions ready at ws://localhost:${CONFIG.PORT}${server.subscriptionsPath}`)
})
