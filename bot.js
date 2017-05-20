//TimeStockBot
var TelegramBot = require('node-telegram-bot-api');
var later = require('later');
var Q = require('q');

const data = require('./data');
var helpers = require('./helpers');
var smartNotifier = require('./smartNotifier');
var PREDICTION_SIGN = '~';
var ALL_STOCKS_SIGN = '*';

var token = process.env.BOT_API;
var options = {
  webHook: {
    port: 8443,
    key: __dirname+'/key.pem',
    cert: __dirname+'/crt.pem',
  },
};

var bot = new TelegramBot(token, options);
bot.setWebHook('stock.shubapp.com:443/bot'+token, __dirname+'/crt.pem');
var schedules={};

var botDescription=`Hi, I\'m TimeStockBot
This is what I can do:
/stock - get full report on all added stocks
/stock <STOCK-SIGN> - current stock values
/get - alias for /stock
/info <STOCK-SIGN> - get all information on the stock
/add <STOCK-SIGN> - add stock to full stocks report
/remove <STOCK-SIGN> - remove stock from full stocks report
/time <TIME> - send a full stocks report at a certain time
/time cancel - stop automatic message of full stocks report
/graph <STOCK-SIGN> - stock 3 day graph
/graph <STOCK-SIGN> <PERIOD-AMOUNT><PERIDO-SIGN> - stock graph by time period
                  PERIOD-AMOUNT = number  PERIDO-SIGN = d|m|y
/diff <STOCK-SIGN> <NUMBER> - added stocks will also show ratio to this number
/predict <DAYS-OR-MONTHS> <TIME-BACK> <PERCENT> <INTERVAL> <TIME-FRAME> - shows prediction when to buy the stock,
         DAYS-OR-MONTHS = 1|0 TIME-BACK=number PERCENT=float INTERVAL=number TIME-FRAME=m|h|D
/predict - if the previous defined then sends prediction immidiatly
/help - to get this message

Examples:
/stock fb
/info fb
/add fb
/add aapl
/graph wix 1y
/time at 10:00
/predict 1 7 5 1 h
For more information on <TIME>, see http://bunkat.github.io/later/assets/img/Schedule.png`;

var allKeyboardOpts ={
  reply_markup:JSON.stringify({
    keyboard:[
      ['/predict'],
      ['/get'],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  }),
  parse_mode: 'Markdown',
  disable_web_page_preview:true,
};

function init() {
  helpers.getSchedulesFromFile().then(function (schedulesFromFile) {
    reloadSchedules(schedulesFromFile);
  });

  bot.onText(/\/help/, helpHandler);
  bot.onText(/\/diff ([^ ]+) ([+-]?\d+(\.\d+)?)$/, diffHandler);
  bot.onText(/\/stock ([^ ]+)$/, stockOnlyHandler);
  bot.onText(/\/stock$/, allStocksHandler);
  bot.onText(/\/get ([^ ]+)$/, stockOnlyHandler);
  bot.onText(/\/get$/, allStocksHandler);
  bot.onText(/\/add ([^ ]+)$/, stockAddHandler);
  bot.onText(/\/remove ([^ ]+)$/, stockRemoveHandler);
  bot.onText(/\/time (.+)$/, allStocksTimeHandler);
  bot.onText(/\/graph ([^ ]+) ?(\d*)([dym])?$/, graphHandler);
  bot.onText(/^\/predict ([01]) (\d+) (\d+(\.\d+)?) (\d+) ([mhD])$/, predictionHandler);
  bot.onText(/^\/predict$/, predictNowHandler);
  bot.onText(/^\/info ([^ ]+)$/, infoHandler);
}


function reloadSchedules(fileSchedules) {
  for (var userId in fileSchedules){
    for (var stockSign in fileSchedules[userId]){
      var t;
      var sched;
      if (stockSign === ALL_STOCKS_SIGN ){
        sched = later.parse.text(fileSchedules[userId][stockSign].textTime);

        (function (userId) {
          t = later.setInterval(function(){
            allStocksHandler({from:{id:userId}});
          }, sched);
        })(userId);

        if (!schedules[userId]){
          schedules[userId] = {};
        }

        schedules[userId][stockSign] = t;
        schedules[userId][stockSign].textTime = fileSchedules[userId][stockSign].textTime;
        schedules[userId][stockSign].numberToDiff = fileSchedules[userId][stockSign].numberToDiff;
      }else if (stockSign === PREDICTION_SIGN ){
        var textTime = fileSchedules[userId][stockSign].textTime;
        var daysOrMonths = fileSchedules[userId][stockSign].daysOrMonths;
        var timeBack = fileSchedules[userId][stockSign].timeBack;
        var percentRatio = fileSchedules[userId][stockSign].percentRatio;

        sched = later.parse.text(textTime);

        (function (userId, daysOrMonths, timeBack, percentRatio, sched) {
          t = later.setInterval(function(){
            sendPredictions(userId, daysOrMonths, timeBack, percentRatio);
          }, sched);
        })(userId, daysOrMonths, timeBack, percentRatio, sched);

        if (!schedules[userId]){
          schedules[userId] = {};
        }
        schedules[userId][stockSign] = t;
        schedules[userId][stockSign].textTime = textTime;
        schedules[userId][stockSign].daysOrMonths = daysOrMonths;
        schedules[userId][stockSign].timeBack = timeBack;
        schedules[userId][stockSign].percentRatio = percentRatio;
      }else{
        if (!schedules[userId]){
          schedules[userId] = {};
        }
        schedules[userId][stockSign] = fileSchedules[userId][stockSign];
      }
    }
  }
}



function getStockMessage(fromId, stockSign) {
  return data.getCurrentData([stockSign])
    .then(function (stocksValues) {
      const stockValues = stocksValues[stockSign];
      var message = helpers.stockToMessage(stockValues);

      message+=getNumberDiff(fromId, stockSign, stockValues.currentValue);
      return message;
    }).catch(function (err) {
      console.log(err);
      return 'sorry, I failed to get you ' + stockSign + '\n';
    });
}

function sendStockInfo(fromId, stockSign){
  getStockMessage(fromId, stockSign).then(function (message) {
    sendMessage(fromId, message);
  });
}

function cancelStockScheduling(fromId, stockSign){
  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign].clear();
    schedules[fromId][stockSign]=null;
    helpers.writeSchedules(schedules);
    sendMessage(fromId, 'OK');
    return true;
  }else{
    sendMessage(fromId, 'I didn\'t find any scheduling on '+ stockSign +'...');
    return false;
  }
}

function getNumberDiff(fromId, stockSign, currentValue) {
  if (schedules[fromId] && schedules[fromId][stockSign] && (schedules[fromId][stockSign].numberToDiff!==undefined)){
    var diffNumber = currentValue - schedules[fromId][stockSign].numberToDiff;
    var diffPercentage = diffNumber/schedules[fromId][stockSign].numberToDiff*100;

    return helpers.fill(' _Diff:_') + helpers.numberWithSign(diffNumber) + ' (*' + helpers.numberWithSign(diffPercentage)+ '%*)\n';
  }else{
    return '';
  }
}

function getStocksSignOfUser(fromId){
  var stocks=[];
  if (schedules[fromId]){
    for (var stockSign in schedules[fromId]) {
      if (stockSign!==ALL_STOCKS_SIGN && stockSign!==PREDICTION_SIGN){
        stocks.push(stockSign);
      }
    }
  }
  return stocks;
}

function graphHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  var amountPeriod = match[2];
  amountPeriod = amountPeriod===''?3:parseInt(amountPeriod);
  var timePeriod = match[3]||'d';

  sendMessage(fromId, 'http://chart.finance.yahoo.com/z?s='+stockSign+'&t='+
    amountPeriod+timePeriod+'&q=c&l=on&z=l',{disable_web_page_preview:false});
}

function helpHandler(msg) {
  var fromId = msg.from.id;
  sendMessage(fromId, botDescription, {disable_web_page_preview:false});
}

function allStocksHandler(msg) {
  var fromId = msg.from.id;
  var stocks = getStocksSignOfUser(fromId);

  if (stocks.length>0){
    var allMessagesPromises = stocks.map(function(stockSign) {
      return getStockMessage(fromId, stockSign);
    });
    Q.all(allMessagesPromises).then(function (allMessages) {
      sendMessage(fromId, allMessages.join(''));
    }).catch(function (err) {
      console.log(err);
      sendMessage(fromId, 'I seem to have a problem...');
    });
  }else{
    sendMessage(fromId, 'sorry, you don\'t have any scheduled stocks');
  }
}

function stockOnlyHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];

  sendStockInfo(fromId, stockSign);
}

function diffHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  var numberToDiff = parseFloat(match[2]);

  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign].numberToDiff = numberToDiff;
    helpers.writeSchedules(schedules);
    sendMessage(fromId, 'OK');
    return true;
  }else{
    sendMessage(fromId, 'I didn\'t find any scheduling on '+ stockSign +'...');
    return false;
  }
}

function stockAddHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];

  if (!schedules[fromId]){
    schedules[fromId]={};
  }

  schedules[fromId][stockSign] = new Date();

  helpers.writeSchedules(schedules);
  sendMessage(fromId, stockSign + ' added');
}

function stockRemoveHandler(msg, match){
  var fromId = msg.from.id;
  var stockSign = match[1];

  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign] = undefined;
  }

  helpers.writeSchedules(schedules);
  sendMessage(fromId, stockSign + ' removed');
}

function allStocksTimeHandler(msg, match){
  var fromId = msg.from.id;
  var textTime = match[1];
  var stocks = getStocksSignOfUser(fromId);

  if (stocks.length>0){
    if (textTime && textTime.toUpperCase()==='CANCEL'){
      cancelStockScheduling(fromId, ALL_STOCKS_SIGN);
    }else{
      var sched = later.parse.text(textTime);
      if (!schedules[fromId]){
        schedules[fromId]={};
      }

      var t;
      (function (msg) {
        t = later.setInterval(function(){
          allStocksHandler(msg);
        }, sched);
      })(msg);

      if (schedules[fromId][ALL_STOCKS_SIGN]){
        schedules[fromId][ALL_STOCKS_SIGN].clear();
      }
      schedules[fromId][ALL_STOCKS_SIGN] = t;
      schedules[fromId][ALL_STOCKS_SIGN].textTime = textTime;

      helpers.writeSchedules(schedules);
      sendMessage(fromId, 'OK');
    }
  }else{
    sendMessage(fromId, 'you don\'t have any stocks, you can add some using /stock');
  }
}

function stocksAlreadyAlerted(stock){
  if ((stock.lastAlerted===undefined) ||
    (stock.lastAlerted!==undefined &&
      ((new Date()).toDateString() !== stock.lastAlerted.toDateString()))
    ){
    return true;
  }
  return false;
}

function sendPredictions(fromId, daysOrMonths, timeBack, percentRatio) {
  var stocks = getStocksSignOfUser(fromId).filter(function (stockSign) {
    return stocksAlreadyAlerted(schedules[fromId][stockSign]);
  });
  smartNotifier.getPredictions(stocks, daysOrMonths, timeBack, percentRatio).then(function (predictions) {
    if (predictions!==undefined && predictions.length>0){
      var predictionMessage = predictions.map(function (prediction) {
        if (schedules[fromId][prediction.stockSign]!==undefined){
          schedules[fromId][prediction.stockSign].lastAlerted = new Date();
        }else if (schedules[fromId][prediction.stockSign.toLowerCase()]!==undefined) {
          schedules[fromId][prediction.stockSign.toLowerCase()].lastAlerted = new Date();
        }

        return prediction.message;
      }).join('\n');

      sendMessage(fromId, predictionMessage);
    }
  });
}

function predictionHandler(msg, match) {
  var fromId = msg.from.id;
  var daysOrMonths = match[1];
  var timeBack = match[2];
  var percentRatio = match[3];
  var interval = match[5];
  var timeFrame = match[6];

  var sched = later.parse.text('every ' + interval + ' ' + timeFrame);

  var t;
  (function (fromId, daysOrMonths, timeBack, percentRatio, sched) {
    t = later.setInterval(function(){
      sendPredictions(fromId, daysOrMonths, timeBack, percentRatio);
    }, sched);
  })(fromId, daysOrMonths, timeBack, percentRatio, sched);

  if (schedules[fromId][PREDICTION_SIGN]){
    schedules[fromId][PREDICTION_SIGN].clear();
    schedules[fromId][PREDICTION_SIGN]=null;
  }

  schedules[fromId][PREDICTION_SIGN] = t;
  schedules[fromId][PREDICTION_SIGN].textTime = 'every ' + interval + ' ' + timeFrame;
  schedules[fromId][PREDICTION_SIGN].daysOrMonths = daysOrMonths;
  schedules[fromId][PREDICTION_SIGN].timeBack = timeBack;
  schedules[fromId][PREDICTION_SIGN].percentRatio = percentRatio;

  helpers.writeSchedules(schedules);

  sendPredictions(fromId, daysOrMonths, timeBack, percentRatio);
}

function predictNowHandler(msg){
  var fromId = msg.from.id;
  if(schedules[fromId][PREDICTION_SIGN]){
    var daysOrMonths = schedules[fromId][PREDICTION_SIGN].daysOrMonths;
    var timeBack = schedules[fromId][PREDICTION_SIGN].timeBack;
    var percentRatio = schedules[fromId][PREDICTION_SIGN].percentRatio;

    var stocks = getStocksSignOfUser(fromId);
    smartNotifier.getPredictions(stocks, daysOrMonths, timeBack, percentRatio)
    .then(function (predictions) {
      if (predictions && predictions.length>0){
        var predictionMessage = predictions.map(function (prediction) {
          return prediction.message;
        }).join('\n');
        sendMessage(fromId, predictionMessage);
      }else{
        sendMessage(fromId, 'no predictions found for the specified settings\n');
      }
    });
  }else {
    sendMessage(fromId, 'you have not defined your prediction settings yet');
  }
}

function infoHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  smartNotifier.getPredictionInfo(stockSign).then(function (stockInfo) {
    sendMessage(fromId, stockInfo);
  }).catch(function (err) {
    console.log(err);
    sendMessage(fromId, 'I got a problem when I tried to get the information, sorry...');
  });
}

function sendMessage(id, message, extraOps){
  bot.sendMessage(id, message, Object.assign({},allKeyboardOpts,extraOps));
}

init();
