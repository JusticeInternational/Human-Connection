import { v4 as uuid } from 'uuid'
import Resolver from './helpers/Resolver'
import { UserInputError } from 'apollo-server'

export default {
  Mutation: {
    CreateService: async (_parent, params, context, _resolveInfo) => {
      const session = context.driver.session()
      params.id = params.id || uuid()
      const writeTxResultPromise = session.writeTransaction(async (transaction) => {
        const createServiceResponse = await transaction.run(
          `
            MATCH (org:Organization {id: $params.organizationId})
            MATCH (sc:ServiceCategory {id: $params.serviceCategoryId})
            CREATE (s:Service {
              id: $params.id,
              name: $params.name,
              description: $params.description,
              isGeneral: coalesce($params.isGeneral, false),
              createdAt: toString(datetime()),
              updatedAt: toString(datetime())
            })
            MERGE (s)-[:BELONGS]->(org)
            MERGE (org)-[:PROVIDES]->(s)
            MERGE (s)-[:CATEGORY]->(sc)
            MERGE (sc)-[:DENOMINATION]->(s)
            MERGE (org)-[:SCATEGORIES]->(sc)
            RETURN s {.*}
          `,
          { params },
        )
        const [service] = createServiceResponse.records.map((record) => record.get('s'))
        return service
      })
      try {
        const service = await writeTxResultPromise
        return service
      } catch (error) {
        throw new UserInputError(error.message)
      } finally {
        session.close()
      }
    },
  },
  Service: {
    ...Resolver('Service', {
      hasOne: {
        organization: '-[:BELONGS]->(related:Organization)',
        serviceCategory: '-[:CATEGORY]->(related:ServiceCategory)',
      },
    }),
  },
}
