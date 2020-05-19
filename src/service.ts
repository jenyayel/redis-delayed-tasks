import * as IORedis from 'ioredis';
import * as uuid from 'uuid';
import { Task, Executer } from './models';

const FUTURE_TASKS_KEY = 'delayed';
const IMMEDIATE_TASKS_KEY = 'immediate';
const PROCESSING_TASKS_KEY = 'processing';
export const sleep = async (time: number = 1000) => new Promise((r) => setTimeout(() => r(), time));

export default class DelayedTasks {
    private readonly client: IORedis.Redis;

    constructor(port = process.env.REDIS_PORT, host = process.env.REDIS_HOST) {
        this.client = new IORedis(parseInt(port || '6379', 10), host);
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
            // storing task for immediate execution
            await this.client.rpush(IMMEDIATE_TASKS_KEY, JSON.stringify(task));
        } else {
            // stored task for future execution
            await this.client.zadd(FUTURE_TASKS_KEY, task.executeOnEpoch, JSON.stringify(task));
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

    public registerExecuter(executer: Executer) {
        setTimeout(() => this.executeNextTask(executer), 0);
    }

    private async executeNextTask(executer: Executer) {
        try {
            const msg = await this.client.rpoplpush(IMMEDIATE_TASKS_KEY, PROCESSING_TASKS_KEY);
            if (!msg) {
                // backoff if no messages in queue
                await sleep(1000);
            } else {
                await executer.execute(JSON.parse(msg));
                await this.client.lrem(PROCESSING_TASKS_KEY, 1, msg);
            }
        } catch (error) {
            console.error('There was an error processing a message', error);
        } finally {
            setTimeout(() => this.executeNextTask(executer), 0);
        }
    }
}
