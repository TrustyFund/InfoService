const { Apis } = require('bitsharesjs-ws');
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
};

Apis.instance("wss://bitshares.openledger.info/ws", true).init_promise.then(async (res) => {
  let marketAssets = Object.keys(markets);
  let othersAssets = marketAssets.reduce((result, market) => {
    return result.concat(markets[market]);
  }, []);
  assets = await populateAssets([...marketAssets, ...othersAssets]);

  const sampleTicker = await Apis.instance().db_api().exec('get_ticker', ['BTS', 'OPEN.EOS']);

  console.log('Done populate', sampleTicker);
});