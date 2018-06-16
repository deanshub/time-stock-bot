var request = require('request');
var Q = require('q');
var fs = require('fs');

var googleFinanaceApiUrl = 'http://finance.google.com/finance/info?client=ig&q=';
var yahooFinanaceApiUrlPrefix1 = 'https://query.yahooapis.com/v1/public/yql?q=select';
var yahooFinanaceApiUrlPrefix2 = ' * from csv where url=\'http://download.finance.yahoo.com/d/quotes.csv?s=';
var yahooFinanaceApiUrlSuffix1 = '&f=sl1d1t1c1p2c6k2ohgv&e=.csv\' and columns=\'symbol,price,date,time,change,pchange,rchange,rpchange,col1,high,low,col2\'';
var yahooFinanaceApiUrlSuffix2 = '&format=json&env=store';
var yahooFinanaceApiUrlSuffix3 = '://datatables.org/alltableswithkeys';

function getStockBySign(stockSign, yahoo) {
  return Q.promise(function (resolve, reject) {
    var stockQuery;
    if (yahoo){
      stockQuery = yahooFinanaceApiUrlPrefix1 +
        encodeURIComponent(yahooFinanaceApiUrlPrefix2 + stockSign + yahooFinanaceApiUrlSuffix1) +
        yahooFinanaceApiUrlSuffix2 +
        encodeURIComponent(yahooFinanaceApiUrlSuffix3);
    }else{
      stockQuery = googleFinanaceApiUrl + stockSign;
    }

    request(stockQuery, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var stockVal;
        if (stockQuery.indexOf(googleFinanaceApiUrl)!==-1){
          stockVal = JSON.parse(body.substring(3))[0];
        }else {
          stockVal = JSON.parse(body).query.results.row;
        }
        var parsedStock = {};
        for (var prop in stockVal) {
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
        resolve(parsedStock);
      }
    });
  }).catch(function () {
    if (!yahoo){
      return getStockBySign(stockSign, true);
    }else{
      throw 'cant find' + stockSign;
    }
  });
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

var SPACES = '                        ';
function fill(text){
  return (text+SPACES).slice(0, SPACES.length);
}

module.exports = {
  getStockBySign: getStockBySign,
  fill: fill,
};
