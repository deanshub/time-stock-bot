import axios from 'axios';
import {runPromises} from '../promises'

const buildQuery = (symbol) => `http://finance.google.com/finance/info?client=ig&q=${symbol}`;

function normalizeStock(body){
  const stockVal= JSON.parse(body.substring(3))[0];

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
