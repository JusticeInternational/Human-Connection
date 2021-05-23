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
  console.log("Loading locations ("+ locations.length + ")");
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

    await Promise.all( buildFactoryLocations(csvData) );
    // const [l1] = await Promise.all([
    //     Factory.build('location', {
    //         id: 'address.YY-VENEZUEL-2009051550-151',
    //         type: 'address',
    //         name: 'Ecuador',
    //         nameES: 'Ecuador',
    //         nameFR: 'Ecuador',
    //         nameIT: 'Ecuador',
    //         nameEN: 'Ecuador',
    //         namePT: 'Ecuador',
    //         nameDE: 'Ecuador',
    //         nameNL: 'Ecuador',
    //         namePL: 'Ecuador',
    //         nameRU: 'Ecuador',
    //         lng: -1.831239,
    //         lat: -7.818340599999990,
    //       })
    // ])

    // const [org1] = await Promise.all([
    //     Factory.build(
    //       'organization',
    //       {
    //         id: 'org1',
    //         name: 'Organization 1',
    //         description: 'This is a test description',
    //         urlIcon: 'https://drive.google.com/file/d/1CW',
    //         ranking: 4,
    //         hourHand: '5:00 am a 5:00 pm',
    //       },
    //       {
    //         planId: 'pl1',
    //       },
    //     )
    //   ])
    // await Promise.all([
    //   org1.relateTo(l1, 'isIn'),
    // ])
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