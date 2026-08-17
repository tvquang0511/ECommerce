import { env } from "./env.js";
import { createApp } from "./app.js";
import { startMailWorker } from "./workers/worker.js";

const app = createApp();
const mailWorker = startMailWorker();

app.listen(env.PORT, () => {
  const url = `http://localhost:${env.PORT}`;
  console.log(`user-service running at ${url}`);
  console.log(`NODE_ENV=${env.NODE_ENV}`);
});
