import stateManager from '../stateManager';
import botCommander from '../botCommander';

export default function diffHandler(msg, match) {
  var fromId = msg.from.id;
  var stockSign = match[1];
  var numberToDiff = parseFloat(match[2]);
  const key = `${fromId}.${stockSign}`;

  if (stateManager.get(key)){
    stateManager.set(`${key}.numberToDiff`, numberToDiff);
    stateManager.saveState();

    botCommander.runCommand('get', msg, ['', stockSign], 'singleStock');
    return true;
  }else{
    botCommander.sendMessage(fromId, `I didn't find any scheduling on ${stockSign}
Try adding it by using the /add ${stockSign}`);
    return false;
  }
}
