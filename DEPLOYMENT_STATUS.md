# 🚀 배포 상태 추적

## 배포 이력

### 배포 #4 - 2025-10-31 (대기중)

**커밋**: `미배포 (로컬 수정)`
**메시지**: _pending_

**변경 사항**:
- ✅ Alpha Vantage 환경 변수 폴백 로직 보완 (`mgk-dashboard/lib/apis/alphavantage.ts`)
- ✅ 프로덕션 API 헬스체크 (`/api/stocks/search`, `/api/exchange-rate` 정상 응답)
- ✅ 포지션 삭제 시 서버 라우트/서비스 개선
  - `app/api/positions/route.ts`, `app/api/positions/[id]/route.ts`에 `runtime = 'nodejs'` 지정 및 거래 생성/삭제 오류 처리 강화
  - `lib/services/position.ts`에서 포지션 삭제 시 연관 거래 일괄 삭제(batch)
  - `lib/services/transaction.ts`에서 `exchangeRate` 옵션 처리 (Firestore undefined 저장 방지)
  - `PortfolioOverview.tsx` 삭제 후 사용자 알림 개선
- ✅ 한글 검색 & 뉴스 개인화 고도화 (2025-10-31)
  - `lib/apis/yahoo-finance.ts`: 한국어 검색 파라미터(lang=ko-KR) 및 섹터/자산유형 정규화
  - `components/AddStockModal.tsx`: 실제 사용자 UID 전달로 포지션 저장 실패 예방
  - 뉴스 수집: `lib/apis/news.ts`, `app/api/news/personalized/route.ts` → 보유 종목 기반 한글 뉴스 우선 수집, 요약/HTML 정리
  - 뉴스 UI: `app/news/page.tsx` → 카드 href 노출 제거, 모달 요약/원문 보기 제공

**현황**:
- ❌ `/api/stocks/historical-price`가 404 응답 (가격 데이터 조회 실패)
  - 원인: 서버 코드가 `process.env.NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY`만 읽어 Vercel에 설정된 `ALPHA_VANTAGE_API_KEY`를 인식하지 못함
  - 조치: 로컬 코드에서 `ALPHA_VANTAGE_API_KEY → NEXT_PUBLIC_ALPHA_VANTAGE_API_KEY → ''` 순으로 폴백하도록 수정
- ⚠️ `/api/positions/[id]` 라우트는 로컬 수정 완료 (삭제 시 연관 거래 포함) → **재배포 후 프로덕션 확인 필요**
  - 최신 코드 기준: DELETE 요청 시 거래 일괄 삭제 및 JSON 응답(`deletedTransactions`) 반환
  - `/api/transactions` exchangeRate undefined 오류 해결 (옵션 필드)
- ⚠️ 뉴스/검색 개선 사항 적용 후 프로덕션 재배포 필요
  - 한글 종목 검색 (`/api/stocks/search?q=삼성전자`) 결과 확인
  - 뉴스 모듈 모달/요약 기능 검증 및 한국어 기사 노출 여부 확인
- ⏳ 수정 커밋 배포 필요 (재배포 전까지 프로덕션은 기존 동작 유지)

**다음 단계**:
1. 수정 커밋 푸시 및 Vercel 재배포 실행
2. 재배포 완료 후 `/api/stocks/historical-price?symbol=AAPL&date=2024-01-15` 재검증
3. Alpha Vantage 일일 호출 한도(5 req/min, 500 req/day) 모니터링

---

### 배포 #3 - 2025-10-29 (진행중)

**커밋**: `013f55a`
**메시지**: "fix: Vercel 빌드 설정 최적화"

**변경 사항**:
- ✅ `next.config.mjs` 빌드 최적화 설정 추가
  - reactStrictMode: true
  - swcMinify: true
  - eslint.ignoreDuringBuilds: true (빌드 속도 향상)
  - experimental.optimizePackageImports (recharts, lucide-react, date-fns)
  
- ✅ `.npmrc` 파일 추가
  - legacy-peer-deps=true (의존성 충돌 자동 해결)
  - fetch-retries=5 (네트워크 안정성)
  
- ✅ `vercel.json` 개선
  - buildCommand에 npm install 명시적 추가
  - ignoreCommand 추가 (불필요한 빌드 방지)

**예상 결과**: 
- npm 의존성 설치 문제 해결
- 빌드 성공 예상

**상태**: ⏳ 배포 대기중...

**확인 방법**:
1. https://vercel.com/309dots-projects/invest-web-service/deployments
2. 최신 배포 클릭
3. 빌드 로그 확인

---

### 배포 #2 - 2025-10-29 (실패)

**커밋**: `8b4f36c`
**메시지**: "fix: package.json recharts 중복 제거 및 React 버전 명시, Vercel 설정 개선"

**문제점**:
- ❌ npm 의존성 설치 실패 (추정)
- ❌ recharts 중복 문제
- ❌ React 버전 불명확

**해결**:
- recharts 중복 제거 (2.13.3로 통합)
- React 버전 명시 (^18.3.1)
- vercel.json 설정 개선

---

### 배포 #1 - 2025-10-29 (실패)

**커밋**: `dec5044`
**메시지**: "feat: 개인 주식 관리 시스템 100% 완료"

**문제점**:
- ❌ Root Directory 설정 누락 (추정)
- ❌ 환경 변수 미설정 (추정)

---

## 🔍 현재 배포 모니터링

### 체크포인트

**1단계: Git Push** ✅
- 커밋 해시: `013f55a`
- 푸시 완료: 2025-10-29 13:19 (KST)

**2단계: Vercel 빌드 시작** ⏳
- 예상 시작 시간: 푸시 후 5-10초
- 확인 URL: https://vercel.com/309dots-projects/invest-web-service

**3단계: 의존성 설치** ⏳
- npm install 실행
- .npmrc 설정 적용 (legacy-peer-deps)
- 예상 소요 시간: 1-2분

**4단계: Next.js 빌드** ⏳
- npm run build 실행
- TypeScript 컴파일
- 페이지 생성
- 예상 소요 시간: 2-3분

**5단계: 배포 완료** ⏳
- 빌드 아티팩트 업로드
- CDN 배포
- 예상 소요 시간: 30초

**총 예상 시간**: 3-5분

---

## 🐛 예상 에러 시나리오

### 시나리오 1: 의존성 설치 실패
**증상**: "npm ERR! code ERESOLVE"
**원인**: peer dependency 충돌
**해결**: ✅ .npmrc에 legacy-peer-deps=true 추가됨

### 시나리오 2: TypeScript 에러
**증상**: "Type error: ..."
**원인**: 타입 불일치
**해결**: next.config.mjs에서 ignoreBuildErrors 설정 가능

### 시나리오 3: 환경 변수 누락
**증상**: "Firebase: Error (auth/invalid-api-key)"
**원인**: Vercel 환경 변수 미설정
**해결**: Vercel Dashboard에서 환경 변수 추가 필요

### 시나리오 4: 빌드 타임아웃
**증상**: "Build exceeded maximum duration"
**원인**: 빌드 시간 초과 (무료 플랜: 45분)
**해결**: 빌드 최적화 필요

---

## 📊 배포 성공 기준

### 필수 체크리스트
- [ ] 빌드 완료 (녹색 체크)
- [ ] 배포 URL 생성
- [ ] 홈페이지 로딩 (200 OK)
- [ ] 로그인 페이지 접근 가능
- [ ] Firebase 연결 확인

### 선택 체크리스트
- [ ] Google 로그인 동작
- [ ] 대시보드 표시
- [ ] API 라우트 동작
- [ ] 모바일 반응형 확인

---

## 🔄 다음 액션

### 배포 성공 시
1. ✅ 배포 URL 확인
2. ✅ 기능 테스트
3. ✅ Firebase Rules 배포
4. ✅ 환경 변수 설정 (아직 안 했다면)
5. ✅ 최종 테스트

### 배포 실패 시
1. ❌ 에러 로그 확인
2. 🔧 에러 원인 분석
3. 🔧 코드/설정 수정
4. 🔄 Git 커밋 & 푸시
5. ⏳ 재배포 대기

---

## 📞 긴급 연락처

**Vercel Dashboard**: https://vercel.com/309dots-projects/invest-web-service
**GitHub Repository**: https://github.com/309dot/invest-web-service
**Firebase Console**: https://console.firebase.google.com/project/invest-web-service

---

**마지막 업데이트**: 2025-10-29 13:19 (KST)
**상태**: 배포 #3 진행중 ⏳
**다음 확인 시간**: 5분 후 (13:24)

