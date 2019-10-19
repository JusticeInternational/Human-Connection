import { createTestClient } from 'apollo-server-testing'
import createServer from '../.././server'
import Factory from '../../seed/factories'
import { gql } from '../../jest/helpers'
import { getDriver, neode as getNeode } from '../../bootstrap/neo4j'

const factory = Factory()
const instance = getNeode()
const driver = getDriver()

describe('report', () => {
  let authenticatedUser, currentUser, mutate, query
  const reportMutation = gql`
    mutation($resourceId: ID!, $reasonCategory: ReasonCategory!, $reasonDescription: String!) {
      report(
        resourceId: $resourceId
        reasonCategory: $reasonCategory
        reasonDescription: $reasonDescription
      ) {
        createdAt
        reasonCategory
        reasonDescription
        type
        submitter {
          email
        }
        user {
          name
        }
        post {
          title
        }
        comment {
          content
        }
      }
    }
  `
  const variables = {
    resourceId: 'whatever',
    reasonCategory: 'other',
    reasonDescription: 'Violates code of conduct !!!',
  }

  beforeAll(() => {
    const { server } = createServer({
      context: () => {
        return {
          driver,
          neode: instance,
          user: authenticatedUser,
        }
      },
    })
    mutate = createTestClient(server).mutate
    query = createTestClient(server).query
  })

  afterEach(async () => {
    await factory.cleanDatabase()
  })

  describe('create report', () => {
    describe('unauthenticated', () => {
      it('throws authorization error', async () => {
        authenticatedUser = null
        await expect(mutate({ mutation: reportMutation, variables })).resolves.toMatchObject({
          data: { report: null },
          errors: [{ message: 'Not Authorised!' }],
        })
      })
    })

    describe('authenticated', () => {
      const categoryIds = ['cat9']
      beforeEach(async () => {
        currentUser = await factory.create('User', {
          id: 'current-user-id',
          role: 'user',
          email: 'test@example.org',
          password: '1234',
        })
        await factory.create('User', {
          id: 'abusive-user-id',
          role: 'user',
          name: 'abusive-user',
          email: 'abusive-user@example.org',
        })
        await instance.create('Category', {
          id: 'cat9',
          name: 'Democracy & Politics',
          icon: 'university',
        })

        authenticatedUser = await currentUser.toJson()
      })

      describe('invalid resource id', () => {
        it('returns null', async () => {
          await expect(mutate({ mutation: reportMutation, variables })).resolves.toMatchObject({
            data: { report: null },
            errors: undefined,
          })
        })
      })

      describe('valid resource', () => {
        describe('reported resource is a user', () => {
          it('returns type "User"', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: { ...variables, resourceId: 'abusive-user-id' },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  type: 'User',
                },
              },
              errors: undefined,
            })
          })

          it('returns resource in user attribute', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: { ...variables, resourceId: 'abusive-user-id' },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  user: {
                    name: 'abusive-user',
                  },
                },
              },
              errors: undefined,
            })
          })

          it('returns the submitter', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: { ...variables, resourceId: 'abusive-user-id' },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  submitter: {
                    email: 'test@example.org',
                  },
                },
              },
              errors: undefined,
            })
          })

          it('returns a date', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: { ...variables, resourceId: 'abusive-user-id' },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  createdAt: expect.any(String),
                },
              },
              errors: undefined,
            })
          })

          it('returns the reason category', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'abusive-user-id',
                  reasonCategory: 'criminal_behavior_violation_german_law',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  reasonCategory: 'criminal_behavior_violation_german_law',
                },
              },
              errors: undefined,
            })
          })

          it('gives an error if the reason category is not in enum "ReasonCategory"', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'abusive-user-id',
                  reasonCategory: 'category_missing_from_enum_reason_category',
                },
              }),
            ).resolves.toMatchObject({
              data: undefined,
              errors: [
                {
                  message:
                    'Variable "$reasonCategory" got invalid value "category_missing_from_enum_reason_category"; Expected type ReasonCategory.',
                },
              ],
            })
          })

          it('returns the reason description', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'abusive-user-id',
                  reasonDescription: 'My reason!',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  reasonDescription: 'My reason!',
                },
              },
              errors: undefined,
            })
          })

          it('sanitize the reason description', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'abusive-user-id',
                  reasonDescription: 'My reason <sanitize></sanitize>!',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  reasonDescription: 'My reason !',
                },
              },
              errors: undefined,
            })
          })
        })

        describe('reported resource is a post', () => {
          beforeEach(async () => {
            await factory.create('Post', {
              author: currentUser,
              id: 'post-to-report-id',
              title: 'This is a post that is going to be reported',
              categoryIds,
            })
          })

          it('returns type "Post"', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'post-to-report-id',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  type: 'Post',
                },
              },
              errors: undefined,
            })
          })

          it('returns resource in post attribute', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'post-to-report-id',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  post: {
                    title: 'This is a post that is going to be reported',
                  },
                },
              },
              errors: undefined,
            })
          })

          it('returns null in user attribute', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'post-to-report-id',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  user: null,
                },
              },
              errors: undefined,
            })
          })
        })

        /* An der Stelle würde ich den p23 noch mal prüfen, diesmal muss aber eine error meldung kommen.
           At this point I would check the p23 again, but this time there must be an error message. */

        describe('reported resource is a comment', () => {
          let createPostVariables
          beforeEach(async () => {
            createPostVariables = {
              id: 'p1',
              title: 'post to comment on',
              content: 'please comment on me',
              categoryIds,
            }
            await factory.create('Post', { ...createPostVariables, author: currentUser })
            await factory.create('Comment', {
              author: currentUser,
              postId: 'p1',
              id: 'comment-to-report-id',
              content: 'Post comment to be reported.',
            })
          })

          it('returns type "Comment"', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'comment-to-report-id',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  type: 'Comment',
                },
              },
              errors: undefined,
            })
          })

          it('returns resource in comment attribute', async () => {
            await expect(
              mutate({
                mutation: reportMutation,
                variables: {
                  ...variables,
                  resourceId: 'comment-to-report-id',
                },
              }),
            ).resolves.toMatchObject({
              data: {
                report: {
                  comment: {
                    content: 'Post comment to be reported.',
                  },
                },
              },
              errors: undefined,
            })
          })
        })
        /* An der Stelle würde ich den c34 noch mal prüfen, diesmal muss aber eine error meldung kommen.
           At this point I would check the c34 again, but this time there must be an error message. */
      })
    })
  })
})
// describe('report mutation', () => {
//   describe('authenticated', () => {

//     describe('valid resource id', () => {

//       describe('reported resource is a post', () => {

//       describe('reported resource is a tag', () => {
//         beforeEach(async () => {
//           await factory.create('Tag', {
//             id: 't23',
//           })
//           variables = {
//             ...variables,
//             resourceId: 't23',
//           }
//         })

//         it('returns null', async () => {
//           await expect(action()).resolves.toMatchObject({
//             report: null,
//           })
//         })
//       })

//       /* An der Stelle würde ich den t23 noch mal prüfen, diesmal muss aber eine error meldung kommen.
//            At this point I would check the t23 again, but this time there must be an error message. */
//     })
//   })
// })

// describe('reports query', () => {
//   let query, mutate, authenticatedUser, moderator, user, author
//   const categoryIds = ['cat9']

//   const reportMutation = gql`
//     mutation($resourceId: ID!, $reasonCategory: ReasonCategory!, $reasonDescription: String!) {
//       report(
//         resourceId: $resourceId
//         reasonCategory: $reasonCategory
//         reasonDescription: $reasonDescription
//       ) {
//         type
//       }
//     }
//   `
//   const reportsQuery = gql`
//     query {
//       reports(orderBy: createdAt_desc) {
//         createdAt
//         reasonCategory
//         reasonDescription
//         submitter {
//           id
//         }
//         type
//         user {
//           id
//         }
//         post {
//           id
//         }
//         comment {
//           id
//         }
//       }
//     }
//   `

//   beforeAll(async () => {
//     await factory.cleanDatabase()
//     const { server } = createServer({
//       context: () => {
//         return {
//           driver,
//           user: authenticatedUser,
//         }
//       },
//     })
//     query = createTestClient(server).query
//     mutate = createTestClient(server).mutate
//   })

//   beforeEach(async () => {
//     authenticatedUser = null

//     moderator = await factory.create('User', {
//       id: 'mod1',
//       role: 'moderator',
//       email: 'moderator@example.org',
//       password: '1234',
//     })
//     user = await factory.create('User', {
//       id: 'user1',
//       role: 'user',
//       email: 'test@example.org',
//       password: '1234',
//     })
//     author = await factory.create('User', {
//       id: 'auth1',
//       role: 'user',
//       name: 'abusive-user',
//       email: 'abusive-user@example.org',
//     })
//     await instance.create('Category', {
//       id: 'cat9',
//       name: 'Democracy & Politics',
//       icon: 'university',
//     })

//     await Promise.all([
//       factory.create('Post', {
//         author,
//         id: 'p1',
//         categoryIds,
//         content: 'Interesting Knowledge',
//       }),
//       factory.create('Post', {
//         author: moderator,
//         id: 'p2',
//         categoryIds,
//         content: 'More things to do …',
//       }),
//       factory.create('Post', {
//         author: user,
//         id: 'p3',
//         categoryIds,
//         content: 'I am at school …',
//       }),
//     ])
//     await Promise.all([
//       factory.create('Comment', {
//         author: user,
//         id: 'c1',
//         postId: 'p1',
//       }),
//     ])

//     authenticatedUser = await user.toJson()
//     await Promise.all([
//       mutate({
//         mutation: reportMutation,
//         variables: {
//           resourceId: 'p1',
//           reasonCategory: 'other',
//           reasonDescription: 'This comment is bigoted',
//         },
//       }),
//       mutate({
//         mutation: reportMutation,
//         variables: {
//           resourceId: 'c1',
//           reasonCategory: 'discrimination_etc',
//           reasonDescription: 'This post is bigoted',
//         },
//       }),
//       mutate({
//         mutation: reportMutation,
//         variables: {
//           resourceId: 'auth1',
//           reasonCategory: 'doxing',
//           reasonDescription: 'This user is harassing me with bigoted remarks',
//         },
//       }),
//     ])
//     authenticatedUser = null
//   })

//   afterEach(async () => {
//     await factory.cleanDatabase()
//   })

//   describe('unauthenticated', () => {
//     it('throws authorization error', async () => {
//       authenticatedUser = null
//       expect(query({ query: reportsQuery })).resolves.toMatchObject({
//         data: { reports: null },
//         errors: [{ message: 'Not Authorised!' }],
//       })
//     })

//     it('role "user" gets no reports', async () => {
//       authenticatedUser = await user.toJson()
//       expect(query({ query: reportsQuery })).resolves.toMatchObject({
//         data: { reports: null },
//         errors: [{ message: 'Not Authorised!' }],
//       })
//     })

//     it('role "moderator" gets reports', async () => {
//       const expected = {
//         // to check 'orderBy: createdAt_desc' is not possible here, because 'createdAt' does not differ
//         reports: expect.arrayContaining([
//           expect.objectContaining({
//             createdAt: expect.any(String),
//             reasonCategory: 'doxing',
//             reasonDescription: 'This user is harassing me with bigoted remarks',
//             submitter: expect.objectContaining({
//               id: 'user1',
//             }),
//             type: 'User',
//             user: expect.objectContaining({
//               id: 'auth1',
//             }),
//             post: null,
//             comment: null,
//           }),
//           expect.objectContaining({
//             createdAt: expect.any(String),
//             reasonCategory: 'other',
//             reasonDescription: 'This comment is bigoted',
//             submitter: expect.objectContaining({
//               id: 'user1',
//             }),
//             type: 'Post',
//             user: null,
//             post: expect.objectContaining({
//               id: 'p1',
//             }),
//             comment: null,
//           }),
//           expect.objectContaining({
//             createdAt: expect.any(String),
//             reasonCategory: 'discrimination_etc',
//             reasonDescription: 'This post is bigoted',
//             submitter: expect.objectContaining({
//               id: 'user1',
//             }),
//             type: 'Comment',
//             user: null,
//             post: null,
//             comment: expect.objectContaining({
//               id: 'c1',
//             }),
//           }),
//         ]),
//       }

//       authenticatedUser = await moderator.toJson()
//       const { data } = await query({ query: reportsQuery })
//       expect(data).toEqual(expected)
//     })
//   })
// })
