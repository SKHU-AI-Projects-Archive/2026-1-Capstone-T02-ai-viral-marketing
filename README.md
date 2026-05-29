# AI Viral Marketing

제품 정보와 제품 이미지를 바탕으로 블로그 글, 쿠팡 리뷰, 커뮤니티 댓글용 마케팅 문구를 생성하고 저장 결과를 관리하는 캡스톤 프로젝트입니다.

## 아키텍처

이 저장소는 세 개의 실행 단위로 구성됩니다.

- `frontend`: React + TypeScript + Vite 기반 UI
- `server`: Node.js + Express 기반 인증/API 게이트웨이
- `backend`: FastAPI 기반 Gemini AI 처리 서버

브라우저는 Express 서버(`http://127.0.0.1:3000`)에 접속합니다. Express 서버는 로그인, 세션, CSRF, 저장 결과 조회, 이미지 업로드 중계를 담당하고, AI 생성 작업은 Redis/BullMQ 큐에 등록합니다. 별도 Node worker가 큐의 작업을 가져와 FastAPI 서버(`http://127.0.0.1:8000`)를 호출하고, 생성 결과를 MongoDB에 저장합니다.

```text
Browser
  -> Express server (:3000)
    -> MongoDB: users, sessions, generations, ai_jobs
    -> Redis/BullMQ: generation job queue
    -> FastAPI (:8000)
      -> Gemini API
      -> ChromaDB example store
  -> Node worker
    -> Redis/BullMQ
    -> FastAPI
    -> MongoDB
```

## 주요 기능

- 회원가입, 로그인, 로그아웃
- 24시간 세션 유지
- CSRF 보호와 rate limit
- 로그인 사용자 전용 문구 생성/이미지 분석 API
- JPG, PNG, WEBP 이미지 분석, 최대 4MB
- 비동기 생성 job 생성, 상태 조회, 실패 job 재시도
- 생성 결과 자동 저장과 사용자별 저장 결과 격리
- Markdown 결과 렌더링과 URL scheme 제한
- ChromaDB 기반 이전 생성 예시 검색

## 기술 스택

- Frontend: React, TypeScript, Vite, React Router, React Testing Library
- API Gateway: Node.js, Express, TypeScript, express-session, connect-mongo, helmet, express-rate-limit
- Queue/Worker: BullMQ, Redis, Node worker
- AI Backend: FastAPI, Pydantic, httpx, python-dotenv
- Database: MongoDB, ChromaDB
- AI Provider: Google Gemini API
- Test: Vitest, Supertest, pytest

## 사전 준비

- Node.js 18 이상
- Python 3.11 이상
- npm
- MongoDB 연결 문자열
- Redis
- Gemini API key

Windows 로컬 개발 환경에서는 PowerShell 기준 명령을 사용합니다.

## 환경 변수

루트 `.env` 파일을 만들고 다음 값을 설정합니다.

```env
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=110
GEMINI_GENERATE_TIMEOUT_SECONDS=110
GEMINI_IMAGE_TIMEOUT_SECONDS=110
CHROMA_DB_PATH=.chroma
MONGO_DB=mongodb+srv://...
SESSION_SECRET=change-this-secret
USER_API_KEY_ENCRYPTION_SECRET=base64_or_hex_encoded_32_byte_secret
FASTAPI_BASE_URL=http://127.0.0.1:8000
FRONTEND_DEV_URL=http://127.0.0.1:5173
REDIS_URL=redis://127.0.0.1:6379
PORT=3000
```

주요 변수:

- `GEMINI_MODEL`: 사용할 Gemini 모델명
- `GEMINI_TIMEOUT_SECONDS`: Gemini 요청 기본 timeout
- `GEMINI_GENERATE_TIMEOUT_SECONDS`: 문구 생성 전용 timeout
- `GEMINI_IMAGE_TIMEOUT_SECONDS`: 이미지 분석 전용 timeout
- `CHROMA_DB_PATH`: ChromaDB 저장 경로
- `MONGO_DB`: MongoDB 연결 문자열
- `SESSION_SECRET`: 세션 서명용 비밀값
- `USER_API_KEY_ENCRYPTION_SECRET`: 사용자별 Gemini API 키 암호화용 32바이트 secret, base64 또는 64자 hex 형식
- `FASTAPI_BASE_URL`: Express 서버가 호출할 FastAPI 주소
- `FRONTEND_DEV_URL`: 개발 중 Vite dev server 주소
- `REDIS_URL`: BullMQ 작업 큐용 Redis 주소
- `PORT`: Express 서버 포트, 기본값 `3000`

`NODE_ENV=production`에서는 기본 `SESSION_SECRET`을 사용할 수 없으며 서버 시작이 실패합니다.
`NODE_ENV=production`에서는 `USER_API_KEY_ENCRYPTION_SECRET`도 반드시 설정해야 합니다.
개발 환경에서 이 값이 없으면 사용자별 API 키 저장 기능은 비활성화되고 서버 로그에 설정 안내가 출력됩니다.

## 설치

### 1. Python 가상환경 생성

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

PowerShell 실행 정책 오류가 나면 현재 세션에서만 다음 명령을 실행합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 2. Python 의존성 설치

```powershell
pip install -r requirements.txt
```

### 3. 루트 Node 의존성 설치

```powershell
npm install
```

### 4. 프론트엔드 의존성 설치

```powershell
cd frontend
npm install
cd ..
```

### 5. 프론트엔드 빌드

production 방식으로 Express 서버에서 정적 파일을 제공하려면 빌드가 필요합니다.

```powershell
cd frontend
npm run build
cd ..
```

## Redis 실행

비동기 생성 작업은 Redis 기반 BullMQ를 사용합니다. Windows에서는 Docker 사용을 권장합니다.

```powershell
docker run --name ovms-redis -p 6379:6379 -d redis:7
```

이미 컨테이너가 있으면 다음 명령으로 시작합니다.

```powershell
docker start ovms-redis
```

## 개발 서버 실행

개발 중에는 FastAPI, Express, worker, Vite dev server를 한 번에 실행할 수 있습니다. Redis는 별도로 먼저 실행되어 있어야 합니다.

```powershell
npm.cmd run dev
```

브라우저 접속 주소:

```text
http://127.0.0.1:3000
```

주의: `http://127.0.0.1:8000`은 FastAPI 내부 AI 서버입니다. 실제 UI는 항상 `3000`으로 접속합니다.

## 개별 실행

### FastAPI AI 서버

```powershell
cd C:\2026-1-Capstone-T02-ai-viral-marketing
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Express 인증/API 서버

```powershell
cd C:\2026-1-Capstone-T02-ai-viral-marketing
npm.cmd start
```

### Node 생성 Worker

```powershell
cd C:\2026-1-Capstone-T02-ai-viral-marketing
npm.cmd run worker
```

## 검증 명령

### 서버 타입체크

```powershell
npm.cmd run typecheck:server
```

### 프론트엔드 타입체크

```powershell
npm.cmd --prefix frontend run typecheck
```

### FastAPI 문법 확인

```powershell
python -m compileall backend
```

### 전체 Node/Frontend 테스트

```powershell
npm.cmd test
```

### 서버 API 테스트만 실행

```powershell
npm.cmd run test:server
```

### 프론트엔드 테스트만 실행

```powershell
npm.cmd --prefix frontend run test
```

### FastAPI 테스트

```powershell
python -m pytest
```

## API 요약

### Express API

- `GET /api/csrf-token`: CSRF token 발급
- `GET /api/auth/session`: 현재 로그인 상태 확인
- `POST /api/auth/signup`: 회원가입
- `POST /api/auth/login`: 로그인
- `POST /api/auth/logout`: 로그아웃
- `POST /api/generation-jobs`: 공식 문구 생성 API. 비동기 생성 job 생성
- `GET /api/generation-jobs/:id`: 생성 job 상태 조회
- `POST /api/generation-jobs/:id/retry`: 실패한 생성 job 재시도
- `POST /api/generate`: 더 이상 지원하지 않는 legacy API. `410 Gone`을 반환
- `GET /api/generations`: 저장된 생성 결과 목록 조회
- `GET /api/generations/:id`: 저장된 생성 결과 상세 조회
- `POST /api/analyze-image`: 이미지 분석

### FastAPI 내부 API

- `GET /health`: 상태 확인
- `POST /internal/generate`: 내부 문구 생성 API
- `POST /internal/analyze-image`: 내부 이미지 분석 API

## 동작 흐름

1. 사용자가 `http://127.0.0.1:3000`으로 접속합니다.
2. React UI는 Express 서버를 통해 제공됩니다.
3. 회원가입 또는 로그인은 Express 서버와 MongoDB에서 처리됩니다.
4. 사용자가 문구 생성을 요청하면 Express 서버가 `ai_jobs`에 job을 저장하고 Redis 큐에 등록합니다.
5. Node worker가 Redis 큐에서 job을 가져와 FastAPI `/internal/generate`를 호출합니다.
6. FastAPI는 Gemini와 ChromaDB 예시 검색을 사용해 문구를 생성합니다.
7. worker는 생성 결과를 MongoDB `generations` 컬렉션에 저장하고 job 상태를 `succeeded`로 갱신합니다.
8. 프론트엔드는 job 상태를 polling하다가 완료되면 저장 결과 상세 화면으로 이동합니다.

## 문제 해결

### `{"detail":"Not Found"}`만 보임

FastAPI 주소인 `http://127.0.0.1:8000`에 접속했을 가능성이 높습니다. 브라우저는 `http://127.0.0.1:3000`으로 접속하세요.

### `EADDRINUSE: address already in use :::3000`

3000 포트를 다른 프로세스가 사용 중입니다.

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
npm.cmd start
```

### `Frontend build not found`

`frontend/dist`가 없거나 오래된 상태입니다.

```powershell
cd frontend
npm install
npm run build
cd ..
```

### 로그인이 필요하다는 응답이 보임

보호된 페이지 또는 API는 로그인 후 사용할 수 있습니다. 먼저 회원가입 또는 로그인을 진행하세요.

### CSRF token 오류

페이지를 새로고침한 뒤 다시 시도하세요. 계속 발생하면 Express 서버가 같은 세션 저장소를 사용하고 있는지 확인하세요.

### Redis 연결 오류

비동기 생성 job을 큐에 등록하지 못합니다. Redis 컨테이너가 실행 중인지 확인하세요.

```powershell
docker start ovms-redis
```

### Gemini API 오류

`.env`의 `GEMINI_MODEL`, timeout 설정과 사용자별 Gemini API 키 등록 상태를 확인하세요.

### MongoDB 연결 오류

`.env`의 `MONGO_DB` 연결 문자열과 네트워크 접근 권한을 확인하세요.

## 참고

- `server/index.ts`는 Express 서버 엔트리포인트이므로 `.ts` 파일이 맞습니다.
- React 컴포넌트는 `frontend/src/**/*.tsx`에 있습니다.
- 업로드한 원본 이미지는 저장하지 않으며, 이미지 분석 결과만 문구 생성 입력으로 사용합니다.
## 개인 Gemini API 키 운영

로그인 사용자는 상단 메뉴의 설정 화면(`/settings`)에서 본인의 Gemini API 키를 등록, 조회, 삭제할 수 있습니다. 서버는 API 키 원문을 MongoDB에 저장하지 않고 `USER_API_KEY_ENCRYPTION_SECRET`으로 AES-256-GCM 암호화한 값과 마지막 4자리(`keyPreview`) 같은 metadata만 저장합니다. API 키 원문은 저장 후 다시 화면이나 API 응답으로 표시되지 않습니다.

배포 환경에는 다음 값을 반드시 검토해 설정합니다.

```env
USER_API_KEY_ENCRYPTION_SECRET=base64_or_hex_encoded_32_byte_secret
```

- `USER_API_KEY_ENCRYPTION_SECRET`: 사용자별 Gemini API 키 암호화용 32바이트 secret입니다. base64 또는 64자 hex 형식으로 설정합니다. `NODE_ENV=production`에서는 이 값이 없으면 Express 서버 시작이 실패합니다.
- 사용자가 설정 화면에서 Gemini API 키를 등록해야 문구 생성과 이미지 분석을 사용할 수 있습니다. 키가 없으면 “설정에서 Gemini API 키를 등록해 주세요.” 안내와 함께 요청이 거부됩니다.
- 서버 공용 `GEMINI_API_KEY` fallback은 사용하지 않습니다. `.env`에 `GEMINI_API_KEY`를 설정하지 마세요.

암호화 secret 생성 예:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

secret은 배포 환경 변수 저장소에만 보관하고 저장소에 커밋하지 마세요. secret을 교체하면 기존에 암호화되어 저장된 사용자 API 키를 복호화할 수 없으므로, 교체 전 사용자 키 재등록 계획을 세워야 합니다.
