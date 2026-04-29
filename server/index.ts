import fs from "fs";
import path from "path";

import bcrypt from "bcryptjs";
import MongoStore from "connect-mongo";
import dotenv from "dotenv";
import express, { NextFunction, Request, Response } from "express";
import session from "express-session";
import multer from "multer";
import { Collection, MongoClient, ObjectId } from "mongodb";

dotenv.config({ path: path.join(process.cwd(), ".env") });

type SessionUser = {
  id: string;
  name: string;
  email: string;
};

type UserRecord = {
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 4 * 1024 * 1024,
  },
});

const port = Number(process.env.PORT || 3000);
const mongoUrl = (process.env.MONGO_DB || "").trim();
const sessionSecret = process.env.SESSION_SECRET || "replace-this-session-secret";
const fastApiBaseUrl = (process.env.FASTAPI_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
const usersDbName = "users";
const usersCollectionName = "user";
const frontendDistPath = path.join(process.cwd(), "frontend", "dist");

let usersCollection: Collection<UserRecord>;

function frontendBuildExists(): boolean {
  return fs.existsSync(path.join(frontendDistPath, "index.html"));
}

function sendFrontendUnavailable(res: Response): void {
  res.status(503).type("text/plain").send(
    "프론트엔드 빌드를 찾을 수 없습니다. frontend 디렉터리에서 `npm install` 후 `npm run build`를 실행해 주세요."
  );
}

function sendFrontendIndex(res: Response): void {
  if (!frontendBuildExists()) {
    sendFrontendUnavailable(res);
    return;
  }

  res.sendFile(path.join(frontendDistPath, "index.html"));
}

function sanitizeUser(user: { _id: ObjectId; name: string; email: string }): SessionUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}

function normalizeEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.status(401).json({ detail: "로그인이 필요합니다." });
    return;
  }

  next();
}

function requireAuthPage(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) {
    res.redirect("/login");
    return;
  }

  next();
}

function destroySession(req: Request): Promise<void> {
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

function regenerateSession(req: Request): Promise<void> {
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

async function relayJsonResponse(upstreamResponse: globalThis.Response, res: Response): Promise<void> {
  const contentType = upstreamResponse.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await upstreamResponse.json();
    res.status(upstreamResponse.status).json(data);
    return;
  }

  const text = await upstreamResponse.text();
  res.status(upstreamResponse.status).json({
    detail: text || "내부 AI 서버가 예상하지 못한 응답을 반환했습니다.",
  });
}

async function bootstrap(): Promise<void> {
  if (!mongoUrl) {
    throw new Error("MONGO_DB 환경 변수가 설정되어 있지 않습니다.");
  }

  const mongoClient = new MongoClient(mongoUrl);
  await mongoClient.connect();

  const database = mongoClient.db(usersDbName);
  usersCollection = database.collection<UserRecord>(usersCollectionName);
  await usersCollection.createIndex({ email: 1 }, { unique: true });

  app.use(express.json());
  app.use(
    session({
      name: "ovms.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl,
        dbName: usersDbName,
        collectionName: "sessions",
        ttl: 24 * 60 * 60,
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(express.static(frontendDistPath));

  app.get("/api/auth/session", (req: Request, res: Response) => {
    if (!req.session.user) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: req.session.user,
    });
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
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

  app.post("/api/auth/login", async (req: Request, res: Response) => {
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

  app.post("/api/auth/logout", async (req: Request, res: Response) => {
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

  app.post("/api/generate", requireAuth, async (req: Request, res: Response) => {
    try {
      const upstreamResponse = await fetch(`${fastApiBaseUrl}/internal/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      await relayJsonResponse(upstreamResponse, res);
    } catch (_error) {
      res.status(502).json({ detail: "AI 생성 서버에 연결하지 못했습니다." });
    }
  });

  app.post("/api/analyze-image", requireAuth, upload.single("file"), async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ detail: "이미지 파일을 업로드해 주세요." });
      return;
    }

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
      formData.append("file", blob, req.file.originalname);

      const upstreamResponse = await fetch(`${fastApiBaseUrl}/internal/analyze-image`, {
        method: "POST",
        body: formData,
      });

      await relayJsonResponse(upstreamResponse, res);
    } catch (_error) {
      res.status(502).json({ detail: "이미지 분석 서버에 연결하지 못했습니다." });
    }
  });

  app.get(["/generate", "/result"], requireAuthPage, (_req: Request, res: Response) => {
    sendFrontendIndex(res);
  });

  app.get(["/", "/login", "/signup"], (_req: Request, res: Response) => {
    sendFrontendIndex(res);
  });

  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ detail: "요청한 경로를 찾을 수 없습니다." });
      return;
    }

    if (req.path === "/generate" || req.path === "/result") {
      requireAuthPage(req, res, () => sendFrontendIndex(res));
      return;
    }

    sendFrontendIndex(res);
  });

  app.listen(port, () => {
    console.log(`Node 인증 서버 실행 중: http://127.0.0.1:${port}`);
  });
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
