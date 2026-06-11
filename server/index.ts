/// <reference path="./bcryptjs.d.ts" />
/// <reference path="./express-session.d.ts" />

import * as fs from "fs";
import * as path from "path";

import MongoStore = require("connect-mongo");
import express = require("express");
const helmet = require("helmet") as typeof import("helmet").default;
import session = require("express-session");

import { serverConfig } from "./config";
import { connectDatabase } from "./db";
import { requireAuthPage } from "./middleware/auth";
import { createGenerationQueue } from "./queues/aiQueue";
import { createAuthRouter } from "./routes/auth";
import { createBlogImagesRouter } from "./routes/blogImages";
import { createGenerationJobsRouter } from "./routes/generationJobs";
import { createGenerationRouter } from "./routes/generation";
import { createImageRouter } from "./routes/image";
import { createSettingsRouter } from "./routes/settings";

type Request = express.Request;
type Response = express.Response;

const app = express();
const { port, mongoUrl, sessionSecret, frontendDevUrl, nodeEnv } = serverConfig;
const frontendDistPath = path.join(process.cwd(), "frontend", "dist");

function frontendBuildExists(): boolean {
  return fs.existsSync(path.join(frontendDistPath, "index.html"));
}

function shouldUseFrontendDevServer(): boolean {
  return nodeEnv !== "production";
}

function sendFrontendUnavailable(res: Response): void {
  res.status(503).type("text/plain").send(
    "프론트엔드 빌드를 찾을 수 없습니다. frontend 디렉터리에서 `npm install` 후 `npm run build`를 실행해 주세요."
  );
}

function sendFrontendEntry(req: Request, res: Response): void {
  if (shouldUseFrontendDevServer()) {
    res.redirect(`${frontendDevUrl}${req.originalUrl}`);
    return;
  }

  if (!frontendBuildExists()) {
    sendFrontendUnavailable(res);
    return;
  }

  res.sendFile(path.join(frontendDistPath, "index.html"));
}

async function bootstrap(): Promise<void> {
  const { usersCollection, generationsCollection, jobsCollection } = await connectDatabase(mongoUrl);
  const generationQueue = createGenerationQueue();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(express.json());
  app.use(
    session({
      name: "ovms.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        mongoUrl,
        dbName: "users",
        collectionName: "sessions",
        ttl: 24 * 60 * 60,
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: nodeEnv === "production",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  if (!shouldUseFrontendDevServer()) {
    app.use(express.static(frontendDistPath));
  }
  app.use("/api", createAuthRouter(usersCollection));
  app.use(
    "/api",
    createGenerationJobsRouter(
      jobsCollection,
      generationQueue,
      usersCollection
    )
  );
  app.use("/api", createGenerationRouter(generationsCollection));
  app.use(
    "/api",
    createImageRouter(
      usersCollection,
      serverConfig.userApiKeyEncryptionSecret
    )
  );
  app.use(
    "/api",
    createSettingsRouter(
      usersCollection,
      serverConfig.userApiKeyEncryptionSecret
    )
  );
  app.use(
    "/api",
    createBlogImagesRouter({
      cloudinaryCloudName: serverConfig.cloudinaryCloudName,
      cloudinaryApiKey: serverConfig.cloudinaryApiKey,
      cloudinaryApiSecret: serverConfig.cloudinaryApiSecret,
      cloudinaryFolder: serverConfig.cloudinaryFolder,
    })
  );

  app.get(
    ["/generate", "/settings", "/result", "/result/:id", "/generations", "/generations/:id"],
    requireAuthPage,
    (req: Request, res: Response) => {
      sendFrontendEntry(req, res);
    }
  );

  app.get(["/", "/login", "/signup"], (req: Request, res: Response) => {
    sendFrontendEntry(req, res);
  });

  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ detail: "요청한 경로를 찾을 수 없습니다." });
      return;
    }

    if (
      req.path === "/generate" ||
      req.path === "/settings" ||
      req.path === "/result" ||
      req.path === "/generations" ||
      req.path.startsWith("/result/") ||
      req.path.startsWith("/generations/")
    ) {
      requireAuthPage(req, res, () => sendFrontendEntry(req, res));
      return;
    }

    sendFrontendEntry(req, res);
  });

  app.listen(port, () => {
    console.log(`Node 인증 서버 실행 중: http://127.0.0.1:${port}`);
  });
}

void bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
