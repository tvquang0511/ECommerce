export type Product = {
  id: string;
  sellerId: string;
  name: string;
  price: number;
  slug: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  categoryId?: string | null;
  tags: string[];
  attributes: Record<string, string | number | boolean | null>;
};
