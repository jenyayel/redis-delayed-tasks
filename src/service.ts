import * as IORedis from 'ioredis';
import * as uuid from 'uuid';
import { Task } from './models';

const FUTURE_TASKS_KEY = 'delayed';
const IMMEDIATE_TASKS_KEY = 'immediate';

export default class DelayedTasks {
    private readonly client: IORedis.Redis;

    constructor(port = process.env.REDIS_PORT, host = process.env.REDIS_HOST) {
        // tslint:disable-next-line: radix
        this.client = new IORedis(parseInt(port || '6379'), host);
        console.log('Redis connected');
    }

    public async add(delay: number, message: string): Promise<Task> {
        const now = Math.round(new Date().getTime() / 1000);
        const task = {
            id: uuid.v4(),
            scheduledOnEpoch: now,
            executeOnEpoch: now + delay,
            payload: message
        };
        if (delay === 0) {
            await this.client.publish(IMMEDIATE_TASKS_KEY, JSON.stringify(task));
            console.log('Stored task for immediate execution', task);
        } else {
            await this.client.zadd(FUTURE_TASKS_KEY, task.executeOnEpoch, JSON.stringify(task));
            console.log('Stored task for future execution', task);
        }
        return task;
    }

    public get(): Promise<Task[]> {
        return this.client
            .zscan(FUTURE_TASKS_KEY, 0)
            .then((r) => r[1]
                .filter((_, index) => index % 2 === 0)
                .map((t) => JSON.parse(t))
            );
    }
}
