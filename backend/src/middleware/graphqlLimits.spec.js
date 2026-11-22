import { buildSchema, parse, specifiedRules, validate } from 'graphql'
import graphqlLimits from './graphqlLimits'

const schema = buildSchema(`
  type Query {
    item: Item
    other: String
  }

  type Item {
    nested: Item
    value: String
  }
`)

const validateQuery = (query, limits) =>
  validate(schema, parse(query), [...specifiedRules, graphqlLimits(limits)])

describe('GraphQL operation limits', () => {
  it('rejects operations deeper than the configured maximum', () => {
    const errors = validateQuery('{ item { nested { value } } }', { maxDepth: 2 })
    expect(errors.map(({ message }) => message)).toContain(
      'GraphQL operation exceeds the maximum depth of 2.',
    )
  })

  it('counts fields expanded through fragments', () => {
    const errors = validateQuery(
      `
        query {
          item {
            ...ItemFields
          }
        }
        fragment ItemFields on Item {
          nested { value }
          value
        }
      `,
      { maxFields: 3 },
    )
    expect(errors.map(({ message }) => message)).toContain(
      'GraphQL operation exceeds the maximum of 3 fields.',
    )
  })

  it('allows operations within the configured limits', () => {
    expect(validateQuery('{ item { value } other }', { maxDepth: 2, maxFields: 3 })).toEqual([])
  })
})
