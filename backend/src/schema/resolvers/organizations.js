import Resolver from './helpers/Resolver'
import { UserInputError } from 'apollo-server'

export default {
  Mutation: {
      CreateOrganization: async (_parent, params, context, _resolveInfo) => {
        const session = context.driver.session()
        const writeTxResultPromise = session.writeTransaction(async (transaction) => {
          const createOrgTransactionResponse = await transaction.run(
            `
              CREATE (org:Organization)
              SET org.id = $params.id
              SET org.name = $params.name
              SET org.webPage = $params.webPage
              SET org.phone = $params.phone
              SET org.ranking = $params.ranking
              SET org.hourHand = $params.hourHand
              SET org.description = $params.description
              SET org.servicesDesc = $params.servicesDesc
              SET org.iconName = $params.iconName
              SET org.urlIcon = $params.urlIcon
              SET org.createdAt = toString(datetime())
              SET org.updatedAt = toString(datetime())
              RETURN org {.*}
            `,
            { params },
          )
          const [org] = createOrgTransactionResponse.records.map((record) => record.get('org'))
          return org
        })
        try {
          const user = await writeTxResultPromise
          return user
        } catch (error) {
          throw new UserInputError(error.message)
        } finally {
          session.close()
        }
      },
      AssociateOrganizationToUser: async (_parent, params, context, _resolveInfo) => {
        const session = context.driver.session()
        const writeTxResultPromise = session.writeTransaction(async (transaction) => {
          const updateOrgTransactionResponse = await transaction.run(
            `
               MATCH (u:User {id: $params.userId})
               MATCH (org:Organization {id: $params.organizationId})
               MERGE (u)-[:APPROPRIATED_OF]->(org)
               RETURN org {.*}
            `,
            { params },
          )
          const [org] = updateOrgTransactionResponse.records.map((record) => record.get('org'))
          return org
        })
        try {
          const user = await writeTxResultPromise
          return user
        } catch (error) {
          throw new UserInputError(error.message)
        } finally {
          session.close()
        }
      },
    UpdateOrganization: async (_parent, params, context, _resolveInfo) => {
      const session = context.driver.session()
      const writeTxResultPromise = session.writeTransaction(async (transaction) => {
        const updateOrgTransactionResponse = await transaction.run(
          `
            MATCH (org:Organization {id: $params.id})
            SET org += $params
            SET org.updatedAt = toString(datetime())
            RETURN org {.*}
          `,
          { params },
        )
        const [org] = updateOrgTransactionResponse.records.map((record) => record.get('org'))
        return org
      })
      try {
        const user = await writeTxResultPromise
        return user
      } catch (error) {
        throw new UserInputError(error.message)
      } finally {
        session.close()
      }
    },
  },
  Organization: {
    ...Resolver('Organization', {
      hasOne: {
        plan: '-[:SUBSCRIBED]->(related:Plan)',
        location: '-[:IS_IN]->(related:Location)',
      },
      hasMany: {
        services: '-[:PROVIDES]->(related:Service)',
      },
    }),
  },
}
