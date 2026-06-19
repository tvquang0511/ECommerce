import { graphqlRequest } from './graphqlClient';

export type ProductSummary = {
  id: string;
  name: string;
  price: number;
  shortDescription: string | null;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  sellerId: string;
};

const PRODUCTS_QUERY = `
  query ProductList {
    products {
      id
      name
      price
      shortDescription
      status
      sellerId
    }
  }
`;

export const productService = {
  async list(accessToken?: string | null) {
    const data = await graphqlRequest<{ products: ProductSummary[] }, undefined>('/api/graphql', {
      query: PRODUCTS_QUERY,
      accessToken,
    });

    return data.products;
  },
};
