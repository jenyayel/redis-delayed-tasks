import * as express from 'express';
import { Express, Request, Response } from 'express';
import * as core from 'express-serve-static-core';
import * as parser from 'body-parser';
import DelayedTasks from './service';

export const startApiServer = (service: DelayedTasks) => {
    const app = express();
    app.use(parser.json());
    routes(app, service);

    const listener = app.listen(process.env.PORT ?? '8081', () => {
        console.log(`Started API server`, listener.address());
    });
    return listener;
};

const routes = (app: Express, service: DelayedTasks) => {
    app.get('/', (_, res: Response) => {
        res.json(['GET: /tasks', 'POST: /tasks']);
    });

    app.get('/tasks', async (_, res: Response) => {
        res.json(await service.get());
    });

    app.post('/tasks', async (
        req: Request<core.ParamsDictionary, { delaySeconds?: number, message?: string }>,
        res: Response) => {
        res.json(await service.add(
            Math.abs(req.body.delaySeconds || 0),
            req.body.message));
    });
};
