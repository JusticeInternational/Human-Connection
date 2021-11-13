//* This is a fake ES2015 template string, just to benefit of syntax
import neatCsv from 'neat-csv';

export default async function csvProcessData(data) {

    // console.log(await neatCsv(data));
    return neatCsv(data);
}