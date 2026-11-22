import { graphql, buildSchema } from 'graphql'
import { applyMiddleware } from 'graphql-middleware'
import { shield } from 'graphql-shield'
import {
  requiresAuthentication,
  updateUserPermission,
  userEmailPermission,
} from './permissionsMiddleware'

const schema = applyMiddleware(
  buildSchema(`
    type Query {
      User(id: ID): [User]
    }

    type Mutation {
      UpdateOrganization(id: ID!): Organization
      UpdateUser(id: ID!): User
    }

    type User {
      id: ID!
      email: String!
    }

    type Organization {
      id: ID!
    }

    type Report {
      id: ID!
    }
  `),
  shield({
    Mutation: { '*': requiresAuthentication, UpdateUser: updateUserPermission },
    User: { email: userEmailPermission },
  }),
)

describe('authorization policy', () => {
  it('requires authentication for mutations by default', async () => {
    const result = await graphql(
      schema,
      'mutation { UpdateOrganization(id: "org0") { id } }',
      null,
      { user: null },
    )

    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Not Authorised!' })]),
    )
  })

  it('only allows users or admins to update a user record', async () => {
    const result = await graphql(schema, 'mutation { UpdateUser(id: "other") { id } }', null, {
      user: { id: 'user0', role: 'user' },
    })

    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Not Authorised!' })]),
    )
  })

  it('allows users to update their own record', async () => {
    const result = await graphql(
      schema,
      'mutation { UpdateUser(id: "user0") { id } }',
      { UpdateUser: { id: 'user0' } },
      { user: { id: 'user0', role: 'user' } },
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ UpdateUser: { id: 'user0' } })
  })

  it("does not expose another user's email address to anonymous readers", async () => {
    const result = await graphql(
      schema,
      '{ User(id: "user0") { email } }',
      { User: [{ id: 'user0', email: 'private@example.org' }] },
      { user: null },
    )

    expect(result.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Not Authorised!' })]),
    )
    expect(result.data).toEqual({ User: [null] })
  })

  it('allows users to access their own email address', async () => {
    const result = await graphql(
      schema,
      '{ User(id: "user0") { email } }',
      { User: [{ id: 'user0', email: 'private@example.org' }] },
      { user: { id: 'user0', role: 'user' } },
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({ User: [{ email: 'private@example.org' }] })
  })
})
