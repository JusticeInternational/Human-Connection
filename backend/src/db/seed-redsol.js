import faker from 'faker'
import sample from 'lodash/sample'
import fs from 'fs'
import { createTestClient } from 'apollo-server-testing'
import createServer from '../server'
import Factory from '../db/factories'
import { getNeode, getDriver } from '../db/neo4j'
import { gql } from '../helpers/jest'
import { processFactory, identifyFactoryType } from '../helpers/Factory'
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
    var nodes = []

    // pData -> typedaata[]
    console.log("here -> " + csvData.length)
    var processData = generateFactoryData(csvData)

    
    // .map(element => {
    //   return {
    //     name: element.Country,
    //     bfnode : buildFactoryLocations([ element ], "country")
    //   };
    // });

    nodes = await processFactory(processData)
    console.log(nodes)
    
    // countries.forEach(element => async function(){
    //     console.log(`loading => ${element.name}`);
    //     await Promise.all(element.bfnode);
    // });
    console.debug("Loaded " + nodes[0].type + " ("+ nodes.length + ")");

    // // process addresses
    // var locations = []
    // const chunkSize = 5;
    // for (let i = 0; i < csvData.length; i += chunkSize) {
    //   const chunk = csvData.slice(i, i + chunkSize);
    //   try {
    //     locations.push(...await Promise.all(buildFactoryLocations(chunk)));
    //   } catch(err) {
    //     console.error(`Failed processing chunk ${i} to ${chunkSize}`)
    //     console.error(`Error occurred processing recordsprocessing records.\n\n${err}`) // eslint-disable-line no-console
    //   }
    // }
    // console.debug("Loaded locations ("+ locations.length + ")");
      // some debugging
      // console.debug(locations[3]['_properties'])
      // console.debug(locations[3]['_properties'].get('id'))

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