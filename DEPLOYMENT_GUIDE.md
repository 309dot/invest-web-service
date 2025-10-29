# 배포 가이드

## 🎉 프로젝트 완료!

개인 주식 관리 시스템 12주 계획 100% 완료

---

## 📋 배포 단계

### 1단계: Git 커밋 및 푸시

```bash
# 터미널에서 다음 명령어를 순서대로 실행하세요:

# 1. Xcode 라이센스 동의 (맥에서 처음 Git 사용 시)
sudo xcodebuild -license
# 'agree'를 입력하고 엔터

# 2. 프로젝트 디렉토리로 이동
cd /Users/user/Documents/project/App/invest-web-service

# 3. Git 상태 확인
git status

# 4. 모든 변경사항 추가
git add .

# 5. 커밋
git commit -m "feat: 개인 주식 관리 시스템 100% 완료

✨ 주요 기능
- 다중 종목 포트폴리오 관리
- 한국/미국 주식 통합 검색 (Alpha Vantage)
- 거래 관리 시스템 (매수/매도/이력)
- 잔액 관리 (KRW/USD)
- 포트폴리오 분석 (섹터/지역/리스크)
- 리밸런싱 시뮬레이터
- 다중 종목 비교 차트
- 개인화 뉴스 (감성/영향도 분석)
- AI 포트폴리오 진단
- AI 종목 분석
- PWA 지원 & 모바일 최적화

🔒 보안
- Firestore Rules 프로덕션용 업데이트
- Google OAuth 인증
- 사용자별 데이터 분리

📱 모바일
- 반응형 UI (전체 페이지)
- 터치 제스처 (스와이프)
- PWA manifest.json
- 모바일 최적화"

# 6. GitHub에 푸시
git push origin main
```

---

### 2단계: Vercel 환경 변수 설정

Vercel 대시보드(https://vercel.com/309dots-projects)에서 다음 환경 변수를 설정하세요:

#### 필수 변수

```bash
# Firebase 설정 (필수)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Alpha Vantage (주식 검색용 - 필수)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
```

#### 선택 변수 (AI 기능용)

```bash
GPT_OSS_API_KEY=your_gpt_oss_key
GPT_OSS_MODEL=gpt-oss-20b
GPT_OSS_ENDPOINT=https://api.gpt-oss.wiz.ai/v1/chat/completions
AI_ADVISOR_DEFAULT_PERIOD=7
```

---

### 3단계: Vercel 프로젝트 설정

#### 설정값:

- **Framework Preset**: Next.js
- **Root Directory**: `mgk-dashboard`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`
- **Node.js Version**: 18.x

---

### 4단계: Firebase Rules 배포

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

### 5단계: 로컬 테스트 (선택)

```bash
cd /Users/user/Documents/project/App/invest-web-service/mgk-dashboard

# 빌드 테스트
npm run build

# 로컬 실행
npm start
```

---

## 🔍 배포 후 확인 사항

### ✅ 기능 체크리스트

1. **로그인**
   - [ ] Google 로그인 버튼 클릭
   - [ ] 로그인 후 대시보드 이동
   - [ ] 로그아웃 동작

2. **대시보드**
   - [ ] 포트폴리오 데이터 로딩
   - [ ] 잔액 표시
   - [ ] 반응형 동작 (모바일/데스크톱)

3. **주식 검색**
   - [ ] 검색 기능
   - [ ] 자동완성
   - [ ] 종목 추가

4. **거래**
   - [ ] 거래 추가
   - [ ] 거래 이력 조회
   - [ ] 거래 삭제

5. **분석**
   - [ ] 포트폴리오 분석 페이지
   - [ ] 차트 표시
   - [ ] 리밸런싱 시뮬레이터

6. **뉴스**
   - [ ] 개인화 뉴스 표시
   - [ ] 필터링
   - [ ] 감성 분석 표시

---

## 🐛 문제 해결

### Firebase 연결 에러
**증상**: "Firebase API key not found"
**해결**: Vercel 환경 변수에 `NEXT_PUBLIC_FIREBASE_*` 모두 설정 확인

### 주식 검색 에러
**증상**: "Failed to search stocks"
**해결**: `ALPHA_VANTAGE_API_KEY` 환경 변수 확인

### 빌드 에러
**증상**: Type error during build
**해결**: 로컬에서 `npm run build` 실행해서 에러 확인

### Firestore 권한 에러
**증상**: "Missing or insufficient permissions"
**해결**: Firebase Console에서 Rules 배포 확인

---

## 📞 도움이 필요하면

1. Vercel 배포 로그 확인: Dashboard > Deployments > 클릭 > Logs
2. Firebase Console 확인: https://console.firebase.google.com
3. 브라우저 콘솔 확인: F12 → Console 탭

---

## 🎊 완료!

모든 단계를 완료하면 배포가 완료됩니다!

배포 URL: https://your-project.vercel.app

