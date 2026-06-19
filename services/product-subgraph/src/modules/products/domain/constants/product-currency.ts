export const PRODUCT_CURRENCIES = ['VND', 'USD', 'JPY'] as const;

export type ProductCurrency = (typeof PRODUCT_CURRENCIES)[number];
