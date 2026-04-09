import { env } from './env.js';
import { createApp } from './app.js';

const app = createApp();

app.listen(env.PORT, () => {
  const url = `http://localhost:${env.PORT}`;
  console.log(`user-service running at ${url}`);
  console.log(`NODE_ENV=${env.NODE_ENV}`);
});
