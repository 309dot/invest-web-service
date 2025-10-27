
# 🔥 MGK Dashboard - Firebase 완전 독립 시스템 PRD (v2)

> 버전: **v2**  
> 변경 요약: 기존 PRD에 **GPT-oss 기반 AI 어드바이저 모듈**(AI 주식 전문가)을 통합하는 섹션을 추가했습니다.  
> 목적: MGK Dashboard 내에서 자동화된 투자 인사이트·뉴스 요약·투자 권고를 제공하여 사용자 의사결정을 돕습니다.

---

## 📌 프로젝트 개요 (요약)
**Google Sheets 없이 Firebase로 완전 독립적인 투자 추적 시스템**에 AI 어드바이저를 추가합니다.

기존 핵심 스택:
```
Frontend: Next.js 14 + TypeScript + shadcn/ui
Backend: Firebase (Firestore, Cloud Functions, Auth)
외부 API: Alpha Vantage, ExchangeRate-API, Google News RSS
```

---

## 🔁 변경 사항 (v2 주요 추가)
### Step 16: AI 어드바이저 모듈 (GPT-oss 통합)
목표: Firestore에 수집된 가격·거래·뉴스 데이터를 바탕으로 GPT-oss 모델을 호출하여 **요약 / 인사이트 / 행동 권고**를 생성하고, 이를 대시보드 및 주간 리포트에 포함합니다.

### 16.1 아키텍처 개요
```
외부 API (AlphaVantage, RSS) → Firestore (dailyPurchases, newsItems, weeklyReports)
       ↓
Next.js API (/api/ai-advisor) ← Cloud Functions 트리거 선택 가능
       ↓
GPT-oss 모델 호출 (gpt-oss-20b 또는 gpt-oss-120b)
       ↓
AI 결과 저장 → Firestore.weeklyReports.aiAdvice 또는 aiInsights 컬렉션
       ↓
UI: Dashboard / Reports / Email 알림 등에 노출
```

### 16.2 API: `/app/api/ai-advisor/route.ts` (예시)
- 역할: 최근 데이터 집계 → 프롬프트 구성 → GPT-oss 호출 → 결과 저장/반환
- 입력: period (7d/30d), tickers (optional)
- 출력: `{ advice: string, summary: string, signals: {...} }`

**환경변수 (추가)**:
```
GPT_OSS_API_KEY
GPT_OSS_MODEL (gpt-oss-20b | gpt-oss-120b)
AI_ADVISOR_DEFAULT_PERIOD=7
```

### 16.3 샘플 프롬프트 설계 (프롬프트 엔지니어링)
```
너는 10년 경력의 주식 애널리스트야.
다음 JSON 데이터(가격시계열, 주요 뉴스, 설정 값)를 바탕으로
- 주간 요약 (3~4문장)
- 핵심 뉴스와 영향 (각 뉴스 1문장)
- 위험 신호 (명확한 이유와 함께)
- 다음 주 권장 전략 (명확하고 간단하게, 3가지 항목)

데이터:
{ ...최근 7일 dailyPurchases 요약..., ...top 5 newsItems... , settings... }

출력 포맷(JSON):
{
  "weeklySummary": "...",
  "newsHighlights": ["...", "..."],
  "signals": { "sellSignal": true, "reason": "..." },
  "recommendations": ["...", "...", "..."]
}
```

### 16.4 저장 구조 (Firestore 확장)
- `weeklyReports.{week}.aiAdvice` (문자열 또는 구조화된 JSON)
- 또는 별도 컬렉션 `aiInsights`:
```json
{
  "generatedAt": timestamp,
  "period": "2024-10-14_to_2024-10-20",
  "weeklySummary": "...",
  "newsHighlights": [...],
  "signals": {...},
  "recommendations": [...],
  "sourceReportId": "2024-W42"
}
```

### 16.5 UI 반영
- 대시보드에 **AI 코멘트 카드** 추가:
  - 제목: "💬 AI 어드바이저 (v2)"
  - 내용: weeklySummary + 주요 추천(최대 3줄)
  - 버튼: "상세 리포트 보기" → Reports 화면의 AI 섹션
  - 갱신 옵션: 매주 자동 또는 수동 '지금 생성' 버튼

- 주간 리포트 카드에 AI 섹션 표기:
  - AI 요약(짧은 문장)
  - 신뢰도(간단한 점수: 0-100; 내부 스코어링 가능)

### 16.6 자동화 (스케줄)
- Cloud Functions Cron (예)
  - 매주 일요일 20:00 → `/api/generate-report` → `/api/ai-advisor` 호출
  - daily-update 후 자동 트리거(옵션): 가격수집 후 AI 분석 실행

### 16.7 프라이버시·안전·한계 표기
- UI에 명확히 표기: “AI가 제공하는 인사이트는 보조적이며 오류가 있을 수 있습니다.”
- 민감정보 미포함(사용자 개인 식별자 저장 금지)
- 로그: automationLogs에 AI 호출 결과(성공/실패/응답 길이) 저장

### 16.8 비용·요구사항 고려사항
- 호출 빈도에 따라 API 사용 비용/리소스 고려
- 모델 선택: 실시간 짧응답용은 gpt-oss-20b, 대규모 배치·정밀 분석은 gpt-oss-120b 권장
- 응답 길이/시간 제한 고려 (타임아웃, 재시도 로직)

---

## 🔧 통합 개발 가이드 (간단)
1. `/app/api/ai-advisor/route.ts` 생성 및 테스트 엔드포인트 구현  
2. Firestore에서 테스트용 데이터(최근 7일)를 집계하는 헬퍼 작성  
3. GPT-oss 호출 함수 작성 (타임아웃/에러 핸들링 포함)  
4. AI 응답 파싱 및 `weeklyReports` 또는 `aiInsights`에 저장  
5. UI 카드 추가 및 표시 (Skeleton, 에러 표시, 수동 새로고침 버튼)  
6. Cloud Functions로 정기 실행 트리거 추가

---

## ✅ 기타 기존 PRD 내용 (요약)
(원본 PRD의 Step 0 ~ Step 15 내용은 v1과 동일하게 유지. 외부 API 연동, Next.js 구조, Firebase 설정, 차트, 뉴스 섹션 등 그대로 적용.)

---

## 🚀 배포 및 릴리스 노트 (v2)
- 파일명: `invest-web_prd_v2.md`
- 변경: AI 어드바이저 모듈 추가
- 권장 릴리스 절차:
  1. dev 브랜치에 PRD v2 반영
  2. AI 모듈은 feature/ai-advisor 브랜치로 개발
  3. 내부 테스트(스테이징) → 모델 비용/성능 확인 → 프로덕션 배포

---

## 📎 참조: 환경변수 체크리스트 (v2)
```
# 기존
NEXT_PUBLIC_FIREBASE_API_KEY
...
ALPHA_VANTAGE_API_KEY
EXCHANGE_RATE_API_KEY

# AI 관련 추가
GPT_OSS_API_KEY
GPT_OSS_MODEL
AI_ADVISOR_DEFAULT_PERIOD
```

---

필요하시면 이 파일을 바로 **다운로드 가능한 Markdown 파일 (invest-web_prd_v2.md)** 로 저장해두었습니다.
