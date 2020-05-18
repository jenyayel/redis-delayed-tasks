import { Express, Request, Response } from 'express';
import * as core from 'express-serve-static-core';
import DelayedTasks from '../service';

export default (app: Express, client: DelayedTasks) => {
    app.get('/', (_, res: Response) => {
        res.json(['GET: /tasks', 'POST: /tasks']);
    });

    app.get('/tasks', async (_, res: Response) => {
        res.json(await client.get());
    });

    app.post('/tasks', async (
        req: Request<core.ParamsDictionary, { delaySeconds?: number, message?: string }>,
        res: Response) => {
        res.json(await client.add(
            Math.abs(req.body.delaySeconds || 0),
            req.body.message));
    });
};
