import stateManager from '../stateManager';
import botCommander from '../botCommander';
import scheduler from '../scheduler';
import predictor from '../utils/predictor';
import CONSTS from '../constants';

export function predictionByParams(msg, match){
  const fromId = msg.from.id;
  const daysOrMonths = match[1];
  const timeBack = match[2];
  const percentRatio = match[3];
  const interval = match[5];
  const timeFrame = match[6];

  scheduler.cancelPrediction(fromId, false);
  stateManager.set(`${fromId}.${CONSTS.PREDICTION_SIGN}.daysOrMonths`, daysOrMonths);
  stateManager.set(`${fromId}.${CONSTS.PREDICTION_SIGN}.timeBack`, timeBack);
  stateManager.set(`${fromId}.${CONSTS.PREDICTION_SIGN}.percentRatio`, percentRatio);
  return scheduler.addPrediction(fromId, `every ${interval} ${timeFrame}`);
}

export function predictNow(msg, reportBack=true){
  const fromId = msg.from.id;
  const predictionParams = stateManager.get(`${fromId}.${CONSTS.PREDICTION_SIGN}`);
  if(predictionParams){
    const {daysOrMonths, timeBack, percentRatio} = predictionParams;

    var stocks = stateManager.getStocksSymbolOfUser(fromId);
    return predictor.getPredictions(stocks, daysOrMonths, timeBack, percentRatio)
      .then(function (predictions) {
        if (predictions && predictions.length>0){
          var predictionMessage = predictions.map(function (prediction) {
            return prediction.message;
          }).join('\n');
          botCommander.sendMessage(fromId, predictionMessage);
        }else if(reportBack){
          return botCommander.sendMessage(fromId, 'No predictions yet');
        }else{
          return false;
        }
      });
  }else {
    return botCommander.sendMessage(fromId, 'Prediction settings have not been defined yet\nPlease define them by using parameters on /predict or see /help');
  }
}

export default {
  predictionByParams,
  predictNow,
};
