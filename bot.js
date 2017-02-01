//TimeStockBot
var TelegramBot = require('node-telegram-bot-api');
var later = require('later');
var Q = require('q');

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

var botDescription='Hi, I\'m TimeStockBot\n'+
    'This is what I can do:\n'+
    '/stock - get full report on all added stocks\n'+
    '/stock <STOCK_SIGN> - current stock values\n'+
    '/get - alias for /stock\n'+
    '/add <STOCK_SIGN> - add stock to full stocks report\n'+
    '/remove <STOCK_SIGN> - remove stock from full stocks report\n'+
    '/time <TIME> - send a full stocks report at a certain time\n'+
    '/time cancel - stop automatic message of full stocks report\n'+
    '/graph <STOCK_SIGN> - stock 3 day graph\n'+
    '/graph <STOCK_SIGN> <PERIOD_AMOUNT><PERIDO_SIGN> - stock graph by time period\n'+
    '                  PERIOD_AMOUNT = number  PERIDO_SIGN = d|m|y\n'+
    '/diff <STOCK_SIGN> <NUMBER> - added stocks will also show ratio to this number\n'+
    '/predict <DAYS_OR_MONTHS> <TIME_BACK> <PERCENT> <INTERVAL> <TIME_FRAME> - shows prediction when to buy the stock,\n'+
    '         DAYS_OR_MONTHS = 1|0 TIME_BACK=number PERCENT=float INTERVAL=number TIME_FRAME=m|h|D\n'+
    '/predict - if the previous defined then sends prediction immidiatly\n'+
    '/help - to get this message\n'+
    '\nExamples:\n'+
    '/stock fb\n'+
    '/add fb\n'+
    '/add aapl\n'+
    '/graph wix 1y\n'+
    '/time at 10:00\n'+
    '/predict 1 7 5 1 h\n'+
    'For more information on <TIME>, see http://bunkat.github.io/later/assets/img/Schedule.png';

var allKeyboardOpts ={
  reply_markup:JSON.stringify({
    keyboard:[
      ['/get'],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  }),
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

        (function (userId, daysOrMonths, timeBack, percentRatio) {
          t = later.setInterval(function(){
            sendPredictions(userId, daysOrMonths, timeBack, percentRatio);
          }, sched);
        })(userId, daysOrMonths, timeBack, percentRatio);

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
  return helpers.getStockBySign(stockSign).then(function (stock) {
    var message = helpers.stockToMessage(stock);
    var stockValues = stock.query.results.row;
    message+=getNumberDiff(fromId, stockSign, parseFloat(stockValues.low));
    return message;
  }).catch(function (err) {
    console.log(err);
    return 'sorry, I failed to get you ' + stockSign + '\n';
  });
}

function sendStockInfo(fromId, stockSign){
  getStockMessage(fromId, stockSign).then(function (message) {
    bot.sendMessage(fromId, message, allKeyboardOpts);
  });
}

function cancelStockScheduling(fromId, stockSign){
  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign].clear();
    schedules[fromId][stockSign]=null;
    helpers.writeSchedules(schedules);
    bot.sendMessage(fromId, 'OK', allKeyboardOpts);
    return true;
  }else{
    bot.sendMessage(fromId, 'I didn\'t find any scheduling on '+ stockSign +'...');
    return false;
  }
}

function getNumberDiff(fromId, stockSign, currentValue) {
  if (schedules[fromId] && schedules[fromId][stockSign] && (schedules[fromId][stockSign].numberToDiff!==undefined)){
    var diffNumber = currentValue - schedules[fromId][stockSign].numberToDiff;
    var diffPercentage = diffNumber/schedules[fromId][stockSign].numberToDiff*100;
    var sign = (diffNumber<0)?'-':'+';

    return helpers.fill(' Diff:') + sign + Math.abs(diffNumber.toFixed(2)) + ' (' + diffPercentage.toFixed(2) + '%)\n';
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

  bot.sendMessage(fromId, 'http://chart.finance.yahoo.com/z?s='+stockSign+'&t='+
    amountPeriod+timePeriod+'&q=c&l=on&z=l', allKeyboardOpts);
}

function helpHandler(msg) {
  var fromId = msg.from.id;
  bot.sendMessage(fromId, botDescription, allKeyboardOpts);
}

function allStocksHandler(msg) {
  var fromId = msg.from.id;
  var stocks = getStocksSignOfUser(fromId);

  if (stocks.length>0){
    var allMessagesPromises = stocks.map(function(stockSign) {
      return getStockMessage(fromId, stockSign);
    });
    Q.all(allMessagesPromises).then(function (allMessages) {
      bot.sendMessage(fromId, allMessages.join(''), allKeyboardOpts);
    }).catch(function (err) {
      console.log(err);
      bot.sendMessage(fromId, 'I seem to have a problem...');
    });
  }else{
    bot.sendMessage(fromId, 'sorry, you don\'t have any scheduled stocks');
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
    bot.sendMessage(fromId, 'OK', allKeyboardOpts);
    return true;
  }else{
    bot.sendMessage(fromId, 'I didn\'t find any scheduling on '+ stockSign +'...');
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
  bot.sendMessage(fromId, stockSign + ' added', allKeyboardOpts);
}

function stockRemoveHandler(msg, match){
  var fromId = msg.from.id;
  var stockSign = match[1];

  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign] = undefined;
  }

  helpers.writeSchedules(schedules);
  bot.sendMessage(fromId, stockSign + ' removed', allKeyboardOpts);
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
      bot.sendMessage(fromId, 'OK', allKeyboardOpts);
    }
  }else{
    bot.sendMessage(fromId, 'you don\'t have any stocks, you can add some using /stock');
  }
}

function sendPredictions(fromId, daysOrMonths, timeBack, percentRatio) {
  var stocks = getStocksSignOfUser(fromId);
  smartNotifier.getPredictions(stocks, daysOrMonths, timeBack, percentRatio).then(function (predictions) {
    if (predictions && predictions.length>0){
      bot.sendMessage(fromId, predictions.join('\n'));
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
  (function (fromId, daysOrMonths, timeBack, percentRatio) {
    t = later.setInterval(function(){
      sendPredictions(fromId, daysOrMonths, timeBack, percentRatio);
    }, sched);
  })(fromId, daysOrMonths, timeBack, percentRatio);

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
    smartNotifier.getPredictions(stocks, daysOrMonths, timeBack, percentRatio).then(function (predictions) {
      if (predictions && predictions.length>0){
        bot.sendMessage(fromId, predictions.join('\n'));
      }else{
        bot.sendMessage(fromId, 'no predictions found for the specified settings\n');
      }
    });
  }else {
    bot.sendMessage(fromId, 'you have not defined your prediction settings yet');
  }
}

init();
