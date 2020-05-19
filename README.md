# Redis Delayed Tasks

A naive implementation for scheduling delayed tasks using Redis. This is just for fun 
project and shouldn't be used in production.

To run locally (requires Docker):

```bash
npm i
docker-compose up -d
npm start
```

This will start API at [http://localhost:8081](http://localhost:8081).

To add a task:

```bash
curl --location --request POST 'http://localhost:8081/tasks' \
--header 'Content-Type: application/json' \
--data-raw '{
	"delaySeconds": 1,
	"message": "1"
}'
```

To view tasks:

```bash
curl --location --request GET 'http://localhost:8081/tasks'
```
