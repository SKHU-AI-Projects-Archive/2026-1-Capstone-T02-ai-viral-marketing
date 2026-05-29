import bcrypt = require("bcryptjs");
import express = require("express");
import { Collection } from "mongodb";

import type {} from "../express-session";
import type { UserRecord } from "../db";
import { getOrCreateCsrfToken, requireCsrfToken } from "../middleware/auth";
import { authRateLimit } from "../middleware/rateLimit";
import {
  destroySession,
  normalizeEmail,
  regenerateSession,
  sanitizeUser,
} from "../services/sessionService";

type Request = express.Request;
type Response = express.Response;

export function createAuthRouter(usersCollection: Collection<UserRecord>): express.Router {
  const router = express.Router();

  router.get("/csrf-token", (req: Request, res: Response) => {
    res.json({ csrfToken: getOrCreateCsrfToken(req) });
  });

  router.get("/auth/session", (req: Request, res: Response) => {
    if (!req.session.user) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: req.session.user,
    });
  });

  router.post("/auth/signup", authRateLimit, requireCsrfToken, async (req: Request, res: Response) => {
    const name = String(req.body?.name || "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!name) {
      res.status(400).json({ detail: "이름을 입력해 주세요." });
      return;
    }

    if (!email) {
      res.status(400).json({ detail: "이메일을 입력해 주세요." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ detail: "비밀번호는 6자 이상이어야 합니다." });
      return;
    }

    try {
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        res.status(409).json({ detail: "이미 가입된 이메일입니다." });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userDocument: UserRecord = {
        name,
        email,
        passwordHash,
        createdAt: new Date(),
      };

      const insertResult = await usersCollection.insertOne(userDocument);
      const user = sanitizeUser({
        _id: insertResult.insertedId,
        name,
        email,
        passwordHash,
        createdAt: userDocument.createdAt,
      });

      await regenerateSession(req);
      req.session.user = user;

      res.status(201).json({
        detail: "회원가입이 완료되었습니다.",
        user,
      });
    } catch (error) {
      if (String((error as Error)?.message || "").includes("E11000")) {
        res.status(409).json({ detail: "이미 가입된 이메일입니다." });
        return;
      }

      res.status(500).json({ detail: "회원가입 처리 중 오류가 발생했습니다." });
    }
  });

  router.post("/auth/login", authRateLimit, requireCsrfToken, async (req: Request, res: Response) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      res.status(400).json({ detail: "이메일과 비밀번호를 입력해 주세요." });
      return;
    }

    try {
      const user = await usersCollection.findOne({ email });
      if (!user) {
        res.status(401).json({ detail: "이메일 또는 비밀번호가 올바르지 않습니다." });
        return;
      }

      const passwordMatches = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatches) {
        res.status(401).json({ detail: "이메일 또는 비밀번호가 올바르지 않습니다." });
        return;
      }

      await regenerateSession(req);
      req.session.user = sanitizeUser(user);

      res.json({
        detail: "로그인되었습니다.",
        user: req.session.user,
      });
    } catch (_error) {
      res.status(500).json({ detail: "로그인 처리 중 오류가 발생했습니다." });
    }
  });

  router.post("/auth/logout", requireCsrfToken, async (req: Request, res: Response) => {
    if (!req.session.user) {
      res.json({ detail: "이미 로그아웃된 상태입니다." });
      return;
    }

    try {
      await destroySession(req);
      res.clearCookie("ovms.sid");
      res.json({ detail: "로그아웃되었습니다." });
    } catch (_error) {
      res.status(500).json({ detail: "로그아웃 처리 중 오류가 발생했습니다." });
    }
  });

  return router;
}
