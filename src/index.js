import commandsConfig from './commands/commandsConfiguration';
import botCommander from './botCommander';
import stateManager from './stateManager';
import scheduler from './scheduler';

commandsConfig
  .filter(command=>!command.disabled)
  .forEach(command=>{
    botCommander.addCommand(command, require(`./commands/${command.name}`)[command.fn||'default']);
  });

stateManager.loadState().then(loadedState=>{
  return scheduler.reschedule(loadedState);
}).catch(err=>{
  console.error('Can\'t load schedules from file');
  console.error(err);
});
