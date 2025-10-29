# 🧪 주식 관리 시스템 테스트 체크리스트

## 배포 사이트
**URL**: https://invest-web-service.vercel.app

---

## ✅ 필수 테스트 항목

### 1. 로그인 테스트
- [ ] 사이트 접속 시 로그인 페이지로 리다이렉트
- [ ] Google 로그인 버튼 클릭
- [ ] 로그인 성공 후 대시보드로 이동
- [ ] 상단에 사용자 프로필 표시

**예상 동작**: 
- 로그인 성공 → 대시보드 화면
- 프로필 이미지 원형으로 표시 (찌그러지지 않음)

---

### 2. 주식 등록 - 수동 구매 (US 주식)
- [ ] "종목 추가" 버튼 클릭
- [ ] "AAPL" 검색
- [ ] Apple Inc. 선택
- [ ] "일괄 구매" 선택
- [ ] 매수 날짜: 2024-01-15 입력
- [ ] **F12 → Console 탭 열기** ⭐
- [ ] 콘솔에서 다음 로그 확인:
  ```
  🔍 Price fetch check: { selectedStock: "AAPL", ... }
  📡 Fetching price from API...
  API URL: /api/stocks/historical-price?symbol=AAPL&date=2024-01-15&method=manual
  📊 Historical price response: { success: true, price: XXX.XX, ... }
  ✅ 가격 자동 입력 성공: $XXX.XX (종가 기준)
  ```
- [ ] 매수 가격 필드에 자동으로 숫자 입력됨 ⭐⭐⭐
- [ ] 주식 수: 10 입력
- [ ] "추가하기" 버튼 클릭
- [ ] 대시보드로 자동 이동
- [ ] AAPL이 포지션 목록에 표시됨 ⭐⭐⭐

**예상 결과**:
- 매수 가격: 자동 입력 (예: $185.50)
- 총 투자금: $1,855.00
- 보유 주식: 10주

---

### 3. 주식 등록 - 자동 투자 (US 주식)
- [ ] "종목 추가" 버튼 클릭
- [ ] "MSFT" 검색
- [ ] Microsoft 선택
- [ ] "자동 구매" 선택
- [ ] 시작 날짜: 2024-01-01 입력
- [ ] **콘솔 확인**: 가격 자동 입력 로그
- [ ] 시작일 매수 가격 필드에 자동으로 숫자 입력됨 ⭐⭐⭐
- [ ] 투자 주기: 매월
- [ ] 회당 투자 금액: 100 입력
- [ ] "추가하기" 버튼 클릭
- [ ] 대시보드에 MSFT 표시
- [ ] 거래 내역에 여러 건의 자동 구매 기록 생성됨 ⭐

**예상 결과**:
- 2024-01-01부터 오늘까지 매월 1회씩 거래 생성
- 각 거래마다 $100씩 투자
- 평균 매수가 자동 계산됨

---

### 4. 포지션 삭제 테스트
- [ ] 포지션 옆 ⋮ (점 3개) 버튼 클릭
- [ ] "포지션 삭제" 클릭
- [ ] 확인 대화상자 팝업
- [ ] "확인" 클릭
- [ ] 포지션이 목록에서 즉시 사라짐 ⭐⭐⭐
- [ ] ❌ 상세 페이지로 이동하지 않음 ⭐⭐⭐

**예상 결과**:
- 삭제 즉시 목록에서 제거
- 페이지 이동 없음

---

### 5. 한글 주식 검색 (KR 주식)
- [ ] "종목 추가" 버튼 클릭
- [ ] "삼성" 검색
- [ ] 검색 결과에 한글 종목명 표시 ⭐
- [ ] "삼성전자" 선택
- [ ] 종목 정보에 한글 이름 표시

**예상 결과**:
- 종목명: 한글로 표시 (예: "삼성전자")
- 시장: KR
- 거래소: KOSPI

---

### 6. 거래 내역 확인
- [ ] 상단 메뉴에서 "거래 이력" 클릭
- [ ] 등록한 모든 거래가 표시됨
- [ ] 자동 투자 종목의 경우 여러 건의 거래 표시
- [ ] 각 거래에 날짜, 가격, 수량 표시

---

### 7. 포트폴리오 분석
- [ ] 상단 메뉴에서 "포트폴리오 분석" 클릭
- [ ] 총 평가액, 총 투자금, 수익률 표시
- [ ] 섹터별 배분 차트 표시
- [ ] 지역별 배분 차트 표시

---

## 🐛 알려진 문제 (수정 완료)

### ✅ 해결된 문제
1. ~~autoInvestConfig undefined 에러~~ → 조건부 스프레드로 해결
2. ~~삭제 버튼 클릭 시 상세 페이지 이동~~ → stopPropagation() 추가
3. ~~매수 가격 자동 입력 UI 없음~~ → 자동 투자 섹션에 필드 추가
4. ~~타입 에러 (quarterly)~~ → AutoInvestFrequency 타입 수정

---

## 🔍 디버깅 방법

### 브라우저 콘솔 확인 (매우 중요!)
1. **F12** 또는 **우클릭 → 검사** → **Console 탭**
2. 주식 등록 시 다음 로그 확인:

```
✅ 정상:
🔍 Price fetch check: { selectedStock: "AAPL", dateToFetch: "2024-01-15", purchaseMethod: "manual", market: "US" }
📡 Fetching price from API...
API URL: /api/stocks/historical-price?symbol=AAPL&date=2024-01-15&method=manual
📊 Historical price response: { success: true, price: 185.50, date: "2024-01-15", note: "종가 기준" }
✅ 가격 자동 입력 성공: $185.50 (종가 기준)

❌ 오류 (날짜 없음):
⚠️ Missing stock or date

❌ 오류 (한국 주식):
⚠️ Not US stock, skipping auto price fetch

❌ 오류 (API 실패):
❌ 가격 조회 실패: No data for this date
```

### Network 탭 확인
1. **F12** → **Network 탭**
2. 주식 등록 시 다음 요청 확인:
   - `/api/stocks/historical-price` → Status 200
   - `/api/stocks/master` → Status 200
   - `/api/positions` → Status 200

---

## 📊 예상 데이터 흐름

### 주식 등록 (수동 구매)
```
1. 종목 검색 → /api/stocks/search
2. 날짜 선택 → useEffect 트리거
3. 가격 조회 → /api/stocks/historical-price
4. Alpha Vantage API 호출 → 종가 반환
5. 가격 필드 자동 입력 ✅
6. 폼 제출 → /api/stocks/master
7. 포지션 생성 → /api/positions
8. 거래 생성 → /api/transactions
9. 대시보드로 이동
10. 포지션 목록 새로고침 ✅
```

### 주식 등록 (자동 투자)
```
1. 종목 검색 → /api/stocks/search
2. 시작 날짜 선택 → useEffect 트리거
3. 가격 조회 → /api/stocks/historical-price (method=auto)
4. Alpha Vantage API → (시가 + 종가) / 2 반환
5. 가격 필드 자동 입력 ✅
6. 폼 제출 → /api/stocks/master
7. 포지션 생성 → /api/positions
8. 자동 거래 생성 → generateAutoInvestTransactions()
9. 시작일~오늘까지 정기 거래 일괄 생성 ✅
10. 대시보드로 이동
11. 포지션 목록 새로고침 ✅
```

---

## 🚨 긴급 확인 사항

### 만약 가격이 자동 입력되지 않는다면:

1. **콘솔 로그 확인**:
   - `⚠️ Missing stock or date` → 날짜를 먼저 선택하세요
   - `⚠️ Not US stock` → 한국 주식은 자동 입력 미지원
   - `❌ 가격 조회 실패` → Alpha Vantage API 문제 (API 키 또는 호출 제한)

2. **Network 탭 확인**:
   - `/api/stocks/historical-price` 요청 실패 → 서버 에러
   - Status 429 → API 호출 한도 초과 (Alpha Vantage 무료: 5req/min, 500req/day)
   - Status 404 → 해당 날짜 데이터 없음 (휴장일)

3. **환경 변수 확인**:
   - Vercel Dashboard → Settings → Environment Variables
   - `ALPHA_VANTAGE_API_KEY` 설정 확인

---

## 📝 테스트 결과 보고

테스트 후 다음 형식으로 보고해주세요:

```
### 테스트 결과 (날짜: 2025-10-29)

✅ 통과:
- 로그인
- 주식 검색 (US)
- ...

❌ 실패:
- 매수 가격 자동 입력 (콘솔 에러: ...)
- 원인: ...

⚠️ 경고:
- 한국 주식 가격 미지원 (예상된 동작)
- ...
```

---

## 🔧 Alpha Vantage API 확인

현재 사용 중인 API:
- **Function**: TIME_SERIES_DAILY
- **Output Size**: full (전체 데이터)
- **캐싱**: 5분
- **제한**: 5 requests/min, 500 requests/day

API 키 테스트:
```bash
curl "https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&apikey=YOUR_API_KEY"
```

응답 예시:
```json
{
  "Time Series (Daily)": {
    "2024-01-15": {
      "1. open": "185.00",
      "4. close": "185.50",
      ...
    }
  }
}
```

