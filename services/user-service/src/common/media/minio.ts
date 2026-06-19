import { Client } from "minio";

import { env } from "../../env.js";

let clientSingleton: Client | null = null;

function getClient(): Client {
  if (clientSingleton) return clientSingleton;

  clientSingleton = new Client({
    endPoint: env.MINIO_ENDPOINT,
    port: env.MINIO_PORT,
    useSSL: env.MINIO_USE_SSL,
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
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

  await client.putObject(
    env.MINIO_PUBLIC_BUCKET,
    input.objectName,
    input.body,
    input.size,
    {
      "Content-Type": input.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  );

  return {
    url: minioPublicObjectUrl(input.objectName),
  };
}

export async function removePublicObject(objectName: string) {
  const client = getClient();
  await client.removeObject(env.MINIO_PUBLIC_BUCKET, objectName);
}
