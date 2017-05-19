const request = require('request');
const Q = require('q');

const googleFinanaceApiUrl = 'http://finance.google.com/finance/info?client=ig&q=';
const yahooFinanaceApiUrlPrefix1 = 'https://query.yahooapis.com/v1/public/yql?q=select';
const yahooFinanaceApiUrlPrefix2 = ' * from csv where url=\'http://download.finance.yahoo.com/d/quotes.csv?s=';
const yahooFinanaceApiUrlSuffix1 = '&f=sl1d1t1c1p2c6k2ohgv&e=.csv\' and columns=\'symbol,price,date,time,change,pchange,rchange,rpchange,col1,high,low,col2\'';
const yahooFinanaceApiUrlSuffix2 = '&format=json&env=store';
const yahooFinanaceApiUrlSuffix3 = '://datatables.org/alltableswithkeys';
const alphaApiUrlPrefix='http://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=';
const alphaApiUrlSuffix='&interval=1min&apikey=PWJW';

const API = {
  ALPHAVANTAGE:0,
  YAHOO:1,
  GOOGLE:2,
  DEFAULT:3,
};

function buildQuery(stockSign, api){
  let stockQuery;
  if (api===API.ALPHAVANTAGE){
    stockQuery = alphaApiUrlPrefix + stockSign + alphaApiUrlSuffix;
  }else if (api===API.YAHOO) {
    stockQuery = yahooFinanaceApiUrlPrefix1 +
      encodeURIComponent(yahooFinanaceApiUrlPrefix2 + stockSign + yahooFinanaceApiUrlSuffix1) +
      yahooFinanaceApiUrlSuffix2 +
      encodeURIComponent(yahooFinanaceApiUrlSuffix3);
  }else if (api===API.GOOGLE) {
    stockQuery = googleFinanaceApiUrl + stockSign;
  }
  return stockQuery;
}

function stringToNumber(value){
  var returnValue = undefined;
  try {
    returnValue = parseFloat(value.replace('%',''));
    if (isNaN(returnValue)){
      returnValue = undefined;
    }
  } catch (e) {
    console.error(e);
  }
  return returnValue;
}

function getValOfObjByKey(key,obj){
  const keys = Object.keys(obj);
  const keyIndex = keys.findIndex(a=>a.includes(key));
  return obj[keys[keyIndex]];
}

function normalizeStock(body, api){
  let stockVal;
  if (api===API.ALPHAVANTAGE){
    stockVal = JSON.parse(body);
  }else if (api===API.YAHOO) {
    stockVal = JSON.parse(body).query.results.row;
  }else if (api===API.GOOGLE) {
    stockVal = JSON.parse(body.substring(3))[0];
  }

  let parsedStock ={};

  if(api===API.YAHOO||api===API.GOOGLE){
    for (let prop in stockVal) {
      if (prop==='symbol' || prop==='t'|| prop==='ltt'|| prop==='lt'|| prop==='lt_dts'){
        parsedStock[prop] = stockVal[prop];
      }else{
        parsedStock[prop] = stringToNumber(stockVal[prop]);
      }
    }
    if (parsedStock.symbol===undefined){
      parsedStock.symbol = parsedStock.t;
    }
    if (parsedStock.low===undefined){
      parsedStock.low = parsedStock.l;
    }
    if (parsedStock.price===undefined){
      parsedStock.price = parsedStock.l;
    }
    if (parsedStock.change===undefined){
      parsedStock.change = parsedStock.c;
    }
    if (parsedStock.pchange===undefined){
      parsedStock.pchange = parsedStock.cp;
    }
    parsedStock.currentValue = parsedStock.low!==undefined?parsedStock.low:parsedStock.price;
  }else{
    parsedStock.symbol = getValOfObjByKey('Symbol' ,stockVal['Meta Data']);
    parsedStock.lastRefreshed = new Date(getValOfObjByKey('Last Refreshed' ,stockVal['Meta Data']));
    const dailyValuesKeys = Object.keys(stockVal['Time Series (Daily)']);
    const todaysVals = stockVal['Time Series (Daily)'][dailyValuesKeys[0]];

    const openString = getValOfObjByKey('open',todaysVals);
    const highString = getValOfObjByKey('high',todaysVals);
    const lowString = getValOfObjByKey('low',todaysVals);
    const closeString = getValOfObjByKey('close',todaysVals);
    const volumeString = getValOfObjByKey('volume',todaysVals);

    parsedStock.open = stringToNumber(openString);
    parsedStock.high = stringToNumber(highString);
    parsedStock.low = stringToNumber(lowString);
    parsedStock.close = stringToNumber(closeString);
    parsedStock.volume = stringToNumber(volumeString);
    parsedStock.currentValue = parsedStock.close;

    const previousVals = stockVal['Time Series (Daily)'][dailyValuesKeys[1]];
    const previousClose = stringToNumber(getValOfObjByKey('close',previousVals));

    const diff = parsedStock.currentValue - previousClose;
    parsedStock.change = diff;
    parsedStock.pchange = diff / previousClose * 100;
  }

  return parsedStock;
}

function getCurrentSingleStockData(stock, api) {
  return new Promise((resolve, reject)=>{
    if (api<API.DEFAULT && typeof(stock)==='string'){
      const stockQuery = buildQuery(stock, api);
      request(stockQuery, function (error, response, body) {
        if (error || response.statusCode !== 200) {
          return reject(error||'Error getting data');
        }else{
          try{
            const stockVal = normalizeStock(body, api);
            resolve(stockVal);
          }catch(e){
            reject(e);
          }
        }
      });
    }else{
      return reject('Can\'t get current data of stock');
    }
  }).catch(()=>{
    if (api<API.DEFAULT){
      return getCurrentSingleStockData(stock, api+1);
    }else{
      return Promise.reject('Can\'t get current data of stock');
    }
  });
}

function getCurrentData(stocks=[], api=API.ALPHAVANTAGE){
  return Promise.all(stocks.map((stock)=>{
    return getCurrentSingleStockData(stock, api);
  })).then((stocksData)=>{
    return stocksData.reduce((res,curr, index)=>{
      res[stocks[index]] = curr;
      return res;
    },{});
  });
}

const ONE_DAY = 24*60*60*1000;
const HISTORIC_URL_PREFIX = 'http://www.alphavantage.co/query?apikey=PWJW';

function buildHistoricQuery(stock, startDate, endDate){
  let query;
  const diffDays = Math.round(Math.abs((endDate.getTime() - startDate.getTime())/(ONE_DAY)));
  if (diffDays<2){
    query = HISTORIC_URL_PREFIX + '&function=TIME_SERIES_INTRADAY&symbol='+stock+
    +'&interval=15min';
  }else if (diffDays<20){
    query = HISTORIC_URL_PREFIX + '&function=TIME_SERIES_DAILY&symbol='+stock;
  }else if (diffDays<100){
    query = HISTORIC_URL_PREFIX + '&function=TIME_SERIES_WEEKLY&symbol='+stock;
  }else{
    query = HISTORIC_URL_PREFIX + '&function=TIME_SERIES_MONTHLY&symbol='+stock;
  }
  return query;
}

function normalizeHistoricData(data){
  const parsedData = JSON.parse(data);
  let values = parsedData[Object.keys(parsedData)[1]];
  if (values===undefined){
    values=[];
  }
  const normalizedValues = Object.keys(values).sort((a,b)=>new Date(b) - new Date(a)).map((date)=>{
    return {
      date: new Date(date),
      open: stringToNumber(getValOfObjByKey('open', values[date])),
      high: stringToNumber(getValOfObjByKey('high', values[date])),
      low: stringToNumber(getValOfObjByKey('low', values[date])),
      close: stringToNumber(getValOfObjByKey('close', values[date])),
      volume: stringToNumber(getValOfObjByKey('volume', values[date])),
      currentValue: stringToNumber(getValOfObjByKey('close', values[date])),
    };

  });
  return normalizedValues;
}

function getHistoricSingleStockData(stock, startDate, endDate) {
  return new Promise((resolve,reject)=>{
    if (typeof(stock)==='string'){
      const query = buildHistoricQuery(stock, startDate, endDate);
      request(query, function (error, response, body) {
        if (error || response.statusCode !== 200) {
          return reject(error||'Error getting data');
        }else{
          const values = normalizeHistoricData(body);
          resolve(values);
        }
      });
    }else{
      return reject('empty stock');
    }
  });
}

function getHistoricData(stocks=[], startDate, endDate){
  return Promise.all(stocks.map(stock=>{
    return getHistoricSingleStockData(stock, startDate, endDate).catch(()=>{
      return getHistoricSingleStockData(stock, startDate, endDate);
    });
  })).then((historicData)=>{
    return historicData.reduce((res,curr, index)=>{
      res[stocks[index]] = curr;
      return res;
    },{});
  });
}

module.exports = {
  getCurrentData:getCurrentData,
  getHistoricData:getHistoricData,
};
