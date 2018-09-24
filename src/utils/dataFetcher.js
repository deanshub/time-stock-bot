import {runPromises, retryPromise} from './promises'

const API_NAMES = [
  'alphavantage',
  'yahoo2',
  // 'yahoo1',
  // 'google',
];

const APIS = API_NAMES.map(name=>{
  return require(`./dataapis/${name}.js`);
});

export async function getCurrentData(stocks=[]){
  return runPromises(stocks.map((stock)=>{
    return ()=>getCurrentSingleStockData(stock);
  }), 2).then((stocksData)=>{
    console.log({stocksData});
    return stocksData.reduce((res,curr, index)=>{
      res[stocks[index]] = curr;
      return res;
    },{});
  });
}


export async function getCurrentSingleStockData(stock) {
  let fallbackApis = [...APIS];
  while (fallbackApis.length>0){
    if (fallbackApis[0].getCurrentSingleStockData){
      try{
        const currentData = await retryPromise(fallbackApis[0].getCurrentSingleStockData, [stock], 2)
        return currentData
      }catch(e){
        console.error(e);
        console.log('failed getting current data');
      }
    }
    fallbackApis.shift()
  }
  return Promise.reject('failed getting current data')
}

export async function getHistoricData(stocks=[], startDate, endDate){
  let fallbackApis = [...APIS];
  while (fallbackApis.length>0){
    if (fallbackApis[0].getHistoricData){
      try{
        const currentData = await fallbackApis[0].getHistoricData(stocks, startDate, endDate)
        return currentData
      }catch(e){
        console.log('failed getting historical data');
      }
    }
    fallbackApis.shift()
  }
  return Promise.reject('failed getting historical data')
}

export default {
  getCurrentData,
  getHistoricData,
};
