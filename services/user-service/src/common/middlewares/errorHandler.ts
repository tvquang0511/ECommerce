import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "@repo/common/errors";
import { Prisma } from "../../../prisma/generated/index.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Unique constraint violations.
    if (err.code === "P2002") {
      const target = (err.meta as any)?.target;
      const fields: string[] = Array.isArray(target)
        ? target
        : typeof target === "string"
          ? [target]
          : [];

      if (fields.includes("phoneNumber")) {
        return res.status(409).json({
          error: {
            code: "PHONE_NUMBER_TAKEN",
            message: "Phone number is already in use",
            details: { fields },
          },
        });
      }

      if (fields.includes("email")) {
        return res.status(409).json({
          error: {
            code: "EMAIL_TAKEN",
            message: "Email is already in use",
            details: { fields },
          },
        });
      }

      return res.status(409).json({
        error: {
          code: "UNIQUE_CONSTRAINT",
          message: "Unique constraint violated",
          details: { fields },
        },
      });
    }
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: {
          issues: err.issues,
        },
      },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  console.error(err);

  return res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Unexpected error",
      details: {},
    },
  });
};
