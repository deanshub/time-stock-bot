//TimeStockBot
var TelegramBot = require('node-telegram-bot-api');
var later = require('later');
var request = require('request');

var token = process.env.BOT_API;
var options = {
  webHook: {
    port: 8443,
    key: __dirname+'/key.pem',
    cert: __dirname+'/crt.pem'
  },
//   polling: true,
};

var bot = new TelegramBot(token, options);
bot.setWebHook('stock.shubapp.com:443/bot'+token,__dirname+'/crt.pem');

var schedules={};

var botDescription="Hi, I\'m TimeStockBot\n"+
    "This is what I can do:\n"+
    "/help to get this message\n"+
    "/stock <STOCK_SIGN> - current stock values\n"+
    "/get <STOCK_SIGN> - same as /stock <STOCK_SIGN>\n"+
    "/stock <STOCK_SIGN> <TIME> - stock values at a certain time\n"+
    "/graph <STOCK_SIGN> - stock 3 day graph\n"+
    "/stock <STOCK_SIGN> cancel - stop stock scheduling\n"+
    "/unstock <STOCK_SIGN> - same as /stock <STOCK_SIGN> cancel\n"+
    "/diff <STOCK_SIGN> <NUMBER> - scheduled stocks will also show ratio to this number\n"+
    "\nExamples:\n"+
    "/stock fb\n"+
    "/stock fb every day at 10:00\n"+
    "/unstock fb\n"+
    "For more information on <TIME>, see http://bunkat.github.io/later/assets/img/Schedule.png";

bot.onText(/\/help/, helpHandler);
bot.onText(/\/stock ([^ ]+) (.+)$/, stockAndTimeHandler);
bot.onText(/\/diff ([^ ]+) ([+-]?\d+(\.\d+)?)$/, diffHandler);
bot.onText(/\/unstock (.+)$/, cancelStockHandler);
bot.onText(/\/stock (.+)$/, stockOnlyHandler);
bot.onText(/\/get ([^ ]+) (.+)$/, stockAndTimeHandler);
bot.onText(/\/get (.+)$/, stockOnlyHandler);
bot.onText(/\/graph (.+)$/, graphHandler);

function sendStockInfo(fromId, stockSign){
  request('http://finance.google.com/finance/info?client=ig&q='+stockSign, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      try{
        var stockVal = JSON.parse(body.substring(3))[0];
        var messageBody = stockVal.t + "\n" +
            // (stockVal.e)? " from \n"+stockVal.e:"\n"+
            stockVal.lt+"\n"+
            "Value:"+stockVal.l+"\n"+
            "Day Change: "+stockVal.c+" ("+stockVal.cp+"%)" +
            getNumberDiff(fromId, stockSign, parseFloat(stockVal.l));

        bot.sendMessage(fromId, messageBody);
      }catch(e){}
    }
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

    return "\nDiff Change "+diffNumber.toFixed(2)+" ("+diffPercentage.toFixed(2)+"%)";
  }else{
    return '';
  }
}

function graphHandler(msg, match) {
    var fromId = msg.from.id;
    var stockSign = match[1];

    bot.sendMessage(fromId, 'http://chart.finance.yahoo.com/z?s='+stockSign+'&t=3d&q=c&l=on&z=l');
}

function helpHandler(msg, match) {
    var fromId = msg.from.id;
    bot.sendMessage(fromId, botDescription);
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

  if (textTime && textTime.toUpperCase()==="CANCEL"){
      cancelStockScheduling(fromId, stockSign);
  }else{
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

      bot.sendMessage(fromId, 'OK');
  }
}
// // Any kind of message
// bot.on('message', function (msg) {
//   var chatId = msg.chat.id;
//   // photo can be: a file path, a stream or a Telegram file_id
//   var photo = 'cats.png';
//   bot.sendPhoto(chatId, photo, {caption: 'Lovely kittens'});
// });
