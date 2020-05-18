export interface Task<T = string> {
    id: string;
    scheduledOnEpoch: number;
    executeOnEpoch: number;
    payload: T;
}
