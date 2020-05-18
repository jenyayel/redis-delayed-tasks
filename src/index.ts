import { startApiServer } from './api';
import DelayedTasks from './service';

console.log('Starting...');
const service = new DelayedTasks();
startApiServer(service);

