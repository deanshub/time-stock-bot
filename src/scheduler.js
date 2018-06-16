import later from 'later';
import CONSTS from './constants';
import stateManager from './stateManager';
import botCommander from './botCommander';

export function reschedule(fileSchedules) {
  for (let userId in fileSchedules){
    for (let stockSign in fileSchedules[userId]){
      const key = `${userId}.${stockSign}`;
      let t;
      let sched;
      if (stockSign === CONSTS.ALL_STOCKS_SIGN ){
        sched = later.parse.text(fileSchedules[userId][stockSign].textTime);

        (function (userId) {
          t = later.setInterval(function(){
            botCommander.runCommand('get', {from:{id:userId}}, undefined, 'allStocks');
          }, sched);
        })(userId);

        const {textTime, numberToDiff} = fileSchedules[userId][stockSign];
        stateManager.set(key, t);
        stateManager.set(`${key}.textTime`, textTime);
        stateManager.set(`${key}.numberToDiff`, numberToDiff);
      }else if (stockSign === CONSTS.PREDICTION_SIGN ){
        const {
          textTime,
          daysOrMonths,
          timeBack,
          percentRatio,
        } = fileSchedules[userId][stockSign];

        sched = later.parse.text(textTime);

        (function (userId, daysOrMonths, timeBack, percentRatio, sched) {
          t = later.setInterval(function(){
            botCommander.runCommand('predict', {from:{id:userId}}, false, 'predictNow');
          }, sched);
        })(userId, daysOrMonths, timeBack, percentRatio, sched);

        stateManager.set(key, t);
        stateManager.set(`${key}.textTime`, textTime);
        stateManager.set(`${key}.daysOrMonths`, daysOrMonths);
        stateManager.set(`${key}.timeBack`, timeBack);
        stateManager.set(`${key}.percentRatio`, percentRatio);
      }else{
        stateManager.set(key, fileSchedules[userId][stockSign]);
      }
    }
  }
}

function cancelByKey(fromId, seconderyKey){
  const key = `${fromId}.${seconderyKey}`;
  const userScheduling = stateManager.get(key);
  if (userScheduling){
    if (typeof userScheduling.clear === 'function'){
      userScheduling.clear();
    }
    stateManager.set(key, null);
    stateManager.saveState();
    return true;
  }else{
    return false;
  }
}

export function cancelScheduling(fromId, reportBack=true){
  const canceled = cancelByKey(fromId, CONSTS.ALL_STOCKS_SIGN);
  if (canceled && reportBack){
    return botCommander.sendMessage(fromId, 'Scheduling canceled');
  }else if (!canceled && reportBack) {
    return botCommander.sendMessage(fromId, 'No scheduling exists');
  }else{
    return canceled;
  }
}

export function cancelPrediction(fromId, reportBack=true){
  const canceled = cancelByKey(fromId, CONSTS.PREDICTION_SIGN);
  if (canceled && reportBack){
    return botCommander.sendMessage(fromId, 'Prediction scheduling canceled');
  }else if (!canceled && reportBack) {
    return botCommander.sendMessage(fromId, 'No scheduling exists');
  }else{
    return canceled;
  }
}

function addByKey(fromId, textTime, seconderyKey){
  cancelByKey(fromId, seconderyKey);
  const sched = later.parse.text(textTime);

  let t;
  if (seconderyKey===CONSTS.ALL_STOCKS_SIGN){
    t = later.setInterval(function(){
      botCommander.runCommand('get', {from:{id:fromId}}, undefined, 'allStocks');
    }, sched);
  }else if (CONSTS.PREDICTION_SIGN) {
    t = later.setInterval(function(){
      botCommander.runCommand('predict', {from:{id:fromId}}, false, 'predictNow');
    }, sched);
  }else{
    console.error(`Can't add scheduling for "${seconderyKey}"`);
    return false;
  }

  stateManager.set(`${fromId}.${seconderyKey}`, t);
  stateManager.set(`${fromId}.${seconderyKey}.textTime`, textTime);
  stateManager.saveState();

  return true;
}

export function addScheduling(fromId, textTime){
  if (addByKey(fromId, textTime, CONSTS.ALL_STOCKS_SIGN)){
    return botCommander.sendMessage(fromId, `Stocks report set for "${textTime}"`);
  }else{
    return botCommander.sendMessage(fromId, `Can't set stocks report for "${textTime}"`);
  }
}

export function addPrediction(fromId, textTime){
  if (addByKey(fromId, textTime, CONSTS.PREDICTION_SIGN)){
    return botCommander.sendMessage(fromId, `Prediction scheduling set for "${textTime}"`);
  }else{
    return botCommander.sendMessage(fromId, `Can't set prediction scheduling for "${textTime}"`);
  }
}

export default {
  reschedule,
  cancelScheduling,
  addScheduling,
  cancelPrediction,
  addPrediction,
};
