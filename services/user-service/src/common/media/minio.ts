import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

import { env } from "../../env.js";

let clientSingleton: S3Client | null = null;

function getClient(): S3Client {
  if (clientSingleton) return clientSingleton;

  const protocol = env.MINIO_USE_SSL ? "https" : "http";
  const endpoint = `${protocol}://${env.MINIO_ENDPOINT}${env.MINIO_PORT && env.MINIO_PORT !== 80 && env.MINIO_PORT !== 443 ? `:${env.MINIO_PORT}` : ""}`;

  clientSingleton = new S3Client({
    region: 'ap-northeast-1',
    endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
  });

  return clientSingleton;
}

function trimTrailingSlash(url: string) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function encodeObjectNameForUrl(objectName: string) {
  return objectName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function decodeObjectNameFromUrlPath(encodedObjectPath: string) {
  return encodedObjectPath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}

export function minioPublicObjectUrl(objectName: string) {
  const base = trimTrailingSlash(env.MINIO_PUBLIC_URL);
  const bucket = encodeURIComponent(env.MINIO_PUBLIC_BUCKET);
  return `${base}/${bucket}/${encodeObjectNameForUrl(objectName)}`;
}

export function tryParsePublicObjectNameFromUrl(
  avatarUrl: string | null | undefined,
): string | null {
  if (!avatarUrl) return null;

  const base = trimTrailingSlash(env.MINIO_PUBLIC_URL);
  if (!avatarUrl.startsWith(base)) return null;

  const rest = avatarUrl.slice(base.length);
  if (!rest.startsWith("/")) return null;

  const parts = rest.split("/").filter(Boolean);
  if (parts.length < 2) return null;

  const bucketFromUrl = parts[0];
  const bucket = env.MINIO_PUBLIC_BUCKET;
  if (bucketFromUrl !== bucket && bucketFromUrl !== encodeURIComponent(bucket))
    return null;

  const encodedObjectPath = parts.slice(1).join("/");
  return decodeObjectNameFromUrlPath(encodedObjectPath);
}

export async function putPublicObject(input: {
  objectName: string;
  body: Buffer;
  size: number;
  contentType: string;
}) {
  const client = getClient();

  const command = new PutObjectCommand({
    Bucket: env.MINIO_PUBLIC_BUCKET,
    Key: input.objectName,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: "public, max-age=86400",
  });

  await client.send(command);

  return {
    url: minioPublicObjectUrl(input.objectName),
  };
}

export async function removePublicObject(objectName: string) {
  const client = getClient();
  const command = new DeleteObjectCommand({
    Bucket: env.MINIO_PUBLIC_BUCKET,
    Key: objectName,
  });
  await client.send(command);
}
