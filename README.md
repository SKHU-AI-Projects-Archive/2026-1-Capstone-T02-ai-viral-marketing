# AI Viral Marketing

상품 정보와 이미지를 바탕으로 블로그 글, 쿠팡 리뷰, 커뮤니티 댓글형 마케팅 문구를 생성하고 저장 결과를 관리하는 웹 앱입니다.

## Architecture

현재 실행 단위는 Next.js Web/API와 BullMQ worker입니다.

```text
Browser
  -> Next.js App Router (:3000)
    -> app/api/* route handlers
    -> MongoDB: users, sessions, generations, ai_jobs, generation_examples
    -> Redis/BullMQ: generation job queue
    -> Gemini API
    -> Cloudinary

Worker
  -> Redis/BullMQ
  -> TypeScript AI service
  -> Gemini API
  -> MongoDB
```

FastAPI와 Express 서버는 더 이상 실행 경로에 포함되지 않습니다. AI 생성과 이미지 분석은 `src/server/ai/*` TypeScript 서버 함수가 직접 처리합니다.

## Tech Stack

- Web/API: Next.js App Router, React, TypeScript
- Auth/session: MongoDB-backed signed session cookie, CSRF token
- Queue/worker: BullMQ, Redis, `workers/generationWorker.ts`
- AI: Google Gemini REST API
- Storage: MongoDB, Cloudinary
- Test: Vitest

## Environment

루트 `.env`에 필요한 값을 설정합니다.

```env
MONGO_DB=mongodb+srv://...
SESSION_SECRET=change-this-secret
USER_API_KEY_ENCRYPTION_SECRET=base64_or_hex_encoded_32_byte_secret
REDIS_URL=redis://127.0.0.1:6379
GEMINI_MODEL=gemini-2.5-flash
GEMINI_GENERATE_TIMEOUT_SECONDS=110
GEMINI_IMAGE_TIMEOUT_SECONDS=110
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=ovms/blog-images
PORT=3000
```

Removed from the runtime path:

- `FASTAPI_BASE_URL`
- `INTERNAL_API_SECRET`
- `CHROMA_DB_PATH`

`NODE_ENV=production`에서는 `SESSION_SECRET`와 `USER_API_KEY_ENCRYPTION_SECRET`를 반드시 안전한 값으로 설정해야 합니다.

## Install

```powershell
npm install --include=dev
```

Redis는 별도로 실행되어야 합니다.

```powershell
docker run --name ovms-redis -p 6379:6379 -d redis:7
```

이미 컨테이너가 있다면:

```powershell
docker start ovms-redis
```

## Development

Next.js와 worker를 함께 실행합니다.

```powershell
npm run dev
```

브라우저 접속 주소:

```text
http://127.0.0.1:3000
```

개별 실행:

```powershell
npm run dev:web
npm run dev:worker
```

## Production Build

```powershell
npm run build
npm start
```

worker는 별도 long-running process로 실행합니다.

```powershell
npm run worker
```

## Verification

```powershell
npm run typecheck
npm test
npm run build
```

## API Summary

- `GET /api/health`
- `GET /api/csrf-token`
- `GET /api/auth/session`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/settings/gemini-key`
- `PUT /api/settings/gemini-key`
- `DELETE /api/settings/gemini-key`
- `POST /api/analyze-image`
- `POST /api/blog-images`
- `POST /api/generation-jobs`
- `GET /api/generation-jobs/[id]`
- `POST /api/generation-jobs/[id]/retry`
- `GET /api/generations`
- `GET /api/generations/[id]`
- `POST /api/generate` returns `410 Gone`

## Gemini API Keys

사용자는 `/settings`에서 본인 Gemini API 키를 등록해야 합니다. 키는 평문 저장하지 않고 `USER_API_KEY_ENCRYPTION_SECRET`으로 AES-256-GCM 암호화해 MongoDB에 저장합니다. API 응답에는 전체 키를 반환하지 않고 preview metadata만 반환합니다.

secret 생성 예:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
