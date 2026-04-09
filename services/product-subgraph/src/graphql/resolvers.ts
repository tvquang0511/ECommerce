import type { Product } from '../data/products.js';
import { getProductById, listProducts } from '../data/products.js';

export const resolvers = {
  Query: {
    ping: () => 'pong',
    product: (_: unknown, args: { id: string }): Product | null =>
      getProductById(args.id) ?? null,
    products: (): Product[] => listProducts(),
  },
  Product: {
    __resolveReference: (ref: { id: string }): Product | null =>
      getProductById(ref.id) ?? null,
  },
};
