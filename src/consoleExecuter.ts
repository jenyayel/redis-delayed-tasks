import { Executer, Task } from './models';

export default class ConsoleExecuter implements Executer {
    public execute(task: Task<string>) {
        console.log('Processing message >>', task.payload);
    }
}
