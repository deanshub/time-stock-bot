import botCommander from '../botCommander';
import stateManager from '../stateManager';
import dataFetcher from '../utils/dataFetcher';
import {runPromises} from '../utils/promises';

export function singleStock(msg, match){
  const fromId = msg.from.id;
  const stockSign = match[1];

  return sendStockInfo(fromId, stockSign);
}

export function allStocks(msg){
  const fromId = msg.from.id;
  const stocks = stateManager.getStocksSymbolOfUser(fromId);

  if (stocks.length>0){
    var allMessagesPromises = stocks.map(stockSign => ()=>getStockMessage(fromId, stockSign));
    // TODO: might be better to Promise.resolveAll instead of Promise.all
    return runPromises(allMessagesPromises, 4).then(allMessages=>{
      return botCommander.sendMessage(fromId, allMessages.join(''));
    }).catch(function (err) {
      console.error(err);
      return botCommander.sendMessage(fromId, `Can't get all your stocks\nPlease try again later`);
    });
  }else{
    return botCommander.sendMessage(fromId, 'You don\'t have any scheduled stocks\nTry /add <STOCK_NAME> or /help');
  }
}

function sendStockInfo(fromId, stockSign){
  return getStockMessage(fromId, stockSign)
    .then(message=>botCommander.sendMessage(fromId, message));
}

function getStockMessage(fromId, stockSign) {
  return dataFetcher.getCurrentData([stockSign])
    .then(stocksValues => {
      const stockValues = stocksValues[stockSign];

      const stockMessage = valuesToMessage(stockValues);
      const diffMessage = getNumberDiff(fromId, stockSign, stockValues.currentValue);
      return `${stockMessage}${diffMessage}`;
    }).catch(function (err) {
      console.error(err);
      return `Failed to get "${stockSign}"\n`;
    });
}

function numberWithSign(value) {
  let parsedValue = 0;
  let sign='+';
  if (value!==undefined && value!==null){
    parsedValue = value;
  }
  if (parsedValue<0){
    sign = '-';
  }

  return sign + parsedValue.toFixed(2).replace(/[+-]/,'').trim();
}

function valuesToMessage(stockValues){
  const symbolUpper = stockValues.symbol.toUpperCase();
  const symbolValue = `[${symbolUpper}  ${stockValues.currentValue.toFixed(2)}](https://finance.yahoo.com/quote/${symbolUpper})`.padEnd(80);
  const messageBody = `${symbolValue} ${numberWithSign(stockValues.change)} (${numberWithSign(stockValues.pchange)}%)\n`;

  return messageBody;
}

function calcPDiff(initialValue, finalValue){
  const diff = finalValue - initialValue;
  return diff / initialValue * 100;
}

function getNumberDiff(fromId, stockSign, currentValue) {
  const key = `${fromId}.${stockSign}.numberToDiff`;
  const originalValue = stateManager.get(key);
  if (originalValue!==undefined){
    const diffNumber = currentValue - originalValue;
    const diffPercentage = calcPDiff(originalValue, currentValue);

    const diffPrefix = '_Diff:_'.padStart(10).padEnd(50);
    return `${diffPrefix}${numberWithSign(diffNumber)} (*${numberWithSign(diffPercentage)}%*)\n`;
  }
  return '';
}

export default {
  singleStock,
  allStocks,
};
