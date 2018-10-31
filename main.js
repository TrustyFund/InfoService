const { Apis } = require('bitsharesjs-ws');
const fs = require('fs');
const { markets } = require('./config');

let assets;


const populateAssets = async (assets) => {
  try {
    const result = await Apis.instance().db_api().exec('lookup_asset_symbols', [assets]);
    return result.reduce((model, asset) => {
      model[asset.symbol] = asset;
      return model;
    }, {})
  } catch (e) {
    console.log('Error lookup', e);
  }
}

const getRawStats = async (markets) => {
  const bucketSize = 86400;
  const endDate = new Date();
  const startDate = new Date(endDate - (1000 * 60 * 60 * 24 * 7));
  const endDateISO = endDate.toISOString().slice(0, -5);
  const startDateISO = startDate.toISOString().slice(0, -5);

  const allMarketsPromises = Object.keys(markets).map((base) => new Promise(async (resolve) => {
    let baseToQuotes = {};
    const quotes = markets[base];
    const promises = Promise.all(quotes.map((quote) => {
      return Apis.instance().history_api().exec(
        'get_market_history',
        [assets[base].id, assets[quote].id, bucketSize, startDateISO, endDateISO]
      ).then((results) => {
        return [quote, results]
      });
    }));
    try {
      const results = await promises;
      results.forEach((result) => {
        baseToQuotes[result[0]] = result[1];
      });
      resolve([base, {...baseToQuotes}]);
    } catch(e) {
      console.log('Error', e);
    }
  }));
  const result = await Promise.all(allMarketsPromises);
  return result.reduce((final, data) => {
    final[data[0]] = data[1];
    return final;
  }, {})
}

Apis.instance("wss://bitshares.openledger.info/ws", true).init_promise.then(async (res) => {
    try {
      assets = JSON.parse(fs.readFileSync('./assets.json', 'utf8'));
      console.log('Assets restored');
    } catch (e) {
      let marketAssets = Object.keys(markets);
      let othersAssets = marketAssets.reduce((result, market) => {
        return result.concat(markets[market]);
      }, []);
      assets = await populateAssets([...marketAssets,...othersAssets]);
      fs.writeFile('assets.json', JSON.stringify(assets), 'utf8', () => console.log('Wrote assets'));
    }

    const rawStats = await getRawStats(markets);
    console.log('RAW', rawStats);

    return;
    try {
      const ticker = await Apis.instance().db_api().exec('get_ticker', ['BTS', 'CNY']);
      console.log(ticker);
    } catch(e) {
      console.log(e);
    }
});