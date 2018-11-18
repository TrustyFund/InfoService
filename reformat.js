const fs = require('fs');

const assets = JSON.parse(fs.readFileSync('./assets.json', 'utf8'));


const result = [];
Object.keys(assets).forEach((key) => {
  delete assets[key].options;
  result.push(assets[key]);
});
console.log(result);