import stateManager from '../stateManager';
import botCommander from '../botCommander';

export default function removeStockHandler(msg, match) {
  const fromId = msg.from.id;
  const stockSymbol = match[1];
  const key = `${fromId}.${stockSymbol}`;

  stateManager.set(key, undefined);
  stateManager.saveState();
  return botCommander.sendMessage(fromId, `${stockSymbol} removed`);
}
