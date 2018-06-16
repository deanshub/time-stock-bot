import axios from 'axios';
import regression from 'regression';
import dataFetcher from './dataFetcher';

var yahooapiPrefix = 'http://query.yahooapis.com/v1/public/yql?q=';
var yahooapiPostfix = '&format=json&env=store://datatables.org/alltableswithkeys';

const buildYahooBatchQuery = (stocks)=> `SELECT * FROM yahoo.finance.quotes WHERE symbol IN ("${stocks.join('","').toUpperCase()}")`;

function bestAskFor(stock){
  ['AskRealtime','Ask','LastTradePriceOnly','Open','PreviousClose'].forEach(function (prop) {
    try {
      var bestAskVal = parseFloat(stock[prop]);
      if (!isNaN(bestAskVal)){
        stock.bestAskVal = bestAskVal;
        stock.bestAskProp = prop;
        return stock;
      }
    } catch (e) {}
  });
  return stock;
}

function getCurrentDataOfStocks(stocks) {
  return new Promise(function (resolve, reject) {
    if (stocks.length===0){
      return resolve({});
    }
    const query = buildYahooBatchQuery(stocks);
    return axios.get(`${yahooapiPrefix}${query}${yahooapiPostfix}`)
      .then(({data})=>{
        var processedStocks = {};
        var yahooResult;
        try {
          yahooResult = JSON.parse(data).query.results.quote;
        } catch (e) {
          reject(data);
        }
        if (Array.isArray(yahooResult)){
          yahooResult.forEach(function (stock) {
            processedStocks[stock.Symbol] = bestAskFor(stock);
          });
        }else{
          var stock = yahooResult;
          processedStocks[stock.Symbol] = bestAskFor(stock);
        }
        resolve(processedStocks);
      }).catch(reject);
  });
}

function checkIfShouldBuy(stocks, startDate, ratio) {
  const bestAskProp = 'currentValue';
  var winningStocks = [];
  return Promise.all([dataFetcher.getCurrentData(stocks), dataFetcher.getHistoricData(stocks, startDate, new Date())])
  .then(function (results) {
    var currentStockVals = results[0];
    var historicStockVals = results[1];
    // forEach stock in currentStockVals
    // get linear regression within historicStockVals[stock]
    // if currentStockVals[stock] - ratio < linear regression prediction to this date
    // return that should buy
    for (var stockSign in currentStockVals){
      if (currentStockVals[stockSign][bestAskProp]!==undefined && historicStockVals[stockSign]!==undefined){
        var data = historicStockVals[stockSign].map(function (stockVal, index) {
          // can also be Close
          return [index, stockVal[bestAskProp]];
        });


        // lose the last trade
        data.pop();

        var equation = regression('linear', data).equation;
        var gradient = equation[0];
        var yIntercept = equation[1];
        if(gradient>0){
          var prediction = data.length * gradient + yIntercept;
          // can also be LastTradePriceOnly
          var diffPercentage = (prediction - currentStockVals[stockSign][bestAskProp])/currentStockVals[stockSign][bestAskProp]*100;
          var higestClosing = Math.max.apply(null, data.map(function (stock) {
            return stock[1];
          }));
          var currentlyNotHighestAskingPrice = currentStockVals[stockSign][bestAskProp]<higestClosing;
          var highestAndCurrentRatio = currentStockVals[stockSign][bestAskProp]/higestClosing;
          if (diffPercentage > ratio && currentlyNotHighestAskingPrice && highestAndCurrentRatio<0.985){
            winningStocks.push({
              stockSign: stockSign,
              prediction: prediction,
              askingPrice: currentStockVals[stockSign][bestAskProp],
              askingPriceProp: bestAskProp,
              diffPercentage: diffPercentage,
            });
          }
        }
      }
    }
    return winningStocks;
  });
}

function getPredictions(stocks, daysOrMonths, numberBack, ratio) {
  var startDate = new Date();
  if (daysOrMonths==='1'){
    startDate.setDate(startDate.getDate()-numberBack);
  }else {
    startDate.setMonth(startDate.getMonth()-numberBack);
  }
  return checkIfShouldBuy(stocks, startDate, ratio).then(function (winningStocks) {
    return winningStocks.map(function (stock) {
      const symbolUpper = stock.stockSign.toUpperCase();
      return {
        stockSign: stock.stockSign,
        message:`[${symbolUpper}   (+${stock.diffPercentage.toFixed(2)}%)](https://finance.yahoo.com/quote/${symbolUpper})\nprediction: ${stock.prediction.toFixed(2)}  current:${stock.askingPrice}\n`,
      };
    });
  });
}

function getPredictionInfo(stockSign) {
  var uppercaseStockSign = stockSign.toUpperCase();
  return getCurrentDataOfStocks([stockSign]).then(function (stockVals) {
    var messageBody = stockSign.toUpperCase() + ' info:\n';
    for(var prop in stockVals[uppercaseStockSign]){
      if (stockVals[uppercaseStockSign][prop]!==null && stockVals[uppercaseStockSign][prop]!==undefined){
        messageBody+= prop + ': ' + stockVals[uppercaseStockSign][prop] + '\n';
      }
    }
    return messageBody;
  });
}

module.exports = {
  getPredictions: getPredictions,
  getPredictionInfo: getPredictionInfo,
};
