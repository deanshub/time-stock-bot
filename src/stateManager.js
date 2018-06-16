import fs from 'fs-extra';
import CONSTS from './constants';

let state = {};

export function loadState(){
  return fs.readFile(CONSTS.STATE_FILE_NAME)
    .then(schedulesStr=>JSON.parse(schedulesStr))
    .then(loadedState=>state=loadedState);
}

export function saveState() {
  let schedulesNesseccery = {};
  return new Promise(resolve=>{
    // creating schedules file (only nesseccery properties)
    for (let userId in state){
      for (let stockSign in state[userId]){
        if (!schedulesNesseccery[userId]){
          schedulesNesseccery[userId]={};
        }
        if (state[userId][stockSign]){
          const {
            textTime,
            numberToDiff,
            daysOrMonths,
            timeBack,
            percentRatio,
          } = state[userId][stockSign];

          schedulesNesseccery[userId][stockSign] = {
            textTime,
            numberToDiff,
            daysOrMonths,
            timeBack,
            percentRatio,
          };
        }
      }
    }
    return resolve(schedulesNesseccery);
  }).then(schedulesNesseccery=>{
    // console.log(schedulesString);
    return JSON.stringify(schedulesNesseccery, null, 2);
  }).then(schedulesString=>{
    const wStream = fs.createWriteStream(CONSTS.STATE_FILE_NAME);
    wStream.write(schedulesString);
    return wStream.end();
    // return fs.writeFile(CONSTS.STATE_FILE_NAME,schedulesString);
  });
}

export function get(key=''){
  const arr = key.split('.');
  return arr.reduce((res, curKey)=>{
    return res && res[curKey];
  }, state);
}
export function set(key='', value){
  const arr = key.split('.');
  let currObj = state;

  arr.forEach((curKey, index, wholeArr)=>{
    if (index === wholeArr.length-1){
      return currObj[curKey] = value;
    }

    if (!currObj.hasOwnProperty(curKey)){
      currObj[curKey] = {};
    }
    currObj = currObj[curKey];
  });
  return value;
}

export function getStocksSymbolOfUser(userId){
  let stocks=[];
  if (state[userId]){
    for (let stockSymbol in state[userId]) {
      if (stockSymbol!==CONSTS.ALL_STOCKS_SIGN && stockSymbol!==CONSTS.PREDICTION_SIGN && state[userId][stockSymbol]){
        stocks.push(stockSymbol);
      }
    }
  }
  return stocks;
}

export default {
  get,
  set,
  loadState,
  saveState,
  getStocksSymbolOfUser,
};
