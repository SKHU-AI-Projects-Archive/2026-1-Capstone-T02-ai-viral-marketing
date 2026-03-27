# OVMS MVP

사용자가 상품 정보를 입력하면 Gemini API를 호출해 커뮤니티 스타일의 마케팅 문구를 생성하는 FastAPI 기반 MVP입니다. 생성 이력은 Chroma Vector DB에 저장되며, 이후 유사한 상품 요청이 들어오면 과거 예시를 참고해 응답 품질을 보완합니다.

## 프로젝트 구조

```text
backend/
  ai.py
  main.py
  schemas.py
frontend/
  app.js
  favicon.svg
  index.html
  style.css
requirements.txt
README.md
```

## 주요 기능

- 상품명, 키워드, 상품 설명 입력
- `POST /generate` API로 문구 생성
- 생성 결과를 로컬 Chroma Vector DB에 저장
- 유사한 과거 생성 예시를 조회해 프롬프트에 반영
- FastAPI 서버가 프론트 정적 파일도 함께 제공

## 실행 방법

### 1. Python 버전 확인

- 권장: Python 3.11+

```powershell
python --version
```

### 2. 가상환경 생성 및 활성화 (Windows PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

실행 정책 오류가 나면 아래 1회 실행 후 다시 활성화하세요.

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### 3. 의존성 설치

```powershell
pip install -r requirements.txt
```

### 4. 환경 변수 설정 (`.env`)

프로젝트 루트에 `.env` 파일을 만들고 아래처럼 입력합니다.

```env
GEMINI_API_KEY=여기에_키_입력
GEMINI_MODEL=gemini-2.5-flash
GEMINI_TIMEOUT_SECONDS=8
```

선택 사항:

```env
CHROMA_DB_PATH=.chroma
```

### 5. 서버 실행

```powershell
uvicorn backend.main:app --reload
```

혹은

```powershell
uvicorn backend.main:app --reload --reload-dir backend --reload-dir frontend --reload-exclude ".venv/*" --log-level debug
```

정상 실행 시 예시:

```text
Uvicorn running on http://127.0.0.1:8000
```

### 6. 브라우저 접속

```text
http://127.0.0.1:8000
```

## API 사용 예시

### 요청

`POST /generate`

```json
{
  "name": "보온 물병",
  "keywords": ["보온", "가벼움", "가성비"],
  "summary": "국내 생산 스테인리스 물병"
}
```

### 응답

```json
{
  "generated_text": "생성된 마케팅 문구"
}
```

## 트러블슈팅

- `GEMINI_API_KEY environment variable is not set.`
  - `.env`에 `GEMINI_API_KEY`가 있는지 확인
- `No module named 'chromadb'`
  - `pip install -r requirements.txt`로 Chroma 의존성 재설치
- `Gemini quota exceeded or rate-limited.`
  - API 키의 사용량/결제 한도 확인 필요
- `GET /favicon.ico 404`
  - 현재 `frontend/favicon.svg`를 제공하므로 새로고침 후 사라져야 함
- `/.well-known/appspecific/com.chrome.devtools.json 404`
  - Chrome DevTools 내부 요청으로 보통 무시 가능
