import { graphqlRequest } from './graphqlClient';

export type Money = {
  amount: number;
  currency: string;
};

export type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  titleSnapshot: string;
  imageSnapshot: string | null;
  unitPrice: Money;
};

export type Cart = {
  id: string;
  userId: string;
  currency: string;
  updatedAt: string;
  items: CartItem[];
  totals: {
    subtotal: Money;
    total: Money;
  };
};

const CART_QUERY = `
  query MyCart {
    cart {
      id
      userId
      currency
      updatedAt
      items {
        id
        productId
        quantity
        titleSnapshot
        imageSnapshot
        unitPrice {
          amount
          currency
        }
      }
      totals {
        subtotal {
          amount
          currency
        }
        total {
          amount
          currency
        }
      }
    }
  }
`;

const CART_SELECTION = `
  id
  userId
  currency
  updatedAt
  items {
    id
    productId
    quantity
    titleSnapshot
    imageSnapshot
    unitPrice {
      amount
      currency
    }
  }
  totals {
    subtotal {
      amount
      currency
    }
    total {
      amount
      currency
    }
  }
`;

export const cartService = {
  async getCart(accessToken: string) {
    const data = await graphqlRequest<{ cart: Cart | null }, undefined>('/api/graphql', {
      query: CART_QUERY,
      accessToken,
    });

    return data.cart;
  },

  async addToCart(accessToken: string, input: { productId: string; quantity: number }) {
    const data = await graphqlRequest<{ addToCart: Cart }, { input: typeof input }>('/api/graphql', {
      query: `mutation AddToCart($input: AddToCartInput!) { addToCart(input: $input) { ${CART_SELECTION} } }`,
      variables: { input },
      accessToken,
    });
    return data.addToCart;
  },

  async updateCartItem(accessToken: string, input: { productId?: string; itemId?: string; quantity: number }) {
    const data = await graphqlRequest<{ updateCartItem: Cart }, { input: typeof input }>('/api/graphql', {
      query: `mutation UpdateCartItem($input: UpdateCartItemInput!) { updateCartItem(input: $input) { ${CART_SELECTION} } }`,
      variables: { input },
      accessToken,
    });
    return data.updateCartItem;
  },

  async removeCartItem(accessToken: string, input: { productId?: string; itemId?: string }) {
    const data = await graphqlRequest<{ removeCartItem: Cart }, { input: typeof input }>('/api/graphql', {
      query: `mutation RemoveCartItem($input: RemoveCartItemInput!) { removeCartItem(input: $input) { ${CART_SELECTION} } }`,
      variables: { input },
      accessToken,
    });
    return data.removeCartItem;
  },

  async clearCart(accessToken: string) {
    const data = await graphqlRequest<{ clearCart: Cart }, undefined>('/api/graphql', {
      query: `mutation ClearCart { clearCart { ${CART_SELECTION} } }`,
      accessToken,
    });
    return data.clearCart;
  },
};
