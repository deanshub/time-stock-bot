import stateManager from '../stateManager';
import botCommander from '../botCommander';
import scheduler from '../scheduler';

export default function timeFullReport(msg, match){
  var fromId = msg.from.id;
  var textTime = match[1];
  var stocks = stateManager.getStocksSymbolOfUser(fromId);

  if (stocks.length>0){
    if (textTime && textTime.toUpperCase()==='CANCEL'){
      return scheduler.cancelScheduling(fromId, true);
    }else{
      return scheduler.addScheduling(fromId, textTime);
    }
  }else{
    return botCommander.sendMessage(fromId, `You don't have any stocks\nTry /add <STOCK_SYMBOL> and the schedule a time`);
  }
}
