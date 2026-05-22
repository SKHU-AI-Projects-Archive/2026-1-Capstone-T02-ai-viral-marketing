import { randomBytes, timingSafeEqual } from "crypto";

import express = require("express");

type NextFunction = express.NextFunction;
type Request = express.Request;
type Response = express.Response;

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ detail: "로그인이 필요합니다." });
    return;
  }

  next();
}

export function requireAuthPage(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  next();
}

function createCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export function getOrCreateCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = createCsrfToken();
  }
  return req.session.csrfToken;
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function requireCsrfToken(req: Request, res: Response, next: NextFunction): void {
  const expectedToken = req.session.csrfToken;
  const submittedToken = String(req.get("X-CSRF-Token") || "");

  if (!expectedToken || !submittedToken || !tokensMatch(expectedToken, submittedToken)) {
    res.status(403).json({ detail: "요청 보안 토큰이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요." });
    return;
  }

  next();
}

