import crypto from "node:crypto";
import { env } from "../../env.js";

let cached:
  | {
      privateKeyPem: string;
      publicKeyPem: string;
    }
  | undefined;

function normalizePem(pem: string) {
  // Allow passing PEM with literal "\n" sequences.
  return pem.includes("\\n") ? pem.replace(/\\n/g, "\n") : pem;
}

function fromB64(b64: string) {
  return Buffer.from(b64, "base64").toString("utf8");
}

export function getAccessJwtKeys(): {
  privateKeyPem: string;
  publicKeyPem: string;
} {
  if (cached) return cached;

  const privateKeyPem = (() => {
    if (env.JWT_ACCESS_PRIVATE_KEY_PEM_B64)
      return normalizePem(fromB64(env.JWT_ACCESS_PRIVATE_KEY_PEM_B64));
    if (env.JWT_ACCESS_PRIVATE_KEY_PEM)
      return normalizePem(env.JWT_ACCESS_PRIVATE_KEY_PEM);
    return undefined;
  })();

  const publicKeyPem = (() => {
    if (env.JWT_ACCESS_PUBLIC_KEY_PEM_B64)
      return normalizePem(fromB64(env.JWT_ACCESS_PUBLIC_KEY_PEM_B64));
    if (env.JWT_ACCESS_PUBLIC_KEY_PEM)
      return normalizePem(env.JWT_ACCESS_PUBLIC_KEY_PEM);
    return undefined;
  })();

  if (privateKeyPem && publicKeyPem) {
    cached = { privateKeyPem, publicKeyPem };
    return cached;
  }

  if (env.NODE_ENV === "production") {
    throw new Error(
      "Missing RS256 keys. Set JWT_ACCESS_PRIVATE_KEY_PEM_B64 and JWT_ACCESS_PUBLIC_KEY_PEM_B64 (recommended) or *_PEM.",
    );
  }

  // Dev fallback: generate ephemeral keypair so local dev can start without manual setup.
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  cached = { privateKeyPem: privateKey, publicKeyPem: publicKey };
  return cached;
}
