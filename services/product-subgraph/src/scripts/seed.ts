import fs from 'node:fs';
import path from 'node:path';
import mongoose, { type Model } from 'mongoose';

import {
  ProductModel,
  ProductSchema,
} from '../modules/products/domain/product.mongo.schema';

type ProductSeed = {
  id: string;
  sellerId: string;
  name: string;
  sku: string;
  brand?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  price: number;
  salePrice?: number | null;
  currency?: string;
  slug: string;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';
  publishedAt?: Date | null;
  archivedAt?: Date | null;
  categoryId?: string | null;
  tags?: string[];
  attributes?: Record<string, string | number | boolean | null>;
  coverImage?: {
    bucket: string;
    objectKey: string;
    contentType: string;
    size: number;
    uploadedAt: Date;
  } | null;
  galleryImages?: Array<{
    bucket: string;
    objectKey: string;
    contentType: string;
    size: number;
    uploadedAt: Date;
  }>;
};

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const serviceRoot = path.resolve(__dirname, '..', '..');
loadEnvFile(path.join(serviceRoot, '.env'));
loadEnvFile(path.join(serviceRoot, '.env.local'));

const mongoUri =
  process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/product-subgraph';
const privateBucket = process.env.MINIO_PRIVATE_BUCKET ?? 'product-private';

const now = new Date();
const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

const seeds: ProductSeed[] = [
  {
    id: 'p1001',
    sellerId: 'seller-demo-user',
    name: 'Bàn phím cơ RK84 Wireless',
    sku: 'RK84-WL-001',
    brand: 'Royal Kludge',
    shortDescription: 'Bàn phím cơ 75% không dây cho góc setup gọn gàng.',
    description:
      'Sản phẩm demo ở trạng thái DRAFT để test flow seller tạo sản phẩm rồi tiếp tục chỉnh sửa trước khi submit review.',
    price: 1590000,
    salePrice: 1490000,
    currency: 'VND',
    slug: 'ban-phim-co-rk84-wireless-p1001',
    status: 'DRAFT',
    publishedAt: null,
    archivedAt: null,
    categoryId: 'keyboards',
    tags: ['keyboard', 'wireless', 'mechanical'],
    attributes: { switch: 'brown', layout: '75%', hotSwap: true },
    coverImage: {
      bucket: privateBucket,
      objectKey: 'products/p1001/seed-cover-rk84.webp',
      contentType: 'image/webp',
      size: 182044,
      uploadedAt: threeDaysAgo,
    },
    galleryImages: [],
  },
  {
    id: 'p1002',
    sellerId: 'seller-demo-user',
    name: 'Chuột công thái học Logitech Lift',
    sku: 'LIFT-ERG-002',
    brand: 'Logitech',
    shortDescription: 'Chuột công thái học dành cho dân văn phòng và coder.',
    description:
      'Sản phẩm demo ở trạng thái PENDING_REVIEW để test admin approve hoặc reject.',
    price: 1690000,
    salePrice: null,
    currency: 'VND',
    slug: 'chuot-cong-thai-hoc-logitech-lift-p1002',
    status: 'PENDING_REVIEW',
    publishedAt: null,
    archivedAt: null,
    categoryId: 'mice',
    tags: ['mouse', 'ergonomic', 'office'],
    attributes: { connectivity: 'bluetooth', handed: 'right' },
    coverImage: {
      bucket: privateBucket,
      objectKey: 'products/p1002/seed-cover-lift.webp',
      contentType: 'image/webp',
      size: 154220,
      uploadedAt: twoDaysAgo,
    },
    galleryImages: [],
  },
  {
    id: 'p1003',
    sellerId: 'seller-demo-user',
    name: 'Màn hình Dell UltraSharp 27 4K',
    sku: 'DELL-U2723-003',
    brand: 'Dell',
    shortDescription: 'Màn hình 4K cho thiết kế và làm việc nhiều cửa sổ.',
    description:
      'Sản phẩm demo ở trạng thái APPROVED để guest, buyer, cart đều có thể nhìn thấy.',
    price: 11290000,
    salePrice: 10590000,
    currency: 'VND',
    slug: 'man-hinh-dell-ultrasharp-27-4k-p1003',
    status: 'APPROVED',
    publishedAt: oneDayAgo,
    archivedAt: null,
    categoryId: 'monitors',
    tags: ['monitor', '4k', 'office'],
    attributes: { panel: 'IPS', sizeInch: 27, usbC: true },
    coverImage: {
      bucket: privateBucket,
      objectKey: 'products/p1003/seed-cover-u2723.webp',
      contentType: 'image/webp',
      size: 243881,
      uploadedAt: twoDaysAgo,
    },
    galleryImages: [
      {
        bucket: privateBucket,
        objectKey: 'products/p1003/seed-gallery-u2723-1.webp',
        contentType: 'image/webp',
        size: 201553,
        uploadedAt: oneDayAgo,
      },
    ],
  },
  {
    id: 'p1004',
    sellerId: 'seller-demo-user',
    name: 'Giá đỡ laptop nhôm gập gọn',
    sku: 'STAND-ALU-004',
    brand: 'Ugreen',
    shortDescription: 'Giá đỡ laptop nâng tầm nhìn và cải thiện tản nhiệt.',
    description:
      'Sản phẩm demo ở trạng thái REJECTED để test seller chỉnh sửa rồi submit lại.',
    price: 420000,
    salePrice: 369000,
    currency: 'VND',
    slug: 'gia-do-laptop-nhom-gap-gon-p1004',
    status: 'REJECTED',
    publishedAt: null,
    archivedAt: null,
    categoryId: 'accessories',
    tags: ['laptop-stand', 'desk-setup'],
    attributes: { material: 'aluminum', foldable: true },
    coverImage: null,
    galleryImages: [],
  },
  {
    id: 'p1005',
    sellerId: 'seller-demo-user',
    name: 'Tai nghe chụp tai closed-back monitor',
    sku: 'HEADPHONE-MON-005',
    brand: 'Audio-Technica',
    shortDescription: 'Tai nghe monitor đóng kín để nghe lâu không mệt.',
    description:
      'Sản phẩm demo ở trạng thái ARCHIVED để test visibility và rule không cho update.',
    price: 2490000,
    salePrice: null,
    currency: 'VND',
    slug: 'tai-nghe-chup-tai-closed-back-monitor-p1005',
    status: 'ARCHIVED',
    publishedAt: null,
    archivedAt: now,
    categoryId: 'audio',
    tags: ['headphone', 'monitoring'],
    attributes: { impedance: 38, wired: true },
    coverImage: null,
    galleryImages: [],
  },
  {
    id: 'p1006',
    sellerId: 'seller-demo-user-2',
    name: 'Webcam Full HD cho họp trực tuyến',
    sku: 'WEBCAM-FHD-006',
    brand: 'Anker',
    shortDescription: 'Webcam Full HD phục vụ họp và streaming cơ bản.',
    description:
      'Sản phẩm approved của seller khác để test list công khai không chỉ có một shop.',
    price: 1290000,
    salePrice: 1090000,
    currency: 'VND',
    slug: 'webcam-full-hd-cho-hop-truc-tuyen-p1006',
    status: 'APPROVED',
    publishedAt: oneDayAgo,
    archivedAt: null,
    categoryId: 'camera',
    tags: ['webcam', 'meeting', 'stream'],
    attributes: { resolution: '1080p', microphone: true },
    coverImage: null,
    galleryImages: [],
  },
];

async function main() {
  await mongoose.connect(mongoUri);

  const productModel = mongoose.model(
    ProductModel.name,
    ProductSchema,
  ) as Model<ProductSeed>;

  await productModel.deleteMany({
    id: { $in: seeds.map((seed) => seed.id) },
  });

  await productModel.insertMany(seeds, { ordered: true });

  console.log(
    `[seed:products] Seeded ${seeds.length} products into ${mongoUri}`,
  );
}

main()
  .catch((error) => {
    console.error('[seed:products] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
