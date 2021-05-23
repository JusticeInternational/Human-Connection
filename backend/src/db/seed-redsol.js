import faker from 'faker'
import sample from 'lodash/sample'
import fs from 'fs'
import { createTestClient } from 'apollo-server-testing'
import createServer from '../server'
import Factory from '../db/factories'
import { getNeode, getDriver } from '../db/neo4j'
import { gql } from '../helpers/jest'
import csvProcessData from '../helpers/csvReader'

const languages = ['de', 'en', 'es', 'fr', 'it', 'pt', 'pl']

function buildFactoryLocations(data) {
  
  // debugging
  // console.log(data[15])
  var locations = []
  data
  .filter(element => {
    var skipReturn = false;

    // skip the header
    if( element.Country === '' ||
        element.Country === 'Country' ||
        element.Country === undefined 
    ) { return }

    // skip empty address
    if (element.Address === '') { return };

    // map to id
    element['id'] = element['Source file id'];
    if (element.id === '') { return };

    if (element.Longitude === 'Longitude') { skipReturn = true;};
    if (typeof element.Longitude != 'string') { skipReturn = true;};
    if (element.Latitude === 'Latitude') { skipReturn = true;};
    if (typeof element.Latitude != 'string') { skipReturn = true;};


    // filter Longitude
    if (skipReturn === false ) {
      
      // remove extra dot's after the first dot
      element.Longitude = element.Longitude.replace(/\./g, (i => m => !i++ ? m : '')(0));
      try {
        element.Longitude = element.Longitude * 1 // convert to a number
        if(isNaN(element.Longitude)) {
          skipReturn = true;
        }
      } catch {};
    }

    // filter Latitude
    if (skipReturn === false ) {
      
      // remove extra dot's after the first dot
      element.Latitude = element.Latitude.replace(/\./g, (i => m => !i++ ? m : '')(0));
      try {
        element.Latitude = element.Latitude * 1 // convert to a number
        if(isNaN(element.Latitude)) {
          skipReturn = true;
        }
      } catch {};
    }
    if( !skipReturn ) {
      return element;
    }
  })
  .forEach(element => {
    var locationEntry = {
      id: element.id,
      type: 'address',
      name: element.Address,
      nameES: element.Address,
      nameFR: element.Address,
      nameIT: element.Address,
      nameEN: element.Address,
      namePT: element.Address,
      nameDE: element.Address,
      nameNL: element.Address,
      namePL: element.Address,
      nameRU: element.Address,
      lng: element.Longitude,
      lat: element.Latitude
    }
    locations.push(Factory.build('location',locationEntry));
  });
  return locations; 
}

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

      var locations = []
      const chunkSize = 5;
      for (let i = 0; i < csvData.length; i += chunkSize) {
        const chunk = csvData.slice(i, i + chunkSize);
        try {
          locations.push(...await Promise.all(buildFactoryLocations(chunk)));
        } catch(err) {
          console.error(`Failed processing chunk ${i} to ${chunkSize}`)
          console.error(`Error occurred processing recordsprocessing records.\n\n${err}`) // eslint-disable-line no-console
        }
      }
      // some debugging
      // console.debug("Loaded locations ("+ locations.length + ")");
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