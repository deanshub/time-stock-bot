//TimeStockBot
var TelegramBot = require('node-telegram-bot-api');
var later = require('later');
var Q = require('q');

var helpers = require('./helpers');

var token = process.env.BOT_API;
var options = {
  webHook: {
    port: 8443,
    key: __dirname+'/key.pem',
    cert: __dirname+'/crt.pem',
  },
//   polling: true,
};

var bot = new TelegramBot(token, options);
bot.setWebHook('stock.shubapp.com:443/bot'+token,__dirname+'/crt.pem');
var schedules={};


var botDescription='Hi, I\'m TimeStockBot\n'+
    'This is what I can do:\n'+
    '/help to get this message\n'+
    '/stock - get full report on all added stocks\n'+
    '/stock <STOCK_SIGN> - current stock values\n'+
    '/time <TIME> - send a full stocks report at a certain time\n'+
    '/time cancel - stop automatic message of full stocks report\n'+
    '/graph <STOCK_SIGN> - stock 3 day graph\n'+
    '/get - same as /stock\n'+
    '/diff <STOCK_SIGN> <NUMBER> - scheduled stocks will also show ratio to this number\n'+
    '\nExamples:\n'+
    '/stock fb\n'+
    '/add fb\n'+
    '/add aapl\n'+
    '/time at 10:00\n'+
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
  bot.onText(/\/graph (.+)$/, graphHandler);
}


function reloadSchedules(fileSchedules) {
  for (var userId in fileSchedules){
    for (var stockSign in fileSchedules[userId]){
      var t;
      if (stockSign === '*'){
        var sched = later.parse.text(fileSchedules[userId][stockSign].textTime);
        t = later.setInterval(function(){
          allStocksHandler({from:{id:userId}});
        }, sched);

        if (!schedules[userId]){
          schedules[userId] = {};
        }

        schedules[userId][stockSign] = t;
        schedules[userId][stockSign].textTime = fileSchedules[userId][stockSign].textTime;
        schedules[userId][stockSign].numberToDiff = fileSchedules[userId][stockSign].numberToDiff;
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
    message+=getNumberDiff(fromId, stockSign, parseFloat(stock.l));
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

    return 'Diff:                  ' + sign + Math.abs(diffNumber.toFixed(2)) + ' (' + diffPercentage.toFixed(2) + '%)\n';
  }else{
    return '';
  }
}

function getStocksSignOfUser(fromId){
  var stocks=[];
  if (schedules[fromId]){
    for (var stockSign in schedules[fromId]) {
      if (stockSign!=='*'){
        stocks.push(stockSign);
      }
    }
  }
  return stocks;
}

function graphHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];

  bot.sendMessage(fromId, 'http://chart.finance.yahoo.com/z?s='+stockSign+'&t=3d&q=c&l=on&z=l', allKeyboardOpts);
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
  var allStocksSign = '*';
  var fromId = msg.from.id;
  var textTime = match[1];
  var stocks = getStocksSignOfUser(fromId);

  if (stocks.length>0){
    if (textTime && textTime.toUpperCase()==='CANCEL'){
      cancelStockScheduling(fromId, '*');
    }else{
      var sched = later.parse.text(textTime);
      if (!schedules[fromId]){
        schedules[fromId]={};
      }
      var t = later.setInterval(function(){
        allStocksHandler(msg);
      }, sched);

      if (schedules[fromId][allStocksSign]){
        schedules[fromId][allStocksSign].clear();
      }
      schedules[fromId][allStocksSign] = t;
      schedules[fromId][allStocksSign].textTime = textTime;

      helpers.writeSchedules(schedules);
      bot.sendMessage(fromId, 'OK', allKeyboardOpts);
    }
  }else{
    bot.sendMessage(fromId, 'you don\'t have any stocks, you can add some using /stock');
  }
}

init();
