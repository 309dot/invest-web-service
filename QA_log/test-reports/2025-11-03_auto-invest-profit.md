# 2025-11-03 QA: 자동 투자 & 손익 계산 검증

## 테스트 항목
1. 미래 일자 거래 차단 (`/api/transactions` POST)
2. 국내 종목 통화 표기 확인 (`069500` → KRW)
3. 자동 투자 예정 카드 표시/상태 전환
4. 손익률 소수점 표시 및 음수 색상 확인

## 사전 준비
- 로컬 서버 실행: `npm run dev`
- 로그인 후 `transactions` 페이지 접속

## 시나리오

### 1) 미래·주말 일자 거래 차단/보정
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "portfolioId": "test-user_default",
    "positionId": "test-user_default_BRK-B",
    "type": "buy",
    "symbol": "BRK-B",
    "shares": 0.1,
    "price": 450,
    "amount": 45,
    "date": "2030-01-01",
    "currency": "USD"
  }'
```
- [ ] 응답 400, 메시지 `미래 일자는 거래로 기록할 수 없습니다.`

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "portfolioId": "test-user_default",
    "positionId": "test-user_default_NVDA",
    "type": "buy",
    "symbol": "NVDA",
    "shares": 0.1,
    "price": 450,
    "amount": 45,
    "date": "2025-11-01",
    "currency": "USD"
  }'
```
- [ ] 저장된 거래 날짜가 직전 거래일(예: `2025-10-31`)로 자동 보정됨
- [ ] `/api/transactions` 응답의 `displayDate`가 한국 시각 기준(M+1일)으로 반환되는지 확인
- [ ] 거래 화면에서 주말(토/일) 날짜가 표시되지 않는지 확인

### 2) 국내 종목 통화 표기
- `069500` 자동 투자 거래 확인
- [ ] 거래 목록 금액·총 금액이 `원` 단위로 표시 (예: `₩697,740`)
- [ ] 통계 카드 KRW 영역 합산 값도 원 단위 유지

### 3) 자동 투자 예정 카드
- 자동 투자 스케줄이 있는 포지션에서 다음 실행일을 오늘로 설정
- `/api/transactions` 호출 없이 `transactions` 페이지 새로고침
  - [ ] 상단 카드에 `오늘 예정` 배지와 안내 문구 노출
- 자동 생성 트리거 후(스케줄 또는 수동 실행), 페이지 새로고침
  - [ ] 동일 항목이 `구매 완료` 배지로 전환
- 다음 실행일이 내일인 스케줄 생성 후 페이지 확인
  - [ ] 카드에 `예정` 배지와 `YYYY-MM-DD에 자동 투자 예정` 문구 표시
- [ ] 동일 날짜 자동 투자 거래가 중복 생성되지 않는지 확인 (재생성 후 Firestore 검사)
- [ ] 자동 투자 카드가 오늘 날짜(한국 시각 기준)를 정확히 표시하는지 확인

### 4) 손익 표시 확인
- 포트폴리오에 ±0.1% 이하 손익 종목 준비 (예: 가격 조정)
- [ ] `PortfolioOverview` 카드에서 `-0.01%`처럼 최소 단위 표시
- [ ] 음수 수익률/손익 금액이 붉은색, 양수는 녹색으로 노출
- [ ] `portfolio/analysis` 화면 상단에 기준 통화 카드와 통화별 카드가 노출되고, 국내 자산 카드가 원화 기준으로 표시되는지 확인
- [ ] 리밸런싱 시뮬레이터/자동 리밸런싱 제안에서 국내 종목 금액이 원화로 유지되는지 확인

### 5) 잔액 차감 및 부족 알림
- KRW 포지션 매수 거래 등록
  - [ ] `/api/balance?portfolioId=...` 호출 시 KRW 잔액이 거래 금액(+수수료·세금)만큼 감소
- USD 포지션 매도 거래 등록
  - [ ] USD 잔액이 순 매도 금액만큼 증가 (수수료/세금 제외)
- 잔액 부족 시도 (USD 잔액 < 필요 금액)
  - [ ] `/api/transactions` 응답 400, 메시지 `잔액이 부족합니다.`
  - [ ] 서버 로그에 `[Balance Alert]` 메시지 출력 확인
- 거래 삭제 시
  - [ ] 해당 통화 잔액이 원복되는지 확인 (매수 → 환급, 매도 → 차감)

### 6) 거래 실행 시간 노출
- 거래 입력 모달에서 `거래 시간` 변경 후 등록
  - [ ] Firestore `transactions` 문서에 `executedAt` ISO 문자열 저장
  - [ ] 거래 목록 테이블/모바일 카드/삭제 모달에서 시간 표시 확인 (`HH:mm:ss`)
- 자동 투자 생성 후 거래 확인
  - [ ] `executedAt`가 생성 시각으로 기록되고 목록에 표시

### 7) 손익 오차 QA 스크립트
- 로컬 서버 실행 후:
```bash
npm run qa:profit --
```
- [ ] `⚠️` 로그가 없으면 오차 없음 → 성공 케이스
- [ ] 차이 발생 시 스크립트가 종목·차이 금액·비율을 출력하는지 확인


## 참고 커맨드
```bash
# 빌드 검증
npm run build

# 환율 연계 QA 스크립트 (기존)
npm run qa:consistency
```
