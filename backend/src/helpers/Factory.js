
import { SeedLocations, CountryType, AddressType } from '../helpers/SeedLocations'
import { SeedCategories, CategoryType } from '../helpers/SeedCategories'

const CHUNK_SIZE = 5;

// force wait on factorybuilds
export async function waitOnFactory(nodes) {
  for (let i = 0; i < nodes.length; i++) {
    var n = await nodes[i].node
  }
  return nodes
}

export async function processFactory(aData) {
    // process addresses
    var results = []
    const chunkSize = CHUNK_SIZE;
    for (let i = 0; i < aData.length; i += chunkSize) {
      const chunk = aData.slice(i, i + chunkSize);
      // console.log("here 0 -> i => " + i)
      // console.log("here 1 -> chunk => " + chunk.length)
      // console.log("here 2 -> " + Object.getOwnPropertyNames(chunk[0]))
      // console.log("here 3 -> " + chunk[0]['type'])
      var type = chunk[0]['type']
      try {
        switch (type) {
          case CountryType:
          case AddressType:
            results.push(...await waitOnFactory(await SeedLocations(chunk)));
            break;
          case CategoryType:
            results.push(...await waitOnFactory(await SeedCategories(chunk)));
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
    var type
    data
    .filter(element => {
      // determine if this is country
      if(element.hasOwnProperty(CountryType)) {
          type = CountryType;
      }
      if(element.hasOwnProperty(CategoryType)) {
          type = CategoryType;
      }
      if(element.hasOwnProperty(AddressType)) {
        type = AddressType;
      }
    });
    return type
}

// return [{key:, type: , rawnode:, node:}]
export async function generateFactoryData(data) {
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
        if(c.key === element[type]) {
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