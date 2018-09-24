import axios from 'axios';
import {runPromises} from '../promises'

const buildAlphaQuery = (symbol) => `http://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&interval=1min&apikey=PWJW`;

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

export function getCurrentSingleStockData(stock){
  const stockQuery = buildAlphaQuery(stock);

  return axios.get(stockQuery).then(({data})=>{
    if (!data.Information){
      return normalizeStock(data);
    }
    throw new Error(data.Information)
  })
}

function normalizeStock(stockVal){
  const parsedStock ={};

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
  parsedStock.low = stringToNumber(lowString);
  parsedStock.high = stringToNumber(highString);
  parsedStock.close = stringToNumber(closeString);
  parsedStock.volume = stringToNumber(volumeString);
  parsedStock.currentValue = parsedStock.close;

  const previousVals = stockVal['Time Series (Daily)'][dailyValuesKeys[1]];
  const previousClose = stringToNumber(getValOfObjByKey('close',previousVals));

  const diff = parsedStock.currentValue - previousClose;
  parsedStock.change = diff;
  parsedStock.pchange = diff / previousClose * 100;

  return parsedStock;
}

export function getCurrentData(stocks=[]){
  return runPromises(stocks.map((stock)=>{
    return ()=>getCurrentSingleStockData(stock);
  }), 2).then((stocksData)=>{
    return stocksData.reduce((res,curr, index)=>{
      res[stocks[index]] = curr;
      return res;
    },{});
  });
}

/*********************************************************************************/

const ONE_DAY = 24*60*60*1000;
const HISTORIC_URL_PREFIX = 'http://www.alphavantage.co/query?apikey=PWJW';
function buildHistoricQuery(stock, startDate, endDate){
  let query;
  const diffDays = Math.round(Math.abs((endDate.getTime() - startDate.getTime())/(ONE_DAY)));
  if (diffDays<2){
    query = `${HISTORIC_URL_PREFIX}&function=TIME_SERIES_INTRADAY&symbol=${stock}&interval=15min`;
  }else if (diffDays<20){
    query = `${HISTORIC_URL_PREFIX}&function=TIME_SERIES_DAILY&symbol=${stock}`;
  }else if (diffDays<100){
    query = `${HISTORIC_URL_PREFIX}&function=TIME_SERIES_WEEKLY&symbol=${stock}`;
  }else{
    query = `${HISTORIC_URL_PREFIX}&function=TIME_SERIES_MONTHLY&symbol=${stock}`;
  }
  return query;
}

function normalizeHistoricData(data){
  let values = data[Object.keys(data)[1]];
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
      return axios.get(query).then(({data})=>{
        const values = normalizeHistoricData(data);
        return resolve(values);
      }).catch(reject);
    }else{
      return reject('empty stock');
    }
  });
}

export function getHistoricData(stocks=[], startDate, endDate){
  return Promise.all(stocks.map(stock=>{
    return getHistoricSingleStockData(stock, startDate, endDate)
  })).then((historicData)=>{
    return historicData.reduce((res,curr, index)=>{
      res[stocks[index]] = curr;
      return res;
    },{});
  });
}
