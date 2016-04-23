var request = require('request');
var Q = require('q');

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
  var messageBody = stock.t +'\t\t' +stock.l+ '\n' +
  // (stock.e)? " from \n"+stock.e:"\n"+
  // stock.lt+'\n'+
  stock.c+' ('+stock.cp+'%)\n';

  return messageBody;
}


module.exports = {
  getStockBySign: getStockBySign,
  stockToMessage: stockToMessage,
};
