import Factory from '../db/factories'

export async function SeedCategories(data) {
  
    // debugging
    // console.log(data)
    var results = []
    data
    .filter(e => {
      var skipReturn = false;
      var element = e.rawnode;
  
      // skip the header and empty elements
      if( element.Category === '' ||
          element.Category === 'Category' ||
          element.Category === undefined 
      ) { return }
  
      // map to id
      // csv fields;
      // code,order,classification,Category,icon_name,includes_ES,includes_EN,description
      // data model;
      // map from models/ServiceCategory.js
      // id is automatic
      element['name'] = element['Category'];
      element['icon'] = element['icon_name'];
      element['description'] = element['description'];
      element['classification'] = element['classification'];
      element['order'] = element['order'];
  
      if( !skipReturn ) {
        return e.rawnode = element;
      }
    })
    .map(e => {
      var element = e.rawnode;
      var type = e.type;
      switch (type) {
        case 'Category':
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
        default:
          console.log(`Unrecognized type ${type}.`);
          return; 
        }
        e.rawnode = element
        return e; 
    })
    .forEach(e => {
      var element = e.rawnode;
      results.push({
        key: element[e.type],
        type: e.type,
        rawnode: element,
        node: Factory.build('serviceCategory',element)
      });
    });
    return Promise.all(results);
  }
