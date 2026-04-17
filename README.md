# AI Viral Marketing

제품 정보를 입력하고 이미지를 분석해 마케팅 문구를 생성하는 프로젝트입니다.

현재 구조는 다음처럼 나뉩니다.

- `backend`: FastAPI 기반 AI 서버
- `server`: Node.js + Express 기반 인증/세션 서버
- `frontend`: React + TypeScript + Vite 기반 UI

실제 사용자는 `Node` 서버에 접속하고, `Node` 서버가 로그인/회원가입/세션을 처리한 뒤 내부적으로 `FastAPI` AI 서버를 호출합니다.

## 현재 아키텍처

- 브라우저 접속 주소: `http://127.0.0.1:3000`
- 내부 AI 서버 주소: `http://127.0.0.1:8000`

역할 분리:

- `http://127.0.0.1:3000`
  - 회원가입
  - 로그인
  - 세션 24시간 유지
  - 로그인한 사용자만 문구 생성 페이지와 API 접근 가능
  - React 빌드 결과물 서빙

- `http://127.0.0.1:8000`
  - 내부 AI API 제공
  - 이미지 분석
  - 마케팅 문구 생성

중요:

- 브라우저는 `8000`이 아니라 반드시 `3000`으로 접속해야 합니다.
- `8000`은 내부 AI 서버라 웹페이지가 아니라 API/안내 메시지만 제공합니다.

## 프로젝트 구조

```text
.
├─ backend/
│  ├─ ai.py
│  ├─ main.py
│  ├─ schemas.py
│  ├─ vector_store.py
│  └─ __init__.py
├─ server/
│  ├─ bcryptjs.d.ts
│  ├─ express-session.d.ts
│  └─ index.ts
├─ frontend/
│  ├─ public/
│  ├─ src/
│  ├─ index.html
│  └─ package.json
├─ .env
├─ package.json
├─ requirements.txt
├─ tsconfig.server.json
└─ README.md
```

## 기술 스택

- Backend AI: FastAPI, Pydantic, httpx, python-dotenv
- Auth Server: Node.js, Express, TypeScript, express-session, connect-mongo
- Frontend: React, TypeScript, Vite
- Database: MongoDB, ChromaDB
- AI: Google Gemini API

## 주요 기능

- 회원가입
  - 사용자 정보를 MongoDB `users` DB의 `user` 컬렉션에 저장
- 로그인
  - 이메일/비밀번호 검증
  - 세션 24시간 부여
- 접근 제어
  - 로그인해야만 문구 생성 페이지(`/generate`) 접근 가능
  - 로그인해야만 문구 생성 API와 이미지 분석 API 호출 가능
- 이미지 분석
  - JPG, PNG, WEBP 업로드
  - 최대 4MB 제한
- 마케팅 문구 생성
  - 제품명, 키워드, 요약, 이미지 분석 결과를 기반으로 생성

## 사전 준비

- Python 3.11 이상 권장
- Node.js 18 이상 권장
- npm
- MongoDB 연결 문자열
- Gemini API Key

## 환경 변수

루트 `.env` 파일에 아래 값을 설정합니다.

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=8
CHROMA_DB_PATH=.chroma
MONGO_DB=mongodb+srv://...
SESSION_SECRET=change-this-secret
FASTAPI_BASE_URL=http://127.0.0.1:8000
PORT=3000
```

설명:

- `GEMINI_API_KEY`: Gemini API 키
- `GEMINI_MODEL`: 사용할 Gemini 모델명
- `GEMINI_TIMEOUT_SECONDS`: Gemini 요청 타임아웃
- `CHROMA_DB_PATH`: ChromaDB 저장 경로
- `MONGO_DB`: MongoDB 연결 문자열
- `SESSION_SECRET`: 세션 서명용 비밀값
- `FASTAPI_BASE_URL`: Node 서버가 호출할 FastAPI 주소
- `PORT`: Node 서버 포트, 기본값 `3000`

## 설치

### 1. Python 가상환경 생성 및 활성화

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

PowerShell 실행 정책 오류가 나면 먼저:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 2. Python 의존성 설치

```powershell
pip install -r requirements.txt
```

### 3. 루트 Node 의존성 설치

인증 서버용 패키지를 설치합니다.

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

Node 인증 서버는 `frontend/dist` 정적 파일을 서빙하므로 빌드가 필요합니다.

```powershell
cd frontend
npm run build
cd ..
```

## 서버 켜는 방법

서버는 2개를 켜야 합니다.

### 터미널 1: FastAPI AI 서버 실행

```powershell
cd C:\2026-1-Capstone-T02-ai-viral-marketing
.\.venv\Scripts\Activate.ps1
uvicorn backend.main:app --reload
```

실행 주소:

```text
http://127.0.0.1:8000
```

주의:

- 이 주소는 내부 AI 서버입니다.
- 브라우저에서 실제 페이지를 보려면 `3000`으로 접속해야 합니다.

### 터미널 2: Node 인증 서버 실행

```powershell
cd C:\2026-1-Capstone-T02-ai-viral-marketing
npm.cmd start
```

실행 주소:

```text
http://127.0.0.1:3000
```

PowerShell에서 `npm start`가 꼬이거나 `npm.ps1` 관련 문제가 나면 `npm.cmd start`를 사용하면 됩니다.

### 브라우저 접속

```text
http://127.0.0.1:3000
```

## 서버 끄는 방법

### 가장 일반적인 방법

각 서버를 실행한 터미널에서 `Ctrl + C`

- FastAPI 서버 터미널에서 `Ctrl + C`
- Node 서버 터미널에서 `Ctrl + C`

### 포트가 남아 있을 때 강제 종료

#### 3000 포트(Node 서버) 종료

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

#### 8000 포트(FastAPI 서버) 종료

```powershell
Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## 개발 중 자주 쓰는 명령

### 프론트 타입 체크

```powershell
cd frontend
npm run typecheck
cd ..
```

### 서버 타입 체크

```powershell
npm run typecheck:server
```

### 프론트 재빌드

UI를 수정한 뒤 Node 서버에서 최신 화면을 반영하려면 다시 빌드합니다.

```powershell
cd frontend
npm run build
cd ..
```

## API 요약

### Node 인증 서버 API

- `GET /api/auth/session`
  - 현재 로그인 상태 확인
- `POST /api/auth/signup`
  - 회원가입
- `POST /api/auth/login`
  - 로그인
- `POST /api/auth/logout`
  - 로그아웃
- `POST /api/generate`
  - 로그인 필요
  - 마케팅 문구 생성
- `POST /api/analyze-image`
  - 로그인 필요
  - 이미지 분석

### FastAPI 내부 API

- `GET /health`
  - 헬스체크
- `POST /internal/generate`
  - 내부 문구 생성 API
- `POST /internal/analyze-image`
  - 내부 이미지 분석 API

## 동작 흐름

1. 사용자가 `http://127.0.0.1:3000`으로 접속합니다.
2. React UI는 Node 인증 서버가 서빙합니다.
3. 회원가입/로그인은 Node 서버에서 처리합니다.
4. 로그인 성공 시 MongoDB 세션이 저장됩니다.
5. 사용자가 문구 생성 또는 이미지 분석을 요청하면 Node 서버가 세션을 검사합니다.
6. 인증된 요청만 FastAPI 내부 API로 전달됩니다.
7. FastAPI가 Gemini/ChromaDB 로직을 처리한 뒤 결과를 Node 서버에 반환합니다.
8. Node 서버가 브라우저에 최종 응답을 전달합니다.

## 문제 해결

### 1. `{"detail":"Not Found"}`만 보임

원인:

- `http://127.0.0.1:8000`으로 접속했을 가능성이 큽니다.

해결:

- 브라우저를 `http://127.0.0.1:3000`으로 열어야 합니다.

### 2. `EADDRINUSE: address already in use :::3000`

원인:

- 이미 Node 서버가 `3000` 포트를 사용 중입니다.

해결:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
npm.cmd start
```

### 3. `Frontend build not found`

원인:

- `frontend/dist`가 없거나 오래된 상태입니다.

해결:

```powershell
cd frontend
npm install
npm run build
cd ..
```

### 4. `로그인이 필요합니다.`

원인:

- 로그인하지 않고 보호된 페이지/API에 접근한 경우입니다.

해결:

- 먼저 회원가입 또는 로그인 후 다시 시도합니다.

### 5. `GEMINI_API_KEY` 관련 오류

원인:

- `.env`에 Gemini API 키가 없거나 잘못 설정된 경우입니다.

해결:

- 루트 `.env` 파일의 `GEMINI_API_KEY` 값을 확인합니다.

### 6. `MONGO_DB` 관련 오류

원인:

- MongoDB 연결 문자열이 없거나 잘못된 경우입니다.

해결:

- `.env`의 `MONGO_DB`를 확인합니다.

## 현재 기준 실행 체크리스트

실행 전에 확인:

- `.env` 설정 완료
- `pip install -r requirements.txt` 완료
- 루트 `npm install` 완료
- `frontend/npm install` 완료
- `frontend/npm run build` 완료

실행 중 확인:

- FastAPI 서버가 `8000`에서 실행 중
- Node 서버가 `3000`에서 실행 중
- 브라우저는 `3000`으로 접속

## 참고

- `server/index.ts`는 JSX를 쓰는 파일이 아니라 Express 서버 엔트리포인트이므로 `.tsx`가 아니라 `.ts`가 맞습니다.
- React 컴포넌트 파일은 `frontend/src/*.tsx`에 있습니다.
