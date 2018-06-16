import stateManager from '../stateManager';
import botCommander from '../botCommander';

export default function addStockHandler(msg, match) {
  const fromId = msg.from.id;
  const stockSymbol = match[1];
  const key = `${fromId}.${stockSymbol}`;

  stateManager.set(key, new Date());
  stateManager.saveState();
  return botCommander.runCommand('get', msg, ['', stockSymbol], 'singleStock');
}
