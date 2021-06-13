
import { SeedLocations } from '../helpers/SeedLocations'
import { SeedCategories } from '../helpers/SeedCategories'

const Country = 'Country';
const Address = 'address';
const Categories = 'Category';
const CHUNK_SIZE = 5;

export async function processFactory(aData) {
    // process addresses
    var results = []
    const chunkSize = CHUNK_SIZE;
    for (let i = 0; i < aData.length; i += chunkSize) {
      const chunk = aData.slice(i, i + chunkSize);
      var type = chunk[i].type
      try {
        switch (type) {
          case Country:
          case Address:
            results.push(...await SeedLocations(chunk));
            break;
          case Categories:
            results.push(...await SeedCategories(chunk));
            break;
          default:
              console.error(`Sorry, this is the wrong type for ${expr}.`);
          }
      } catch(err) {
        console.error(`Failed processing chunk ${i} to ${chunkSize}`)
        console.error(`Error occurred processing recordsprocessing records.\n\n${err}`) // eslint-disable-line no-console
      }
    }
    console.debug("Process data ("+ results.length + ")")
    return results;
}

export function identifyFactoryType(data) {
    return data
    .filter(element => {
      // determine if this is country
      if(element.hasOwnProperty('Country')) {
          return Country;
      }
      if(element.hasOwnProperty('Category')) {
          return Categories;
      }
      if(element.hasOwnProperty('Address')) {
        return Address;
      }
    });
}

// return [{key:, type: , rawnode:, node:}]
export function generateFactoryData(data) {
    var results = []
    var type = identifyFactoryType(data)
    results.push(...await mapElements(data, type))
    return results
}


export async function mapElements(data, type) {
    var results = []
    data.filter(element => {

      // unique elements only
      const keysearch = results.find( c => {
        if(c.name === element[type]) {
          return c
        }
      });
      if (undefined != keysearch) {
        return
      } else {
        results.push({
          key: element[type],
          type: type,
          rawnode: element,
          node: undefined
        })
      }
      return element;
    });

    return results
}