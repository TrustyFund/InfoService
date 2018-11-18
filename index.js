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

const getUsdPrices = (basePrecision, usdFirstBucket, usdLastBucket) => {
  const usdPrecision = assets['USD'].precision;
  const { open: usdOpenPrice } = getPricesFromBucket(basePrecision, usdPrecision, usdFirstBucket);
  const { close: usdClosePrice } = getPricesFromBucket(basePrecision, usdPrecision, usdLastBucket);
  const medianPrice = (usdOpenPrice + usdClosePrice) / 2;
  return {
    last: usdClosePrice,
    median: medianPrice
  }
};

const dailyStatsInHourBuckets = (base, quote) => {
  const bucketSize = 3600;
  const endDate = new Date();
  const startDate = new Date(endDate - (1000 * 60 * 60 * 24));
  const endDateISO = endDate.toISOString().slice(0, -5);
  const startDateISO = startDate.toISOString().slice(0, -5);
  return Apis.instance().history_api().exec(
    'get_market_history',
    [base.id, quote.id, bucketSize, startDateISO, endDateISO]
  ).then((result) => {
    console.log(result);
    return {
      asset: quote,
      data: result
    }
  });
};

const getDailyStats = (base, quote, usdPrices, buckets) => {
  if (!buckets.length) return false;
  const volume = buckets.reduce((vol, itm) => itm.base_volume + vol, 0);
  const baseVolume = precisedCount(volume, base.precision);
  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];
  const firstBucketPrices = getPricesFromBucket(base.precision, quote.precision, firstBucket);
  const lastBucketPrices = getPricesFromBucket(base.precision, quote.precision, lastBucket);

  const priceDecrease = lastBucketPrices.close - firstBucketPrices.open;
  const change = priceDecrease * 100 / lastBucketPrices.close;

  return {
    baseVolume,
    usdVolume: baseVolume / usdPrices.median,
    price: lastBucketPrices.close,
    usdPrice: lastBucketPrices.close / usdPrices.last,
    change24h: change
  };
};

Apis.instance("wss://bitshares.openledger.info/ws", true).init_promise.then(async (res) => {
  let marketAssets = Object.keys(markets);
  let othersAssets = marketAssets.reduce((result, market) => {
    return result.concat(markets[market]);
  }, []);
  assets = await populateAssets([...marketAssets,...othersAssets]);

  const base = assets['BTS'];
  const marketQuotes = markets['BTS'].map((symbol) => assets[symbol]);
  const quotes = [assets['USD'], assets['OPEN.BTC']];

  console.time('Start');
  const result = await Promise.all(quotes.map((quote) => dailyStatsInHourBuckets(base, quote)));

  const [usdResult, ...others] = result;

  const usdFirstBucket = usdResult.data[0];
  const usdLastBucket = usdResult.data[usdResult.data.length - 1];
  const usdPrices = getUsdPrices(base.precision, usdFirstBucket, usdLastBucket);

  others.forEach((quoteRawStat) => {
    const dailyStats = getDailyStats(base, quoteRawStat.asset, usdPrices, quoteRawStat.data);
    console.log(base.symbol, quoteRawStat.asset.symbol, dailyStats);
  });
});