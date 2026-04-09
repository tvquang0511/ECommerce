export type Product = {
  id: string;
  name: string;
};

const products: Product[] = [
  { id: '1', name: 'Product #1' },
  { id: '2', name: 'Product #2' },
  { id: '3', name: 'Product #3' },
];

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

export function listProducts(): Product[] {
  return products;
}
