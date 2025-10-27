# E2E 검증 체크리스트

## 1. 환경 변수 설정
- `.env.local`을 생성해 Firebase 및 API 키 입력
- `firebase functions:config:set` 명령으로 Functions에서 필요한 키 저장 (예: `alphavantage.key`, `exchange.key`, `gpt.key`)

## 2. 데이터 시드/확인
- Firestore에 `dailyPurchases`, `newsItems` 컬렉션이 있는지 확인
- 초기 데이터가 없다면 최소 7일 치 dummy 데이터를 업로드하거나 API를 통해 수집

## 3. 로컬 앱 검증
- `npm install && npm run dev`
- 대시보드 주요 위젯(가격, 뉴스, AI 카드, 워치리스트) 정상 노출 확인
- `/api/generate-report` POST 호출 → 응답으로 리포트와 AI 인사이트 반환 확인

## 4. Functions 배포 및 스케줄러
- `cd functions && npm install`
- `npm run deploy`로 Functions 배포
- Firebase 콘솔 → Functions → Logs에서 `collectPriceJob`, `collectNewsJob`, `generateWeeklyReportJob` 실행 여부 확인

## 5. 데이터 연동 확인
- Firestore에 `priceSnapshots`, `newsItems`, `weeklyReports`, `aiInsights` 데이터가 누적되는지 검증
- 대시보드 `/weekly-reports` 페이지에서 최신 리포트와 AI 인사이트 노출 확인

## 6. 배포
- Vercel 등 호스팅 환경에 배포 (`npm run build && npm run start` 검증 후)
- 배포 후 주요 페이지 헬스체크 및 에러 모니터링 설정
