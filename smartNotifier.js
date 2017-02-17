var request = require('request');
var Q = require('q');
var regression = require('regression');

var yahooapiPrefix = 'http://query.yahooapis.com/v1/public/yql?q=';
var yahooapiPostfix = '&format=json&env=store://datatables.org/alltableswithkeys';

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
  var query = 'SELECT * FROM yahoo.finance.quotes WHERE symbol IN ("' + stocks.join('","').toUpperCase() +'")';
  return Q.promise(function (resolve, reject) {
    request(yahooapiPrefix+query+yahooapiPostfix, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var processedStocks = {};
        var yahooResult;
        try {
          yahooResult = JSON.parse(body).query.results.quote;
        } catch (e) {
          reject(body);
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
      }
    });
  });
}

function dateToString(date) {
  var isoString = date.toISOString();
  return isoString.substring(0, isoString.indexOf('T'));
}

function compareStocks(a, b) {
  return a.Date > b.Date;
}

// historical data
function getHistoricDataOfStocks(stocks, startDate, endDate) {
  return Q.promise(function (resolve, reject) {
    var startDateString = dateToString(startDate);
    var endDateString = dateToString(endDate);
    var query ='SELECT Symbol,Date,Close,Adj_Close FROM yahoo.finance.historicaldata WHERE symbol IN ("'+stocks.join('","').toUpperCase()+'") '+
      'AND startDate = "'+startDateString+'" AND endDate = "'+endDateString+'"';
    request(yahooapiPrefix+query+yahooapiPostfix, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var processedStocks = {};
        var yahooResult;
        try {
          yahooResult = JSON.parse(body).query.results.quote;
        } catch (e) {
          reject(body);
        }
        if (yahooResult){
          yahooResult.forEach(function (stock) {
            if (!processedStocks[stock.Symbol]){
              processedStocks[stock.Symbol] = [];
            }
            processedStocks[stock.Symbol].push({
              Date: new Date(stock.Date),
              Close: parseFloat(stock.Close),
              Adj_Close: parseFloat(stock.Adj_Close),
            });
          });

          for (var stockSymbol in processedStocks){
            processedStocks[stockSymbol] = processedStocks[stockSymbol].sort(compareStocks);
          }
        }
        resolve(processedStocks);
      }
    });
  });
}

// getCurrentDataOfStocks(['FB','AAPL']).then(console.log);

// var startDate = new Date();
// startDate.setMonth(startDate.getMonth()-1);
// var endDate = new Date();
// getHistoricDataOfStocks(['FB','AAPL'], startDate, endDate).then(console.log);

function checkIfShouldBuy(stocks, startDate, ratio) {
  var winningStocks = [];
  return Q.all([getCurrentDataOfStocks(stocks), getHistoricDataOfStocks(stocks, startDate, new Date())])
  .then(function (results) {
    var currentStockVals = results[0];
    var historicStockVals = results[1];
    // forEach stock in currentStockVals
    // get linear regression within historicStockVals[stock]
    // if currentStockVals[stock] - ratio < linear regression prediction to this date
    // return that should buy
    for (var stockSign in currentStockVals){
      if (currentStockVals[stockSign].bestAskVal!==undefined && historicStockVals[stockSign]!==undefined){
        var data = historicStockVals[stockSign].map(function (stockVal, index) {
          // can also be Close
          return [index, stockVal.Adj_Close];
        });

        // lose the last trade
        data.pop();

        var equation = regression('linear', data).equation;
        var gradient = equation[0];
        var yIntercept = equation[1];
        if(gradient>0){
          var prediction = data.length * gradient + yIntercept;
          // can also be LastTradePriceOnly
          var diffPercentage = (prediction - currentStockVals[stockSign].bestAskVal)/currentStockVals[stockSign].bestAskVal*100;
          if (diffPercentage > ratio){
            winningStocks.push({
              stockSign: stockSign,
              prediction: prediction,
              askingPrice: currentStockVals[stockSign].bestAskVal,
              askingPriceProp: currentStockVals[stockSign].bestAskProp,
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
  if (daysOrMonths){
    startDate.setDate(startDate.getDate()-numberBack);
  }else {
    startDate.setMonth(startDate.getMonth()-numberBack);
  }
  return checkIfShouldBuy(stocks, startDate, ratio).then(function (winningStocks) {
    return winningStocks.map(function (stock) {
      return stock.stockSign + '\n prediction: '+stock.prediction.toFixed(2) + '  current:' +
      stock.askingPrice + 'by ' + stock.askingPriceProp +' ('+stock.diffPercentage.toFixed(2)+'%)';
    });
  });
}

module.exports = {
  getPredictions: getPredictions,
};
