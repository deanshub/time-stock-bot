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
    '/stock <STOCK_SIGN> - current stock values\n'+
    '/stock <STOCK_SIGN> <TIME> - stock values at a certain time\n'+
    '/stock <STOCK_SIGN> cancel - stop stock scheduling\n'+
    '/time <TIME> - send a full stocks report at a certain time\n'+
    '/time cancel - stop automatic message of full stocks report\n'+
    '/graph <STOCK_SIGN> - stock 3 day graph\n'+
    '/get - same as /stock\n'+
    '/unstock <STOCK_SIGN> - same as /stock <STOCK_SIGN> cancel\n'+
    '/diff <STOCK_SIGN> <NUMBER> - scheduled stocks will also show ratio to this number\n'+
    '\nExamples:\n'+
    '/stock fb\n'+
    '/stock fb every day at 10:00\n'+
    '/unstock fb\n'+
    'For more information on <TIME>, see http://bunkat.github.io/later/assets/img/Schedule.png';

function init() {
  helpers.getSchedulesFromFile().then(function (schedulesFromFile) {
    reloadSchedules(schedulesFromFile);
  });

  bot.onText(/\/help/, helpHandler);
  bot.onText(/\/stock ([^ ]+) (.+)$/, stockAndTimeHandler);
  bot.onText(/\/diff ([^ ]+) ([+-]?\d+(\.\d+)?)$/, diffHandler);
  bot.onText(/\/unstock (.+)$/, cancelStockHandler);
  bot.onText(/\/stock ([^ ]+)$/, stockOnlyHandler);
  bot.onText(/\/stock$/, allStocksHandler);
  bot.onText(/\/get ([^ ]+) (.+)$/, stockAndTimeHandler);
  bot.onText(/\/get ([^ ]+)$/, stockOnlyHandler);
  bot.onText(/\/get$/, allStocksHandler);
  bot.onText(/\/time (.+)$/, allStocksTimeHandler);
  bot.onText(/\/graph (.+)$/, graphHandler);
}


function reloadSchedules(fileSchedules) {
  for (var userId in fileSchedules){
    for (var stockSign in fileSchedules[userId]){
      var sched = later.parse.text(fileSchedules[userId][stockSign].textTime);
      var t;
      if (stockSign === '*'){
        t = later.setInterval(function(){
          allStocksHandler({from:{id:userId}});
        }, sched);
      }else{
        t = later.setInterval(function(){
          sendStockInfo(userId, stockSign);
        }, sched);
      }
      schedules[userId][stockSign] = t;
      schedules[userId][stockSign].textTime = fileSchedules[userId][stockSign].textTime;
      schedules[userId][stockSign].numberToDiff = fileSchedules[userId][stockSign].numberToDiff;
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
    bot.sendMessage(fromId, message);
  });
}

function cancelStockScheduling(fromId, stockSign){
  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign].clear();
    schedules[fromId][stockSign]=null;
    bot.sendMessage(fromId, 'OK');
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

    return 'Diff: ' + sign + Math.abs(diffNumber.toFixed(2)) + ' (' + diffPercentage.toFixed(2) + '%)\n';
  }else{
    return '';
  }
}

function getStocksSignOfUser(fromId){
  var stocks=[];
  if (schedules[fromId]){
    for (var stockSign in schedules[fromId]) {
      stocks.push(stockSign);
    }
  }
  return stocks;
}

function graphHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];

  bot.sendMessage(fromId, 'http://chart.finance.yahoo.com/z?s='+stockSign+'&t=3d&q=c&l=on&z=l');
}

// function helpHandler(msg, match) {
function helpHandler(msg) {
  var fromId = msg.from.id;
  bot.sendMessage(fromId, botDescription);
}

function allStocksHandler(msg) {
  var fromId = msg.from.id;
  var stocks = getStocksSignOfUser(fromId);

  if (stocks.length>0){
    var allMessagesPromises = stocks.map(function(stockSign) {
      return getStockMessage(fromId, stockSign);
    });
    Q.all(allMessagesPromises).then(function (allMessages) {
      bot.sendMessage(fromId, allMessages.join(''));
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

function cancelStockHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];

  cancelStockScheduling(fromId, stockSign);
}

function diffHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  var numberToDiff = parseFloat(match[2]);

  if (schedules[fromId] && schedules[fromId][stockSign]){
    schedules[fromId][stockSign].numberToDiff = numberToDiff;
    bot.sendMessage(fromId, 'OK');
    return true;
  }else{
    bot.sendMessage(fromId, 'I didn\'t find any scheduling on '+ stockSign +'...');
    return false;
  }
}

function stockAndTimeHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  var textTime = match[2];

  if (textTime && textTime.toUpperCase()==='CANCEL'){
    cancelStockScheduling(fromId, stockSign);
  }else{
    // helpers.addSchedule(textTime, fromId, stockSign, fn ,schedules);
    var sched = later.parse.text(textTime);

    if (!schedules[fromId]){
      schedules[fromId]={};
    }

    var t = later.setInterval(function(){
      sendStockInfo(fromId, stockSign);
    }, sched);

    if (schedules[fromId][stockSign]){
      schedules[fromId][stockSign].clear();
    }
    schedules[fromId][stockSign] = t;
    schedules[fromId][stockSign].textTime = textTime;

    helpers.writeSchedules(schedules);
    bot.sendMessage(fromId, 'OK');
  }
}

function allStocksTimeHandler(msg, match){
  var allStocksSign = '*';
  var fromId = msg.from.id;
  var textTime = match[1];
  var stocks = getStocksSignOfUser(fromId);

  if (stocks.length>0){
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
    bot.sendMessage(fromId, 'OK');
  }else{
    bot.sendMessage(fromId, 'you don\'t have any stocks, you can add some using /stock');
  }
}

init();
