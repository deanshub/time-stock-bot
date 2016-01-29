//TimeStockBot
var TelegramBot = require('node-telegram-bot-api');
var later = require('later');

var token = process.env.BOT_API;
var options = {
  webHook: {
    port: 443,
    key: __dirname+'/key.pem',
    cert: __dirname+'/crt.pem'
  },
//   polling: true,
};

var bot = new TelegramBot(token, options);

var schedules={};

var botDescription="Hi, I\'m TimeStockBot\n"+
    "This is what I can do:\n"+
    "/help to get this message\n"+
    "/stock <STOCK_SIGN>         - get current stock values\n"+
    "/graph <STOCK_SIGN>         - get stock 3 day graph\n"+
    "/sched <STOCK_SIGN> <TIME>  - get stock values at a certain time\n"+
    "\nExamples:\n"+
    "/sched fb every day at 10:00\n"+
    "For timing text available see http://bunkat.github.io/later/assets/img/Schedule.png";

bot.onText(/\/help/, function (msg, match) {
    var fromId = msg.from.id;
    bot.sendMessage(fromId, botDescription);
});

bot.onText(/\/sched ([^ ]+) (.+)$/, function (msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  var textTime = match[2];

  if (textTime && textTime.toUpperCase()==="CANCEL"){
      if (schedules[fromId] && schedules[fromId][stockSign]){
          schedules[fromId][stockSign].clear();
          schedules[fromId][stockSign]=null;
          bot.sendMessage(fromId, 'OK');
      }else{
        bot.sendMessage(fromId, 'I didn\'t find any event on '+ stockSign +'...');
      }
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
});

function sendStockInfo(fromId, stockSign){
    bot.sendMessage(fromId, 'http://finance.google.com/finance/info?client=ig&q='+stockSign);
}

bot.onText(/\/stock (.+)$/, function (msg, match) {
    var fromId = msg.from.id;
    var stockSign = match[1];

    sendStockInfo(fromId, stockSign);
});

bot.onText(/\/graph (.+)$/, function (msg, match) {
    var fromId = msg.from.id;
    var stockSign = match[1];

    bot.sendMessage(fromId, 'http://chart.finance.yahoo.com/z?s='+stockSign+'&t=3d&q=c&l=on&z=l');
});

// // Any kind of message
// bot.on('message', function (msg) {
//   var chatId = msg.chat.id;
//   // photo can be: a file path, a stream or a Telegram file_id
//   var photo = 'cats.png';
//   bot.sendPhoto(chatId, photo, {caption: 'Lovely kittens'});
// });
