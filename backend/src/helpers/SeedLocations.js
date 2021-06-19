
export const AddressType = 'Address'
export const CountryType = 'Country'
export async function SeedLocations(data) {
  
    // debugging
    // console.log(data)
    var results = []
    data
    .filter(e => {
      var skipReturn = false;
      var element = e.rawnode;
      // skip the header
      if( element.Country === '' ||
          element.Country === CountryType ||
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
    .map(e => {
      var element = e.rawnode
      var type = e.type
      switch (type) {
        case AddressType:
          element = {
            id: element.id,
            type: type,
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
          break;
        case CountryType:
          element = {
            id: element.id,
            type: type,
            name: element.Country,
            nameES: element.Country,
            nameFR: element.Country,
            nameIT: element.Country,
            nameEN: element.Country,
            namePT: element.Country,
            nameDE: element.Country,
            nameNL: element.Country,
            namePL: element.Country,
            nameRU: element.Country
          }
          break;
        default:
          console.log(`Unrecognized type ${type}.`);
          return; 
        }
        return element; 
    })
    .forEach(e => {
      var element = e.rawnode;
      results.push({
          key: element[e.type],
          type: type,
          rawnode: element,
          node: Factory.build('location',element)
      });
    });
    return Promise.all(results);
  }