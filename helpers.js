var request = require('request');
var Q = require('q');
var fs = require('fs');

// var googleFinanaceApiUrl = 'http://finance.google.com/finance/info?client=ig&q=';
var yahooFinanaceApiUrlPrefix1 = 'https://query.yahooapis.com/v1/public/yql?q=select';
var yahooFinanaceApiUrlPrefix2 = ' * from csv where url=\'http://download.finance.yahoo.com/d/quotes.csv?s=';
var yahooFinanaceApiUrlSuffix1 = '&f=sl1d1t1c1p2c6k2ohgv&e=.csv\' and columns=\'symbol,price,date,time,change,pchange,rchange,rpchange,col1,high,low,col2\'';
var yahooFinanaceApiUrlSuffix2 = '&format=json&env=store';
var yahooFinanaceApiUrlSuffix3 = '://datatables.org/alltableswithkeys';

function getStockBySign(stockSign) {
  return Q.promise(function (resolve, reject) {
    var stockQuery = yahooFinanaceApiUrlPrefix1 +
      encodeURIComponent(yahooFinanaceApiUrlPrefix2 + stockSign + yahooFinanaceApiUrlSuffix1) +
      yahooFinanaceApiUrlSuffix2 +
      encodeURIComponent(yahooFinanaceApiUrlSuffix3);

    request(stockQuery, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var stockVal = JSON.parse(body);
        resolve(stockVal);
      }
    });
  });
}

function stockToMessage(stock) {
  var stockValues = stock.query.results.row;
  var messageBody = stockValues.symbol +'  ' +stockValues.low+ '      ' +
  stockValues.change+' ('+stockValues.pchange+')\n';
  // realtime is in stockValues.rchange and stockValues.rpchange

  return messageBody;
}

function writeSchedules(schedules) {
  var schedulesNesseccery = {};
  try{
    // creating schedules file (only nesseccery properties)
    for (var userId in schedules){
      for (var stockSign in schedules[userId]){
        if (!schedulesNesseccery[userId]){
          schedulesNesseccery[userId]={};
        }
        if (schedules[userId][stockSign]){
          schedulesNesseccery[userId][stockSign] = {
            textTime: schedules[userId][stockSign].textTime,
            numberToDiff: schedules[userId][stockSign].numberToDiff,
            daysOrMonths: schedules[userId][stockSign].daysOrMonths,
            timeBack: schedules[userId][stockSign].timeBack,
            percentRatio: schedules[userId][stockSign].percentRatio,
          };
        }
      }
    }

    var schedulesString = JSON.stringify(schedulesNesseccery);
    fs.writeFile('schedules.json',schedulesString,function (err) {
      if(err)console.log(err);
    });
  }catch(e){
    console.log(e);
  }
}

function getSchedulesFromFile() {
  return Q.promise(function (resolve, reject) {
    fs.readFile('schedules.json','utf8',function (err, schedulesString) {
      if (err) {
        console.log(err);
        reject(err);
      }else{
        var schedules = JSON.parse(schedulesString);
        resolve(schedules);
      }
    });
  });
}

module.exports = {
  getStockBySign: getStockBySign,
  stockToMessage: stockToMessage,
  writeSchedules: writeSchedules,
  getSchedulesFromFile: getSchedulesFromFile,
};
