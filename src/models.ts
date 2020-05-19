export interface Task<T = string> {
    id: string;
    scheduledOnEpoch: number;
    executeOnEpoch: number;
    payload: T;
}

export interface Executer<T = string> {
    execute: (task: Task<T>) => Promise<void> | void;
}
