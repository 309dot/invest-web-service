# MGK Dashboard

Next.js 14 프로젝트 with Firebase, shadcn/ui, and TypeScript

## 기술 스택

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Charts**: Recharts
- **HTTP Client**: Axios
- **Data Fetching**: SWR
- **Date Utilities**: date-fns
- **Icons**: lucide-react

## 설치된 shadcn/ui 컴포넌트

- Button
- Card
- Table
- Badge
- Tabs
- Alert
- Skeleton

## 시작하기

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

`.env.local.example` 파일을 `.env.local`로 복사하고 Firebase 설정을 추가하세요:

```bash
cp .env.local.example .env.local
```

Firebase Console에서 프로젝트를 생성하고 설정 값을 `.env.local` 파일에 입력하세요.

### 4. AI 어드바이저 환경 변수

GPT-oss 기반 AI 어드바이저 기능을 사용하려면 다음 환경 변수를 추가로 설정하세요.

```
GPT_OSS_API_KEY="발급받은 API 키"
GPT_OSS_MODEL=gpt-oss-20b
AI_ADVISOR_DEFAULT_PERIOD=7

# (선택) 클라이언트에서 기본 기간을 노출하려면 아래도 설정
NEXT_PUBLIC_AI_ADVISOR_DEFAULT_PERIOD=7
```

> **주의**
> - GPT-oss 계정에서 API 키를 발급받은 뒤 `.env.local`에 추가합니다.
> - 환경 변수를 수정한 뒤에는 `npm run dev`를 재시작해야 적용됩니다.
> - 키가 없으면 `/api/ai-advisor` 호출 시 500 에러가 발생합니다.

### 3. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## 프로젝트 구조

```
mgk-dashboard/
├── app/                    # Next.js App Router 페이지
│   ├── globals.css        # 글로벌 스타일
│   ├── layout.tsx         # 루트 레이아웃
│   ├── page.tsx           # 메인 대시보드
│   ├── weekly-reports/    # 주간 리포트 & AI 타임라인
│   └── api/               # API Routes
│       ├── collect-price/ # 주가 수집 API
│       ├── stats/         # 통계 API
│       ├── ai-advisor/    # AI 어드바이저 실행 & 히스토리 (history/)
│       └── weekly-reports/# 주간 리포트 목록 API
├── components/            # React 컴포넌트
│   └── ui/               # shadcn/ui 컴포넌트
├── lib/                   # 라이브러리 및 유틸리티
│   ├── firebase.ts       # Firebase 초기화
│   ├── firestore.ts      # Firestore CRUD 헬퍼
│   ├── apis/             # 외부 API 연동
│   │   ├── alphavantage.ts  # 주가 API
│   │   ├── exchangerate.ts  # 환율 API
│   │   └── news.ts          # 뉴스 RSS API
│   └── utils/            # 유틸리티 함수
│       ├── calculations.ts  # 계산 함수
│       ├── formatters.ts    # 포맷팅 함수
│       └── validators.ts    # 검증 함수
├── types/                 # TypeScript 타입 정의
│   └── index.ts
├── public/               # 정적 파일
└── .env.local           # 환경 변수 (gitignore됨)
```

## Firebase 설정

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성
2. Authentication, Firestore, Storage 활성화
3. 웹 앱 추가하여 설정 정보 획득
4. `.env.local` 파일에 설정 정보 추가

## 스크립트

- `npm run dev` - 개발 서버 시작
- `npm run build` - 프로덕션 빌드
- `npm run start` - 프로덕션 서버 시작
- `npm run lint` - ESLint 실행
- `npm run advisor:test` - 로컬 서버 구동 중 `/api/ai-advisor` 호출 테스트 (curl & jq 필요)

## 추가 컴포넌트 설치

shadcn/ui에서 추가 컴포넌트가 필요한 경우:

```bash
npx shadcn@latest add [component-name]
```

## 배포 및 테스트

1. 환경 변수 설정 (`.env.local`, Firebase Functions config)
2. `npm install && npm run build`
3. Functions: `cd functions && npm install && npm run deploy`
4. 스케줄러 검증: Firebase console에서 실행 로그 확인
5. 로컬 테스트: `npm run advisor:test`, `/api/generate-report` 호출로 AI 파이프라인 확인

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
