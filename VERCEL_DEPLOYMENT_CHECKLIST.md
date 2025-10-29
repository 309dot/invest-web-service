# ✅ Vercel 배포 체크리스트

## 🎉 Git 푸시 완료!

**커밋 해시**: `dec5044`
**브랜치**: `main`
**저장소**: https://github.com/309dot/invest-web-service.git

---

## 📋 다음 단계: Vercel 배포

### 1️⃣ Vercel 대시보드 접속

https://vercel.com/309dots-projects 로 이동

---

### 2️⃣ 프로젝트 설정

#### 새 프로젝트 생성 (처음인 경우)

1. **"New Project"** 클릭
2. **Import Git Repository** → GitHub 연결
3. **invest-web-service** 저장소 선택

#### 기존 프로젝트 사용 (이미 있는 경우)

1. 기존 프로젝트 선택
2. **Settings** 탭으로 이동

---

### 3️⃣ 프로젝트 설정값

**Framework Preset**: `Next.js`

**Root Directory**: `mgk-dashboard`

**Build Settings**:
```
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

**Node.js Version**: `18.x`

---

### 4️⃣ 환경 변수 설정 (중요! ⚠️)

**Settings** → **Environment Variables**로 이동하여 다음 변수들을 추가하세요:

#### 필수 변수 (Firebase)

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=invest-web-service
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

**Firebase 설정 찾는 방법**:
1. https://console.firebase.google.com 접속
2. **invest-web-service** 프로젝트 선택
3. **⚙️ 프로젝트 설정** → **일반** 탭
4. 하단 **내 앱** 섹션에서 웹 앱 선택
5. **Firebase SDK 구성** 복사

#### 필수 변수 (Alpha Vantage)

```bash
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

**API 키 받는 방법**:
1. https://www.alphavantage.co/support/#api-key 접속
2. 무료 API 키 신청 (이메일 입력)
3. 받은 키 입력

#### 선택 변수 (AI 기능용)

```bash
GPT_OSS_API_KEY=your_gpt_oss_key
GPT_OSS_MODEL=gpt-oss-20b
GPT_OSS_ENDPOINT=https://api.gpt-oss.wiz.ai/v1/chat/completions
AI_ADVISOR_DEFAULT_PERIOD=7
```

💡 **팁**: AI 기능을 사용하지 않으면 생략 가능합니다.

---

### 5️⃣ 배포 실행

#### 자동 배포 (추천)

Git push하면 자동으로 Vercel이 배포를 시작합니다.

**Deployments** 탭에서 진행 상황 확인!

#### 수동 배포

**Deployments** → **Redeploy** 클릭

---

### 6️⃣ 배포 후 확인

배포가 완료되면 Vercel이 URL을 제공합니다:
```
https://your-project-name.vercel.app
```

#### 기능 테스트 체크리스트

**✅ 기본 기능**
- [ ] 페이지 로딩 (홈페이지)
- [ ] Google 로그인 버튼 표시
- [ ] 로그인 동작
- [ ] 대시보드 표시

**✅ 주요 기능**
- [ ] 주식 검색 (AAPL, GOOGL 등 검색)
- [ ] 종목 추가
- [ ] 거래 추가
- [ ] 거래 이력 조회
- [ ] 포트폴리오 분석 페이지
- [ ] 뉴스 페이지

**✅ 모바일 테스트**
- [ ] 모바일에서 페이지 로딩
- [ ] 반응형 레이아웃
- [ ] 터치 동작
- [ ] PWA 설치 가능 (홈 화면에 추가)

---

### 7️⃣ Firebase Rules 배포

터미널에서 다음 명령어 실행:

```bash
# Firebase CLI 설치 (처음만)
npm install -g firebase-tools

# Firebase 로그인
firebase login

# Firestore Rules 배포
cd /Users/user/Documents/project/App/invest-web-service
firebase deploy --only firestore:rules
```

---

## 🐛 문제 해결

### 빌드 에러

**증상**: "Module not found" 또는 "Type error"

**해결**:
1. 로컬에서 테스트: `cd mgk-dashboard && npm run build`
2. 에러 메시지 확인 후 수정
3. Git 커밋 및 푸시

---

### Firebase 연결 에러

**증상**: "Firebase: Error (auth/invalid-api-key)"

**해결**:
1. Vercel 환경 변수 확인
2. `NEXT_PUBLIC_` 접두사 확인
3. Firebase Console에서 키 재확인
4. 환경 변수 저장 후 **Redeploy**

---

### 주식 검색 작동 안 함

**증상**: "Failed to search stocks"

**해결**:
1. `ALPHA_VANTAGE_API_KEY` 환경 변수 확인
2. API 키 유효성 확인 (https://www.alphavantage.co에서)
3. 일일 요청 한도 확인 (무료 플랜: 25 requests/day)

---

### Firestore 권한 에러

**증상**: "Missing or insufficient permissions"

**해결**:
1. Firebase Console → Firestore Database → Rules 확인
2. 터미널에서 Rules 배포: `firebase deploy --only firestore:rules`
3. 배포 완료 확인

---

## 📊 배포 모니터링

### Vercel Analytics

**Settings** → **Analytics** → Enable

- 페이지 뷰 추적
- 성능 모니터링
- 에러 트래킹

### Firebase Console

https://console.firebase.google.com/u/0/project/invest-web-service

- **Authentication**: 사용자 수 확인
- **Firestore**: 데이터베이스 사용량
- **Usage and Billing**: 요금 확인

---

## 🎊 배포 완료!

모든 단계를 완료하면 앱이 정상적으로 배포됩니다!

**배포 URL**: https://your-project.vercel.app

**GitHub**: https://github.com/309dot/invest-web-service

**Firebase**: https://console.firebase.google.com/project/invest-web-service

---

## 📞 추가 도움

**Vercel 로그 확인**:
- Dashboard → Deployments → [특정 배포] → Logs

**Firebase 로그 확인**:
- Console → Firestore → Usage 탭

**브라우저 콘솔 확인**:
- F12 → Console 탭

---

## 🚀 다음 단계 (옵션)

1. **커스텀 도메인 연결**
   - Vercel Settings → Domains
   - 본인 소유 도메인 연결

2. **Analytics 설정**
   - Google Analytics 연동
   - Vercel Analytics 활성화

3. **성능 최적화**
   - Lighthouse 점수 확인
   - 이미지 최적화
   - 캐싱 전략 개선

4. **모니터링 설정**
   - Sentry 연동 (에러 트래킹)
   - Uptime monitoring

---

**작성일**: 2025-10-29
**상태**: Git 푸시 완료, Vercel 배포 대기 ⏳

