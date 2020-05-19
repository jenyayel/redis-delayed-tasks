import * as IORedis from 'ioredis';
import * as uuid from 'uuid';
import { Task, Executer } from './models';

const FUTURE_TASKS_KEY = 'delayed';
const IMMEDIATE_TASKS_KEY = 'immediate';
const PROCESSING_TASKS_KEY = 'processing';

const sleep = async (time: number = 1000) => new Promise((r) => setTimeout(() => r(), time));
const epoch = () => Math.round(new Date().getTime() / 1000);

export default class DelayedTasks {
    private readonly client: IORedis.Redis;
    private isStopping = false;

    constructor(
        private readonly executer: Executer,
        port = process.env.REDIS_PORT,
        host = process.env.REDIS_HOST) {

        this.client = new IORedis(parseInt(port || '6379', 10), host);
        console.log('Redis connected');

        setTimeout(() => this.nextScheduled(), 0);
        setTimeout(() => this.nextTask(), 0);
    }

    public async add(delay: number, message: string): Promise<Task> {
        const now = epoch();
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

    public close() {
        if (this.isStopping) {
            return;
        }

        this.isStopping = true;
        // TODO: better handling of cancellation (e.g. await all operation completion and then disconnect)
        this.client.disconnect();
    }

    private async nextScheduled() {
        if (this.isStopping) {
            return;
        }

        try {
            const tasks = await this.client.zrangebyscore(FUTURE_TASKS_KEY, 0, epoch());
            if (!tasks?.length) {
                // backoff if no messages in queue
                await sleep();
            } else {
                await this.client
                    .multi()
                    .rpush(IMMEDIATE_TASKS_KEY, tasks[0])
                    .zrem(FUTURE_TASKS_KEY, tasks[0])
                    .exec();
            }
        } catch (error) {
            console.error('There was an error processing scheduled task', error);
        } finally {
            setTimeout(() => this.nextScheduled(), 0);
        }

    }

    private async nextTask() {
        if (this.isStopping) {
            return;
        }

        try {
            const msg = await this.client.rpoplpush(IMMEDIATE_TASKS_KEY, PROCESSING_TASKS_KEY);
            if (!msg) {
                // backoff if no messages in queue
                await sleep();
            } else {
                await this.executer.execute(JSON.parse(msg));
                // TODO: there should be an additional worker to watch stack tasks in PROCESSING_TASKS_KEY
                await this.client.lrem(PROCESSING_TASKS_KEY, 1, msg);
            }
        } catch (error) {
            console.error('There was an error processing a message', error);
        } finally {
            setTimeout(() => this.nextTask(), 0);
        }
    }
}
