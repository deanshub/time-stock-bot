import axios from 'axios';
import {runPromises} from '../promises'


const yahooFinanaceApiUrlPrefix1 = 'https://query.yahooapis.com/v1/public/yql?q=select';
const yahooFinanaceApiUrlPrefix2 = ' * from csv where url=\'http://download.finance.yahoo.com/d/quotes.csv?s=';
const yahooFinanaceApiUrlSuffix1 = '&f=sl1d1t1c1p2c6k2ohgv&e=.csv\' and columns=\'symbol,price,date,time,change,pchange,rchange,rpchange,col1,high,low,col2\'';
const yahooFinanaceApiUrlSuffix2 = '&format=json&env=store';
const yahooFinanaceApiUrlSuffix3 = '://datatables.org/alltableswithkeys';
const buildYahooMiddleQuery = (symbol) => encodeURIComponent(`${yahooFinanaceApiUrlPrefix2}${symbol}${yahooFinanaceApiUrlSuffix1}`);
const buildQuery = (symbol) =>
  `${yahooFinanaceApiUrlPrefix1}${buildYahooMiddleQuery(symbol)}${yahooFinanaceApiUrlSuffix2}${encodeURIComponent(yahooFinanaceApiUrlSuffix3)}`;

function normalizeStock(body){
  const stockVal=body.query.results.row;

  const parsedStock ={};

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

  return parsedStock;
}

export function getCurrentSingleStockData(stock){
  const stockQuery = buildQuery(stock);

  return axios.get(stockQuery).then(({data})=>{
    return normalizeStock(data);
  })
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
