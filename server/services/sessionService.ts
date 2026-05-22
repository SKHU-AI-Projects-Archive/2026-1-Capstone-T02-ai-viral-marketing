import { ObjectId } from "mongodb";

import type { UserRecord } from "../db";
import express = require("express");

type Request = express.Request;

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export function sanitizeUser(user: UserRecord & { _id: ObjectId }): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

export function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

