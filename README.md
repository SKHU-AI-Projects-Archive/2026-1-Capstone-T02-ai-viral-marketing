# AI Viral Marketing

상품 정보를 입력하면 Gemini API를 호출해 한국어 커뮤니티 후기 톤의 마케팅 문구를 생성하는 프로젝트입니다.  
백엔드는 FastAPI로 `/generate` API를 제공하고, 프론트엔드는 React + TypeScript + Vite로 구성되어 있습니다.  
생성 결과는 로컬 Chroma DB에 저장되며, 이후 유사한 요청이 들어오면 이전 예시를 참고해 응답에 반영합니다.

## 기술 스택

- Backend: FastAPI, Pydantic, httpx, python-dotenv
- Frontend: React, TypeScript, Vite
- Storage: ChromaDB
- AI: Google Gemini API

## 프로젝트 구조

```text
.
├─ backend/
│  ├─ ai.py
│  ├─ main.py
│  ├─ schemas.py
│  ├─ vector_store.py
│  └─ __init__.py
├─ frontend/
│  ├─ public/
│  ├─ src/
│  ├─ index.html
│  ├─ package.json
│  ├─ tsconfig.json
│  └─ vite.config.ts
├─ .env
├─ requirements.txt
└─ README.md
```

## 주요 기능

- 상품명, 키워드, 상품 설명을 입력해 마케팅 문구 생성
- `POST /generate` API를 통한 백엔드 처리
- Gemini API 응답을 한국어 3문장 이하의 짧은 후기 스타일 문구로 유도
- 생성 결과를 ChromaDB에 저장
- 유사 상품 요청 시 이전 생성 예시를 조회해 프롬프트에 반영
- 빌드된 프론트엔드 정적 파일을 FastAPI에서 함께 제공

## 동작 방식

1. 사용자가 프론트엔드 폼에 상품명, 키워드, 설명을 입력합니다.
2. 프론트엔드가 `/generate`로 JSON 요청을 보냅니다.
3. 백엔드는 ChromaDB에서 유사한 예시를 조회합니다.
4. 백엔드는 조회 결과를 포함한 프롬프트로 Gemini API를 호출합니다.
5. 생성된 결과를 ChromaDB에 저장한 뒤 응답합니다.
6. 프론트엔드는 반환된 문구를 화면에 표시합니다.

## 사전 요구 사항

- Python 3.11 이상 권장
- Node.js 18 이상 권장
- npm
- Gemini API 키

## 설치 및 실행

### 1. Python 가상환경 생성

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

PowerShell 실행 정책 오류가 있으면 아래 명령을 먼저 실행합니다.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 2. 백엔드 의존성 설치

```powershell
pip install -r requirements.txt
```

### 3. 프론트엔드 의존성 설치

```powershell
cd frontend
npm install
cd ..
```

### 4. 환경 변수 설정

루트 경로에 `.env` 파일을 두고 아래 값을 설정합니다.

```env
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=8
CHROMA_DB_PATH=.chroma
```

설명:

- `GEMINI_API_KEY`: Gemini API 인증 키
- `GEMINI_MODEL`: 호출할 Gemini 모델명
- `GEMINI_TIMEOUT_SECONDS`: API 요청 타임아웃
- `CHROMA_DB_PATH`: Chroma 영구 저장 디렉토리 경로

### 5. 프론트엔드 빌드

현재 백엔드는 `frontend/dist` 정적 파일을 서빙합니다. 따라서 실행 전에 프론트엔드를 한 번 빌드해야 합니다.

```powershell
cd frontend
npm run build
cd ..
```

### 6. 서버 실행

```powershell
uvicorn backend.main:app --reload
```

정상 실행 후 접속 주소:

```text
http://127.0.0.1:8000
```

## 프론트엔드 개발

프론트엔드만 따로 개발하려면 아래 명령을 사용할 수 있습니다.

```powershell
cd frontend
npm run dev
```

타입 체크:

```powershell
cd frontend
npm run typecheck
```

주의:

- FastAPI는 `frontend/dist`를 읽기 때문에, 백엔드에서 최신 UI를 보려면 `npm run build`를 다시 실행해야 합니다.

## API 명세

### `POST /generate`

요청 본문:

```json
{
  "name": "보온 물병",
  "keywords": ["보온", "가벼움", "가성비"],
  "summary": "국내 생산 스테인리스 물병"
}
```

응답:

```json
{
  "generated_text": "가볍고 보온도 꽤 잘돼서 평소 들고 다니기 편했어요. 스테인리스 재질이라 마감도 깔끔한 편이고, 가격 대비 만족도가 높았습니다."
}
```

에러 응답 예시:

```json
{
  "detail": "GEMINI_API_KEY environment variable is not set."
}
```

## 현재 구현 기준 참고 사항

- `/` 요청 시 `frontend/dist/index.html`이 없으면 `503`을 반환합니다.
- `/assets` 경로는 빌드 결과물의 정적 에셋을 제공합니다.
- `/favicon.ico`는 빌드된 `favicon.svg`를 반환합니다.
- `/generate` 실패 시 원인에 따라 `502` 또는 `500`을 반환합니다.
- 벡터 검색은 외부 임베딩 API가 아니라 프로젝트 내부의 간단한 해시 기반 임베딩으로 동작합니다.

## 트러블슈팅

- `Frontend build not found. Run npm install and npm run build in the frontend directory.`
  - `frontend`에서 `npm install`과 `npm run build`를 실행해야 합니다.

- `GEMINI_API_KEY environment variable is not set.`
  - 루트 `.env` 파일에 `GEMINI_API_KEY`가 설정되어 있는지 확인합니다.

- `Failed to connect to Gemini API. Check network/proxy settings.`
  - 네트워크 접근 또는 프록시 설정을 확인합니다.

- `Gemini request timed out.`
  - 네트워크 상태를 확인하거나 `GEMINI_TIMEOUT_SECONDS` 값을 늘립니다.

- `No module named 'chromadb'`
  - `pip install -r requirements.txt`를 다시 실행합니다.

## 개선 여지

- 백엔드와 프론트엔드 개발 서버 분리 및 프록시 설정
- 테스트 코드 추가
- 실제 임베딩 모델 도입
- 생성 결과 이력 조회 기능 추가
