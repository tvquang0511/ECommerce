export type Product = {
  id: string;
  sellerId: string;
  name: string;
  sku: string;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  price: number;
  salePrice?: number | null;
  currency: string;
  slug: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  categoryId?: string | null;
  tags: string[];
  attributes: Record<string, string | number | boolean | null>;
};
