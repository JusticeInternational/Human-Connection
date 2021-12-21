import { createTestClient } from 'apollo-server-testing'
import createServer from '../server'
import Factory from '../db/factories'
import { getNeode, getDriver } from '../db/neo4j'

/* eslint-disable no-multi-spaces */
;(async function () {
  let authenticatedUser = null
  const driver = getDriver()
  const neode = getNeode()

  try {
    const { server } = createServer({
      context: () => {
        return {
          driver,
          neode,
          user: authenticatedUser,
        }
      },
    })
    const { mutate } = createTestClient(server)

// LOCATION
    const [UnitesStates, Venezuela, California, Caracas] = await Promise.all([
      Factory.build('location', {
        id: 'country.0',
        name: 'Unites States',
        type: 'country',
        lat: 37.0902,
        lng: 95.7129,
        nameES: 'Estados Unidos',
      }),
      Factory.build('location', {
        id: 'country.1',
        name: 'Venezuela',
        type: 'country',
        lat: 6.4238,
        lng: 66.5897,
        nameES: 'Venezuela',
      }),
      Factory.build('location', {
        id: 'region.0',
        name: 'California',
        type: 'region',
        lat: 36.7783,
        lng: 119.4179,
        nameES: 'California',
      }),
      Factory.build('location', {
        id: 'region.1',
        name: 'Caracas',
        type: 'region',
        lat: 10.4806,
        lng: 66.9036,
        nameES: 'Caracas',
     }),
    ])

// USERS
    const [
      carlosSuarez,
      cristinaPaz,
    ] = await Promise.all([
      Factory.build(
        'user',
        {
          id: 'u0',
          name: 'Carlos',
          lastName:'Suarez',
          role: 'admin',
        },
        {
          email: 'admin@example.org',
        },
      ),
      Factory.build(
        'user',
        {
          id: 'u1',
          name: 'Cristina',
          lastName:'Paz',
          role: 'user',
        },
        {
          email: 'cpaz@example.com',
        },
      ),
    ])

//  SERVICES CATEGORIES
    const [sc0, sc5, sc6, sc12, sc26, sc40] = await Promise.all([
      Factory.build('serviceCategory', {
        id: 'sc0',
        name: 'General',
        icon: '1000-010_Employment',
      }),
      Factory.build('serviceCategory', {
        id: 'sc5',
        name: 'Comida',
        icon: '000_Food',
      }),
      Factory.build('serviceCategory', {
        id: 'sc6',
        name: 'Agua',
        icon: '0250-000_Water',
      }),
      Factory.build('serviceCategory', {
        id: 'sc12',
        name: 'Cuidado, salud y bienestar',
        icon: '0600-000_Health',
      }),
      Factory.build('serviceCategory', {
        id: 'sc26',
        name: 'Legal',
        icon: '1400-000_Legal',
      }),
      Factory.build('serviceCategory', {
        id: 'sc40',
        name: 'Bienestar social',
        icon: '3200-000_Social',
      }),
    ])

// PLANS
    const [pl0] = await Promise.all([
      Factory.build('plan', {
        id: 'pl0',
        name: 'Default Entry Plan',
      }),
    ])

// ORGANIZATIONS
    const [org0] = await Promise.all([
      Factory.build(
        'organization',
        {
          id: 'org0',
          name: 'Organizacion de prueba',
          description: 'Esta es una descripcion',
          urlIcon: 'https://drive.google.com/file/d/1CW',
          ranking: 4,
          hourHand: '5:00 am a 5:00 pm',
          phone: '3145551234',
          webPage: 'www.pageOrganizationTest.org',
        },
        {
          planId: 'pl0',
        },
      ),
    ])

// SERVICES
    const [s0] = await Promise.all([
      Factory.build(
        'service',
        {
          id: 's0',
          name: 'Servicio General',
        },
        {
          serviceCategoryId: 'sc0',
          organizationId: 'org0',
        },
      ),
    ])

// RELATIONSHIPS
    await Promise.all([
      California.relateTo(UnitesStates, 'isIn'),
      Caracas.relateTo(Venezuela, 'isIn'),
      org0.relateTo(pl0, 'plan'),
      org0.relateTo(s0, 'services'),
      org0.relateTo(California, 'isIn'),
      s0.relateTo(org0, 'organization'),
      sc0.relateTo(s0, 'services'),
      org0.relateTo(sc0, 'serviceCategories'),
      carlosSuarez.relateTo(org0, 'ownerOf'),
    ])

    /* eslint-disable-next-line no-console */
    console.log('Seeded Data...')
    await driver.close()
    await neode.close()
    process.exit(0)
  } catch (err) {
    /* eslint-disable-next-line no-console */
    console.error(err)
    process.exit(1)
  }
})()
/* eslint-enable no-multi-spaces */
