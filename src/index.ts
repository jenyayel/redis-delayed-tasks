import { startApiServer } from './api';
import DelayedTasks from './service';
import ConsoleExecuter from './consoleExecuter';
import * as  process from 'process';

console.log('Starting...');
const service = new DelayedTasks(new ConsoleExecuter());
startApiServer(service);

const unhandledError = (err: Error) => console.error('Unhandled error', err);
process.on('uncaughtException', unhandledError);
process.on('unhandledRejection', unhandledError);
