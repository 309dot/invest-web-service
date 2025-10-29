# 🚀 Vercel 배포 설정 가이드

## 📌 현재 상태

- ✅ Git 푸시 완료 (커밋: `8b4f36c`)
- ✅ Package.json 수정 (recharts 중복 제거, React 버전 명시)
- ✅ Vercel.json 설정 개선
- ⏳ Vercel 프로젝트 설정 필요

**프로젝트 URL**: https://vercel.com/309dots-projects/invest-web-service

---

## 🔧 Vercel 대시보드 설정

### 1단계: 프로젝트 설정 확인

1. https://vercel.com/309dots-projects/invest-web-service 접속
2. **Settings** 탭 클릭

---

### 2단계: Root Directory 설정 ⚠️ (중요!)

**Settings** → **General** → **Root Directory**

```
mgk-dashboard
```

✅ **"Include source files outside of the Root Directory in the Build Step" 체크**

---

### 3단계: Build & Development Settings

**Settings** → **General** → **Build & Development Settings**

#### Framework Preset
```
Next.js
```

#### Build Command (Optional - 이미 vercel.json에 설정됨)
```
npm run build
```

#### Output Directory (Optional)
```
.next
```

#### Install Command (Optional)
```
npm install --legacy-peer-deps
```

💡 **팁**: `vercel.json`에 이미 설정되어 있으므로 비워두면 자동으로 적용됩니다.

---

### 4단계: 환경 변수 설정 🔑 (필수!)

**Settings** → **Environment Variables**

다음 환경 변수를 **모든 환경(Production, Preview, Development)**에 추가하세요:

#### Firebase 설정 (필수)

| Key | Value | 찾는 방법 |
|-----|-------|----------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `your_api_key` | Firebase Console → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `invest-web-service.firebaseapp.com` | Firebase Console → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `invest-web-service` | Firebase Console → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `invest-web-service.appspot.com` | Firebase Console → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `your_sender_id` | Firebase Console → 프로젝트 설정 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `your_app_id` | Firebase Console → 프로젝트 설정 |

#### Firebase 설정 찾는 방법:
1. https://console.firebase.google.com/u/0/project/invest-web-service 접속
2. **⚙️ 프로젝트 설정** 클릭
3. **일반** 탭으로 이동
4. 하단 **내 앱** 섹션에서 웹 앱 찾기
5. **Firebase SDK snippet** → **구성** 선택
6. 표시된 값들을 복사

#### Alpha Vantage API (필수)

| Key | Value | 찾는 방법 |
|-----|-------|----------|
| `ALPHA_VANTAGE_API_KEY` | `your_api_key` | https://www.alphavantage.co/support/#api-key |

**API 키 받는 방법**:
1. https://www.alphavantage.co/support/#api-key 접속
2. 이메일 입력
3. 무료 API 키 받기
4. 이메일 확인

#### AI 기능 (선택사항)

| Key | Value |
|-----|-------|
| `GPT_OSS_API_KEY` | `your_gpt_oss_key` |
| `GPT_OSS_MODEL` | `gpt-oss-20b` |
| `GPT_OSS_ENDPOINT` | `https://api.gpt-oss.wiz.ai/v1/chat/completions` |
| `AI_ADVISOR_DEFAULT_PERIOD` | `7` |

💡 **AI 기능을 사용하지 않으면 생략 가능합니다.**

---

### 5단계: Node.js 버전 설정

**Settings** → **General** → **Node.js Version**

```
18.x
```

---

### 6단계: Git 연결 확인

**Settings** → **Git**

- ✅ Repository: `309dot/invest-web-service`
- ✅ Production Branch: `main`
- ✅ Auto Deploy: 활성화

---

## 🚀 배포 시작

### 자동 배포

Git push하면 자동으로 배포가 시작됩니다! (이미 push 완료)

**Deployments** 탭에서 진행 상황을 확인하세요.

### 수동 배포 (필요시)

1. **Deployments** 탭으로 이동
2. 최신 배포 선택
3. **"Redeploy"** 클릭

---

## 🐛 예상되는 에러 및 해결방법

### 에러 1: "Cannot find module 'recharts'"

**원인**: npm 의존성 설치 실패

**해결**:
1. Vercel 대시보드 → Settings → General
2. Install Command를 명시적으로 설정:
   ```
   npm install --legacy-peer-deps
   ```
3. Redeploy

---

### 에러 2: "Firebase: Error (auth/invalid-api-key)"

**원인**: 환경 변수 누락 또는 잘못된 값

**해결**:
1. Settings → Environment Variables 확인
2. 모든 `NEXT_PUBLIC_FIREBASE_*` 변수 확인
3. Firebase Console에서 값 재확인
4. **중요**: 환경 변수 수정 후 반드시 **Redeploy** 필요!

---

### 에러 3: "Module not found: Can't resolve 'firebase'"

**원인**: 빌드 중 의존성 문제

**해결**:
1. 로컬에서 테스트:
   ```bash
   cd mgk-dashboard
   rm -rf node_modules .next
   npm install --legacy-peer-deps
   npm run build
   ```
2. 성공하면 Vercel에서도 성공해야 함
3. 실패하면 에러 메시지 확인 후 패키지 버전 조정

---

### 에러 4: "Root Directory not found"

**원인**: Root Directory 설정 오류

**해결**:
1. Settings → General → Root Directory
2. 정확히 `mgk-dashboard` 입력 (앞뒤 공백 없이)
3. "Include source files outside of the Root Directory" 체크
4. Save 후 Redeploy

---

### 에러 5: "Failed to compile"

**원인**: TypeScript 또는 ESLint 에러

**해결**:
1. Deployment 로그 확인
2. 로컬에서 테스트:
   ```bash
   npm run lint
   npm run build
   ```
3. 에러 수정 후 Git push

---

## 📊 배포 후 확인사항

### ✅ 체크리스트

배포가 완료되면 다음을 확인하세요:

- [ ] **기본 접속**: 배포 URL 접속 확인
- [ ] **로그인 페이지**: `/login` 접속 확인
- [ ] **Google 로그인**: 로그인 버튼 동작 확인
- [ ] **대시보드**: 로그인 후 대시보드 표시 확인
- [ ] **주식 검색**: 검색 기능 동작 (예: AAPL 검색)
- [ ] **환율 API**: 거래 추가 시 환율 자동 조회
- [ ] **뉴스 피드**: 뉴스 페이지 로딩
- [ ] **분석 페이지**: 차트 표시 확인
- [ ] **모바일**: 모바일 기기에서 반응형 확인

---

## 🔍 배포 로그 확인 방법

### 빌드 로그

1. **Deployments** 탭
2. 최신 배포 클릭
3. **Building** 섹션 확인
4. 에러 발생 시 빨간색으로 표시됨

### 런타임 로그

1. **Logs** 탭 (상단 메뉴)
2. 실시간 로그 확인
3. 필터 옵션: Error, Warning, Info

### 함수 로그

1. **Functions** 탭
2. API 라우트별 호출 로그
3. 에러 발생 시 스택 트레이스 확인

---

## 🎯 다음 단계

### 1. Firebase Rules 배포

Vercel 배포 후 Firestore 보안 규칙을 배포하세요:

```bash
cd /Users/user/Documents/project/App/invest-web-service
firebase deploy --only firestore:rules
```

### 2. 커스텀 도메인 연결 (선택사항)

**Settings** → **Domains**

1. 본인 소유 도메인 추가
2. DNS 설정 (A 레코드 또는 CNAME)
3. SSL 자동 적용

### 3. Analytics 활성화 (선택사항)

**Analytics** 탭

- Vercel Analytics 활성화
- 트래픽 및 성능 모니터링

---

## 📞 문제 발생 시

### Vercel Support

- 대시보드 우측 하단 **Help** 버튼
- https://vercel.com/support

### Firebase Support

- https://firebase.google.com/support

### 디버깅 팁

1. **로컬 빌드 먼저 테스트**:
   ```bash
   cd mgk-dashboard
   npm run build
   npm start
   ```

2. **환경 변수 확인**:
   - Vercel: Settings → Environment Variables
   - 모든 환경에 추가되었는지 확인

3. **캐시 클리어**:
   - Deployment → ... (점 3개) → "Clear Cache and Redeploy"

---

## 🎉 배포 완료!

모든 설정을 완료하면 다음 URL에서 앱에 접속할 수 있습니다:

```
https://invest-web-service-[random].vercel.app
```

또는 커스텀 도메인을 설정한 경우:

```
https://your-domain.com
```

---

## 📝 현재 Git 상태

**최신 커밋**: `8b4f36c`
**메시지**: "fix: package.json recharts 중복 제거 및 React 버전 명시, Vercel 설정 개선"

**변경 사항**:
- ✅ recharts 중복 제거 (2.10.3 → 2.13.3로 통합)
- ✅ React 버전 명시 (^18 → ^18.3.1)
- ✅ vercel.json 설정 개선
- ✅ package-lock.json 삭제 (재생성 필요)

---

**작성일**: 2025-10-29
**상태**: Git 푸시 완료, Vercel 설정 대기 ⏳

