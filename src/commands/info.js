import botCommander from '../botCommander';
import dataFetcher from '../utils/dataFetcher';

export default function(msg, match){
  const fromId = msg.from.id;
  const stockSign = match[1];

  const uppercaseStockSign = stockSign.toUpperCase();
  return dataFetcher.getCurrentData([uppercaseStockSign]).then(function (stockVals) {
    let messageBody = `_${uppercaseStockSign}:_\n`;
    for(var prop in stockVals[uppercaseStockSign]){
      if (stockVals[uppercaseStockSign][prop]!==null && stockVals[uppercaseStockSign][prop]!==undefined){
        messageBody+= prop + ': ' + stockVals[uppercaseStockSign][prop] + '\n';
      }
    }
    return botCommander.sendMessage(fromId, messageBody);
  });
}
