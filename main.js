const { Apis } = require('bitsharesjs-ws');
const fs = require('fs');
const { markets } = require('./config');

let assets;


/*TODO: 24h price change
      7d price change
      last bucket base volume
      last bucket base in usd volume
      last bucket close price in base
      lase bucket close price in usd*/


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


const precisedCount = (cnt, prec) => cnt / 10 ** prec;

// It returns open and close prices for given bucket with base and quote precisions
const getPricesFromBucket = (basePrecision, quotePrecision, bucket) => {
  const closeCountBase = precisedCount(bucket.close_base, basePrecision);
  const closeCountQuote = precisedCount(bucket.close_quote, quotePrecision);
  const openCountBase = precisedCount(bucket.open_base, basePrecision);
  const openCountQuote = precisedCount(bucket.open_quote, quotePrecision);
  return {
    open: openCountBase / openCountQuote,
    close: closeCountBase / closeCountQuote
  }
};

// It returns USD prices { last, median } for entered Base asset and bucket of history
const getUsdPrices = (basePrecision, usdLastBucket) => {
  const usdPrecision = assets['USD'].precision;
  const {
    open: usdOpenPrice,
    close: usdClosePrice
  } = getPricesFromBucket(basePrecision, usdPrecision, usdLastBucket);
  const medianPrice = (usdOpenPrice + usdClosePrice) / 2;
  return {
    last: usdClosePrice,
    median: medianPrice
  }
};

// Returns volume in base, last price and 24h change for base - quote market
const get24HourData = (base, quote) => {
  const bucketSize = 3600;
  const endDate = new Date();
  const startDate = new Date(endDate - (1000 * 60 * 60 * 24 * 7));
  const startDateISO = startDate.toISOString().slice(0, -5);
  const endDateISO = endDate.toISOString().slice(0, -5);

  return Apis.instance().history_api().exec(
    'get_market_history',
    [base.id, quote.id, bucketSize, startDateISO, endDateISO]
  ).then((data) => {
    if (!data.length) {
      return false;
    }
    const volume = data.reduce((vol, itm) => itm.base_volume + vol, 0);
    const firstBucket = data[0];
    const lastBucket = data[data.length - 1];
    const firstBucketPrices = getPricesFromBucket(base.precision, quote.precision, firstBucket);
    const lastBucketPrices = getPricesFromBucket(base.precision, quote.precision, lastBucket);
    console.log(base, quote);
    console.log(firstBucketPrices);
    console.log(lastBucketPrices);
    console.log(volume);
    return {
      baseVolume: volume,
      price: 0
    }
  });
};

const getRawStats = async (base, quotes) => {
  const bucketSize = 86400;
  const endDate = new Date();
  const startDate = new Date(endDate - (1000 * 60 * 60 * 24 * 7));
  const endDateISO = endDate.toISOString().slice(0, -5);
  const startDateISO = startDate.toISOString().slice(0, -5);

  // We are adding USD to the beginning of quotes, to calculate USD volumes
  quotes.unshift('USD');

  const baseToQuotes = {};
  const promises = Promise.all(quotes.map((quote) => {
    return get24HourData(assets[base], assets[quote]).then((data) => {
      return { quote, data }
    });
  }));

  await promises;

  process.exit(-1);
  try {
    const basePrecision = assets[base].precision;
    const results = await promises;
    const usdResult = results.shift().data;
    const usdLastBucket = usdResult[usdResult.length - 1];
    const usdPrices = getUsdPrices(basePrecision, usdLastBucket);

    results.forEach((result) => {
      const lastBucket = result.data[result.data.length - 1];
      const firstBucket = result.data[0];
      if (lastBucket) {
        const quotePrecision = assets[result.quote].precision;
        const firstBucketPrices = getPricesFromBucket(basePrecision, quotePrecision, firstBucket);
        const lastBucketPrices = getPricesFromBucket(basePrecision, quotePrecision, lastBucket);
        const lastPriceInUsd = lastBucketPrices.close / usdPrices.last;
        const baseVolume = precisedCount(parseInt(lastBucket.base_volume), basePrecision);
        const usdVolume = baseVolume * usdPrices.median;


        console.log('Now calculating stats for ', base, result.quote, lastBucket);
        console.log(baseVolume, usdVolume);

        const quoteStatsResult = {
          usdPrice: lastPriceInUsd,
          basePrice: lastBucketPrices.close,
          baseVolume,
          usdVolume
        };
        process.exit(-1);


        console.log(lastBucket);


        console.log('Stats for BTS:', result.quote, quoteStats);

      } else {
        baseToQuotes[result.quote] = false;
      }
    });
    return baseToQuotes;
  } catch(e) {
    console.log('Error', e);
  }
};

/*
  У нас есть список маркетов Base -> Quotes

  1. Забираем стату за 24h часовыми бакетами (заодно забрав бакет с usd)
  2. Выводим стату за 24h
  3. Забираем стату за 7 дней дневными бакетами
  4. Выводим изменение цены за 7 дней





 */

// Returns Usd data for given market (24h)
const getUsdData = (base) => {
  const usdAsset = assets['USD'];
  return Apis.instance().history_api().exec('')
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

    const usdData = await getUsdData('BTS');

    const test24 = await get24HourData('BTS', 'OPEN.EOS');
    // const usd24 = calculate from usdData and test24

    //const test7d = await get7dData('BTS', 'OPEN.EOS');


    const testStats = await getRawStats('BTS', markets['BTS']);

    console.log('RAW', testStats);

    return;
    try {
      const ticker = await Apis.instance().db_api().exec('get_ticker', ['BTS', 'CNY']);
      console.log(ticker);
    } catch(e) {
      console.log(e);
    }
});