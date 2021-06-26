import faker from 'faker'
import sample from 'lodash/sample'
import fs from 'fs'
import { createTestClient } from 'apollo-server-testing'
import createServer from '../server'
import Factory from '../db/factories'
import { getNeode, getDriver } from '../db/neo4j'
import { gql } from '../helpers/jest'
import { processFactory, generateFactoryData } from '../helpers/Factory'
import csvProcessData from '../helpers/csvReader'

const languages = ['de', 'en', 'es', 'fr', 'it', 'pt', 'pl']


/* eslint-disable no-multi-spaces */
;(async function () {
  let authenticatedUser = null
  const driver = getDriver()
  const neode = getNeode()
  var csvData = []

  if (process.argv.length < 3) {
    console.log("Argument error, node <script> <csv file name>");
    process.exit(1);
  }
  var csvFileName = process.argv[2];
  var data
  console.log('Reading data ...')
  try {  
      data = fs.readFileSync(csvFileName, 'utf8');
  } catch(e) {
      console.log('Error:', e.stack);
  }
  console.log('Processing data ...');
  csvData = await csvProcessData(data);
  
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

    // process countries
    // TODO: we need to do these in order countries ... -> Address etc.
    var nodes = []

    // process the CSV
    var processData = await generateFactoryData(csvData)
    nodes = await processFactory(processData)
    console.debug("Loaded " + nodes[0] + " ("+ nodes.length + ")");
    // console.debug(nodes[0])


    // close and save
    console.log("Seed RedSol Data ...")
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