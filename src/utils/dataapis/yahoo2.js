import { lookup, history } from 'yahoo-stocks'
import {runPromises} from '../promises'

function calcPDiff(initialValue, finalValue){
  const diff = finalValue - initialValue;
  return diff / initialValue * 100;
}

function normalizeStock(data){

  const {
    symbol,
    name,
    exchange,
    currentPrice,
    highPrice,
    lowPrice,
    meanPrice,
    medianPrice
  } = data[0]
  const {records} = data[1]
  const previousClose = records[records.length-2].close

  console.log(currentPrice, data[1]);
  const parsedStock = {
    symbol,
    low: lowPrice,
    price: currentPrice,
    change: currentPrice - previousClose,
    pchange: calcPDiff(previousClose, currentPrice),
    currentValue: currentPrice,
  };

  return parsedStock;
}

export function getCurrentSingleStockData(stock){
  return Promise.all([lookup(stock), history(stock, {interval:'1d', range:'5d'})]).then(data=>{
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
