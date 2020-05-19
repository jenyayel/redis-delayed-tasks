import { startApiServer } from './api';
import DelayedTasks from './service';
import ConsoleExecuter from './consoleExecuter';

console.log('Starting...');
const service = new DelayedTasks();
startApiServer(service);
service.registerExecuter(new ConsoleExecuter());
