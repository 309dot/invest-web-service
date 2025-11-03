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

### 4) 손익 표시 확인
- 포트폴리오에 ±0.1% 이하 손익 종목 준비 (예: 가격 조정)
- [ ] `PortfolioOverview` 카드에서 `-0.01%`처럼 최소 단위 표시
- [ ] 음수 수익률/손익 금액이 붉은색, 양수는 녹색으로 노출

## 참고 커맨드
```bash
# 빌드 검증
npm run build

# 환율 연계 QA 스크립트 (기존)
npm run qa:consistency
```
