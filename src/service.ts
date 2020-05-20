import * as IORedis from 'ioredis';
import * as uuid from 'uuid';
import { Task, Executer } from './models';

const FUTURE_TASKS_KEY = 'delayed';
const IMMEDIATE_TASKS_KEY = 'immediate';
const PROCESSING_TASKS_KEY = 'processing';

const sleep = (time = 1000) => new Promise((r) => setTimeout(() => r(), time));
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

    /**
     * Adds a new task for future execution.
     * @param delay Amount of seconds to delay the execution.
     * @param message The payload of the task.
     */
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
            // storing task for future execution
            await this.client.zadd(FUTURE_TASKS_KEY, task.executeOnEpoch, JSON.stringify(task));
        }
        return task;
    }

    /**
     * Gets all tasks that pending execution.
     */
    public get(): Promise<Task[]> {
        return this.client
            .zscan(FUTURE_TASKS_KEY, 0)
            .then((r) => r[1]
                .filter((_, index) => index % 2 === 0)
                .map((t) => JSON.parse(t))
            );
    }

    /**
     * Stops execution of tasks and shutdowns client.
     */
    public close() {
        if (this.isStopping) {
            return;
        }

        this.isStopping = true;
        // TODO: better handling of cancellation (e.g. await all operation completion and then disconnect)
        this.client.disconnect();
    }

    /**
     * Checks if there is a task that was scheduled and needs to be executed now.
     * If one found, it will move the task from "future" to "immediate" queue
     * in single transaction.
     */
    private async nextScheduled() {
        if (this.isStopping) {
            return;
        }

        try {
            const tasks = await this.client.zrangebyscore(FUTURE_TASKS_KEY, 0, epoch());
            if (!tasks?.length) {
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

    /**
     * Checks if there is a task that should be executed.
     * If one found, it will move the task from "immediate" to "processing" queue,
     * which avoids other workers to handle the same task, and call executer.
     * Once done executing, the task will be removed from "processing" queue.
     *
     * TODO: there should be an additional worker to watch tasks
     * that timed-out in "processing" queue and move them back into "immediate" queue.
     */
    private async nextTask() {
        if (this.isStopping) {
            return;
        }

        try {
            const msg = await this.client.rpoplpush(IMMEDIATE_TASKS_KEY, PROCESSING_TASKS_KEY);
            if (!msg) {
                await sleep();
            } else {
                await this.executer.execute(JSON.parse(msg));
                await this.client.lrem(PROCESSING_TASKS_KEY, 1, msg);
            }
        } catch (error) {
            console.error('There was an error processing a message', error);
        } finally {
            setTimeout(() => this.nextTask(), 0);
        }
    }
}
