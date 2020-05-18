import * as express from 'express';
import * as parser from 'body-parser';
import routes from './routes';
import DelayedTasks from '../service';

export const startApiServer = (client: DelayedTasks) => {
    const app = express();
    app.use(parser.json());
    routes(app, client);

    const listener = app.listen(process.env.PORT ?? '8080', () => {
        console.log(`Started API server`, listener.address());
    });
    return listener;
};
