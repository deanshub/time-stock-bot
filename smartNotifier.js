var request = require('request');
var Q = require('q');
var regression = require('regression');

var yahooapiPrefix = 'http://query.yahooapis.com/v1/public/yql?q=';
var yahooapiPostfix = '&format=json&env=http://datatables.org/alltables.env';

function getCurrentDataOfStocks(stocks) {
  var query = 'SELECT Symbol,LastTradePriceOnly,Ask FROM yahoo.finance.quotes WHERE symbol IN ("' + stocks.join('","') +'")';
  return Q.promise(function (resolve, reject) {
    request(yahooapiPrefix+query+yahooapiPostfix, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var processedStocks = {};
        var yahooResult = JSON.parse(body);
        if (Array.isArray(yahooResult.query.results.quote)){
          yahooResult.query.results.quote.forEach(function (stock) {
            processedStocks[stock.Symbol] = {
              LastTradePriceOnly: parseFloat(stock.LastTradePriceOnly),
              Ask: parseFloat(stock.Ask),
            };
          });
        }else{
          var stock = yahooResult.query.results.quote;
          processedStocks[stock.Symbol] = {
            LastTradePriceOnly: parseFloat(stock.LastTradePriceOnly),
            Ask: parseFloat(stock.Ask),
          };
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
    var query ='SELECT Symbol,Date,Close,Adj_Close FROM yahoo.finance.historicaldata WHERE symbol IN ("'+stocks.join('","')+'") '+
      'AND startDate = "'+startDateString+'" AND endDate = "'+endDateString+'"';
    request(yahooapiPrefix+query+yahooapiPostfix, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var processedStocks = {};
        var yahooResult = JSON.parse(body);
        if (yahooResult.query.results){
          yahooResult.query.results.quote.forEach(function (stock) {
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

function checkIfShouldBy(stocks, startDate, ratio) {
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
        var diffPercentage = (prediction - currentStockVals[stockSign].Ask)/currentStockVals[stockSign].Ask*100;
        if (diffPercentage > ratio){
          winningStocks.push({
            stockSign: stockSign,
            prediction: prediction,
            askingPrice: currentStockVals[stockSign].Ask,
            diffPercentage: diffPercentage,
          });
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
  return checkIfShouldBy(stocks, startDate, ratio).then(function (winningStocks) {
    return winningStocks.map(function (stock) {
      return stock.stockSign + '\n prediction: '+stock.prediction + '  current:' +
      stock.askingPrice + ' ('+stock.diffPercentage.toFixed(2)+'%)';
    });
  });
}

module.exports = {
  getPredictions: getPredictions,
};
