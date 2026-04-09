import { env } from './env.js';
import { startServer } from './server.js';

const { url } = await startServer();

console.log(`product-subgraph running at ${url}`);
console.log(`NODE_ENV=${env.NODE_ENV}`);
