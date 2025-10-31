# 🧪 Vercel API 테스트 가이드

## 📋 목차
1. [Vercel 배포 상태 확인](#1-vercel-배포-상태-확인)
2. [테스트 스크립트 사용법](#2-테스트-스크립트-사용법)
3. [수동 API 테스트](#3-수동-api-테스트)
4. [API 엔드포인트 목록](#4-api-엔드포인트-목록)
5. [문제 해결](#5-문제-해결)

---

## 1. Vercel 배포 상태 확인

### 1-1. Vercel 대시보드 접속

1. **Vercel 대시보드 열기**
   ```
   https://vercel.com/309dots-projects/invest-web-service
   ```

2. **최신 배포 확인**
   - **Deployments** 탭 클릭
   - 가장 최근 배포 항목 확인
   - 상태 확인:
     - ✅ **Ready** (녹색): 배포 성공
     - ⏳ **Building** (노란색): 빌드 중
     - ❌ **Error** (빨간색): 배포 실패

3. **배포 URL 확인**
   - 배포 항목 클릭
   - 상단에 **Visit** 버튼 → 배포 URL 확인
   - 예: `https://invest-web-service-xxxxx.vercel.app`

### 1-2. 빌드 로그 확인

배포가 실패했거나 문제가 있을 경우:

1. 실패한 배포 항목 클릭
2. **Building** 탭 클릭
3. 로그 확인:
   - npm install 에러
   - TypeScript 컴파일 에러
   - Next.js 빌드 에러

---

## 2. 테스트 스크립트 사용법

### 2-1. 간단 테스트 (Bash)

**사용법**:
```bash
# 실행 권한 부여 (처음 한 번만)
chmod +x test-api-simple.sh

# 테스트 실행
./test-api-simple.sh https://your-project.vercel.app
```

**예시**:
```bash
./test-api-simple.sh https://invest-web-service-xxxxx.vercel.app
```

**출력 예시**:
```
🚀 Vercel API 간단 테스트
🌐 URL: https://invest-web-service-xxxxx.vercel.app
⏰ 시작: 2025-10-31 14:30:00
==========================================

📋 [1] 기본 페이지 테스트
🧪 테스트: 홈페이지
✅ 성공 (200)

🧪 테스트: 로그인 페이지
✅ 성공 (200)

...

==========================================
📊 테스트 결과 요약
==========================================
✅ 성공: 8/10
❌ 실패: 2/10
📈 성공률: 80.0%
⏰ 종료: 2025-10-31 14:30:15
==========================================
```

### 2-2. 상세 테스트 (Node.js)

**사용법**:

1. **스크립트 수정**:
   ```javascript
   // test-vercel-api.js 파일 열기
   const VERCEL_URL = 'https://your-project.vercel.app'; // 여기를 수정!
   ```

2. **테스트 실행**:
   ```bash
   node test-vercel-api.js
   ```

3. **결과 확인**:
   - 콘솔에 실시간 출력
   - `test-results-YYYY-MM-DD.json` 파일 생성

**JSON 결과 파일 예시**:
```json
{
  "testDate": "2025-10-31T05:30:00.000Z",
  "vercelUrl": "https://invest-web-service-xxxxx.vercel.app",
  "summary": {
    "total": 20,
    "success": 18,
    "fail": 2,
    "error": 0,
    "successRate": "90.0%"
  },
  "performance": {
    "avgDuration": "245ms",
    "maxDuration": "1200ms",
    "minDuration": "50ms"
  },
  "results": [...]
}
```

---

## 3. 수동 API 테스트

### 3-1. 브라우저에서 테스트

**기본 페이지 접근**:
```
https://your-project.vercel.app
https://your-project.vercel.app/login
https://your-project.vercel.app/portfolio/analysis
```

**API 엔드포인트 (GET)**:
```
https://your-project.vercel.app/api/stocks/search?query=AAPL
https://your-project.vercel.app/api/exchange-rate?from=USD&to=KRW
https://your-project.vercel.app/api/positions
```

### 3-2. curl로 테스트

**GET 요청**:
```bash
# 주식 검색
curl "https://your-project.vercel.app/api/stocks/search?query=AAPL"

# 환율 조회
curl "https://your-project.vercel.app/api/exchange-rate?from=USD&to=KRW"

# 포지션 목록
curl "https://your-project.vercel.app/api/positions"
```

**POST 요청**:
```bash
# 포지션 추가
curl -X POST "https://your-project.vercel.app/api/positions" \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "AAPL",
    "shares": 10,
    "purchasePrice": 150.00
  }'
```

### 3-3. Postman/Insomnia로 테스트

1. **컬렉션 생성**
2. **요청 추가**:
   - GET `/api/stocks/search?query=AAPL`
   - GET `/api/positions`
   - POST `/api/positions`
   - GET `/api/transactions`
3. **환경 변수 설정**:
   - `BASE_URL`: `https://your-project.vercel.app`

---

## 4. API 엔드포인트 목록

### 4-1. 주식 관련 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/stocks/search` | GET | 주식 검색 | `query` (string) |
| `/api/stocks/master` | GET | 주식 마스터 데이터 조회 | - |
| `/api/stocks/historical-price` | GET | 역사적 가격 조회 | `symbol`, `date` |

**예시**:
```bash
# 주식 검색
GET /api/stocks/search?query=AAPL
GET /api/stocks/search?query=삼성전자

# 역사적 가격
GET /api/stocks/historical-price?symbol=AAPL&date=2025-10-24
```

### 4-2. 포지션 관련 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/positions` | GET | 포지션 목록 조회 | - |
| `/api/positions` | POST | 포지션 추가 | Body (JSON) |
| `/api/positions/[id]` | GET | 특정 포지션 조회 | `id` (path) |
| `/api/positions/[id]` | PUT | 포지션 수정 | `id` (path), Body |
| `/api/positions/[id]` | DELETE | 포지션 삭제 | `id` (path) |

**예시**:
```bash
# 포지션 목록
GET /api/positions

# 특정 포지션
GET /api/positions/main_AAPL

# 포지션 삭제
DELETE /api/positions/main_AAPL
```

### 4-3. 거래 내역 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/transactions` | GET | 거래 내역 조회 | - |
| `/api/transactions` | POST | 거래 추가 | Body (JSON) |
| `/api/transactions/[id]` | DELETE | 거래 삭제 | `id` (path) |

### 4-4. 잔고 관련 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/balance` | GET | 잔고 조회 | - |
| `/api/balance` | POST | 입출금/환전 | Body (JSON) |

### 4-5. 분석 관련 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/portfolio/analysis` | GET | 포트폴리오 분석 | - |
| `/api/stats` | GET | 통계 조회 | - |

### 4-6. 뉴스 및 리포트 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/news/personalized` | GET | 개인화 뉴스 | - |
| `/api/weekly-reports` | GET | 주간 리포트 조회 | - |

### 4-7. AI 관련 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/ai/portfolio-diagnosis` | POST | AI 포트폴리오 진단 | Body (JSON) |
| `/api/ai/stock-analysis` | POST | AI 종목 분석 | Body (JSON) |
| `/api/ai-advisor` | GET | AI 어드바이저 조회 | - |
| `/api/ai-advisor/history` | GET | AI 어드바이저 히스토리 | - |

### 4-8. 기타 API

| 엔드포인트 | 메서드 | 설명 | 파라미터 |
|-----------|--------|------|----------|
| `/api/exchange-rate` | GET | 환율 조회 | `from`, `to` |
| `/api/watchlist` | GET | 워치리스트 조회 | - |
| `/api/collect-price` | POST | 가격 수집 (크론잡) | - |
| `/api/generate-report` | POST | 리포트 생성 (크론잡) | - |

---

## 5. 문제 해결

### 5-1. 일반적인 에러

#### ❌ 404 Not Found

**원인**:
- 잘못된 엔드포인트 경로
- 배포되지 않은 API

**해결**:
```bash
# 올바른 경로 확인
GET /api/stocks/search  ✅
GET /api/stock/search   ❌ (잘못된 경로)
```

#### ❌ 500 Internal Server Error

**원인**:
- 서버 측 에러
- Firebase 연결 실패
- 환경 변수 누락

**해결**:
1. Vercel 로그 확인
2. Firebase 환경 변수 확인
3. API 키 유효성 확인

#### ❌ 401 Unauthorized

**원인**:
- 인증 필요한 API
- Firebase Auth 토큰 누락

**해결**:
```bash
# 인증 헤더 추가
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://your-project.vercel.app/api/positions"
```

#### ❌ CORS 에러

**원인**:
- 브라우저에서 다른 도메인 접근

**해결**:
- Next.js API Routes는 기본적으로 CORS 허용
- 필요시 `next.config.mjs`에 CORS 설정 추가

### 5-2. 환경 변수 확인

**Vercel 대시보드**:
1. Settings → Environment Variables
2. 필수 변수 확인:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `ALPHA_VANTAGE_API_KEY`

**로컬 테스트**:
```bash
# .env.local 파일 확인
cat mgk-dashboard/.env.local
```

### 5-3. 빌드 에러 디버깅

**로컬 빌드 테스트**:
```bash
cd mgk-dashboard
npm run build
```

**타입 에러 확인**:
```bash
cd mgk-dashboard
npm run type-check
```

**Lint 에러 확인**:
```bash
cd mgk-dashboard
npm run lint
```

---

## 6. 테스트 체크리스트

### 6-1. 기본 기능 테스트

- [ ] 홈페이지 로딩 (`/`)
- [ ] 로그인 페이지 접근 (`/login`)
- [ ] 포트폴리오 페이지 접근 (`/portfolio/analysis`)
- [ ] 거래 내역 페이지 접근 (`/transactions`)
- [ ] 뉴스 페이지 접근 (`/news`)

### 6-2. API 기능 테스트

- [ ] 주식 검색 (AAPL)
- [ ] 주식 검색 (삼성전자)
- [ ] 환율 조회 (USD/KRW)
- [ ] 포지션 목록 조회
- [ ] 거래 내역 조회
- [ ] 잔고 조회
- [ ] 통계 조회

### 6-3. 인증 기능 테스트

- [ ] Google 로그인 버튼 표시
- [ ] Google 로그인 동작
- [ ] 로그인 후 대시보드 접근
- [ ] 로그아웃 동작

### 6-4. 데이터 CRUD 테스트

- [ ] 포지션 추가
- [ ] 포지션 조회
- [ ] 포지션 수정
- [ ] 포지션 삭제
- [ ] 거래 추가
- [ ] 거래 삭제

### 6-5. 성능 테스트

- [ ] 페이지 로딩 시간 (< 3초)
- [ ] API 응답 시간 (< 1초)
- [ ] 모바일 반응형 확인
- [ ] PWA 설치 가능 확인

---

## 7. 추가 리소스

### 7-1. 관련 문서

- [VERCEL_DEPLOYMENT_CHECKLIST.md](./VERCEL_DEPLOYMENT_CHECKLIST.md)
- [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md)
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

### 7-2. 외부 링크

- **Vercel Dashboard**: https://vercel.com/309dots-projects/invest-web-service
- **GitHub Repository**: https://github.com/309dot/invest-web-service
- **Firebase Console**: https://console.firebase.google.com/project/invest-web-service

### 7-3. 도구

- **curl**: 커맨드라인 HTTP 클라이언트
- **Postman**: API 테스트 도구 (https://www.postman.com)
- **Insomnia**: API 테스트 도구 (https://insomnia.rest)

---

**작성일**: 2025-10-31
**버전**: 1.0
**상태**: 테스트 준비 완료 ✅

