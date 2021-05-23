//* This is a fake ES2015 template string, just to benefit of syntax
import neatCsv from 'neat-csv';

export default async function csvProcessData(data) {

    // console.log(await neatCsv(data));
    return neatCsv(data);
    // var headings = allTextLines[0].split(',');
    // var record_num = headings.length;
    // var lines = [];

    // for(var i=2; i < allTextLines.length; i++) {
    //     var entries = allTextLines[i].split(',')
    //     var elem = []
    //     for (var j=0; j<record_num; j++) {
    //         // tarr.push(headings[j]+":"+entries.shift());
    //         elem[headings[j]] = entries[j]
    //     }
    //     console.log(elem);
    //     process.exit(1);
    //     lines.push(elem);
    // }
    // return lines;
}