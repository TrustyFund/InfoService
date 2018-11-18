const { Apis } = require('bitsharesjs-ws');
const base = '1.3.0';
const quote = '1.3.850';

const endDate = new Date();
const startDate = new Date(endDate - (1000 * 60 * 60 * 24 * 7));
const endDateISO = endDate.toISOString().slice(0, -1);
const startDateISO = startDate.toISOString().slice(0, -1);

console.log(startDateISO, endDateISO);

Apis.instance("wss://bitshares.openledger.info/ws", true).init_promise.then(async () => {
  //const buckets = await Apis.instance().history_api().exec('get_market_history_buckets', []);

  console.time('get for 7 days on 1 day')
  const bucket = 86400;
  const data = await Apis.instance().history_api().exec(
    'get_market_history',
    [base, quote, bucket, startDateISO, endDateISO]
  );
  console.timeEnd('get for 7 days on 1 day');

  console.time('get for 7 days on 1h ')
  const bucket2 = 3600;
  const data2 = await Apis.instance().history_api().exec(
    'get_market_history',
    [base, quote, bucket, startDateISO, endDateISO]
  );
  console.log(data2[data2.length - 1]);
  console.timeEnd('get for 7 days on 1h ')

  /*const result = data.reduce((sum, buk) => sum + buk.base_volume, 0);
  console.log(result);*/
});