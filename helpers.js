var request = require('request');
var Q = require('q');
var fs = require('fs');

var googleFinanaceApiUrl = 'http://finance.google.com/finance/info?client=ig&q=';

function getStockBySign(stockSign) {
  return Q.promise(function (resolve, reject) {
    request(googleFinanaceApiUrl + stockSign, function (error, response, body) {
      if (error || response.statusCode !== 200) {
        return reject(error);
      }else{
        var stockVal = JSON.parse(body.substring(3))[0];
        resolve(stockVal);
      }
    });
  });
}

function stockToMessage(stock) {
  var messageBody = stock.t +'  ' +stock.l+ '      ' +
  // (stock.e)? " from \n"+stock.e:"\n"+
  // stock.lt+'\n'+
  stock.c+' ('+stock.cp+'%)\n';

  return messageBody;
}

function writeSchedules(schedules) {
  // numberToDiff
  // textTime
  var schedulesNesseccery = {};
  try{
    // creating schedules file (only nesseccery properties)
    for (var userId in schedules){
      for (var stockSign in schedules[userId]){
        if (!schedulesNesseccery[userId]){
          schedulesNesseccery[userId]={};
        }
        if (schedules[userId][stockSign] && schedules[userId][stockSign].textTime){
          schedulesNesseccery[userId][stockSign] = {
            textTime: schedules[userId][stockSign].textTime,
            numberToDiff: schedules[userId][stockSign].numberToDiff,
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
      var schedules = JSON.parse(schedulesString);
      if (err) {
        console.log(err);
        reject(err);
      }else{
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
