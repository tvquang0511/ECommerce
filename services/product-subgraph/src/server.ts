import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { buildSubgraphSchema } from '@apollo/subgraph';
import cors from 'cors';
import express from 'express';
import http from 'node:http';
import { env } from './env.js';
import { resolvers } from './graphql/resolvers.js';
import { typeDefs } from './graphql/typeDefs.js';

export async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    schema: buildSubgraphSchema([{ typeDefs, resolvers }]),
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use('/graphql', cors(), express.json(), expressMiddleware(server));

  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, resolve);
  });

  return { url: `http://localhost:${env.PORT}/graphql` };
}
