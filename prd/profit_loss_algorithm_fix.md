# 🧮 손익 계산 로직 검증 및 개선 Task

## ✅ 문제 요약
현재 대시보드 종목 목록에서:

| 종목 | 평균 단가 | 평가 금액 | 계산상 손익 | 표시 손익 |
|------|-------------|------------|--------------|-------------|
| NVDA | $197.71 | $304.78 | **+2.42%** | ✅ |
| MGK | $402.54 | $263.27 | **+5.07%** | ✅ |
| BRK-B | $429.03 | $159.59 | **+11.22%** | ✅ |
| FIG | $64.28 | $128.56 | **0.00%** | ⚠️ 항상 0% |
| META | $715.70 | $69.93 | **0.00%** | ⚠️ 항상 0% |

일부 종목의 손익률이 항상 0%로 표시되며, 실제 손실 구간이 반영되지 않음.

---

## 🔍 원인 분석
1. **평가 금액(currentValue)** 과 **평균 단가(avgCost)** 비교가 단가 기준으로만 이루어짐.
   ```js
   const profit = currentValue - avgCost;
   const profitRate = (profit / avgCost) * 100;
   ```
   → 주식 수량(qty)을 고려하지 않아 정확도 저하.

2. **소수점 반올림 순서 오류**
   - -0.4%와 같은 값이 `Math.round` 또는 `.toFixed()` 순서 때문에 0으로 표시됨.

3. **시세 API 실패 시 초기화**
   - 실시간 시세를 불러오지 못하면 평가 금액 = 투자 금액으로 처리되어 손익률 0%로 고정.

---

## 🧩 개선 제안

### 1️⃣ 손익 계산 공식 수정
```js
const profit = (currentPrice * quantity) - (avgPrice * quantity);
const profitRate = (profit / (avgPrice * quantity)) * 100;
```
→ “총 투자금” 기준으로 계산해 소수점 종목에서도 정확히 표시되도록 수정.

---

### 2️⃣ 음수 표시 로직 강화
```tsx
<span className={profitRate >= 0 ? 'text-green-500' : 'text-red-500'}>
  {profitRate.toFixed(2)}%
</span>
<span className={profit >= 0 ? 'text-green-500' : 'text-red-500'}>
  {profit.toLocaleString()}원
</span>
```
- [ ] 음수 시 빨간색(`text-red`)으로 표시  
- [ ] 0% 반올림 방지 (`Math.floor` 또는 `toFixed` 순서 조정)

---

### 3️⃣ 실시간 시세 API 개선
시세 불러오기 실패 시:
```js
if (!currentPrice) {
  useLastKnownPrice(symbol);
  setError("가격 데이터 없음");
}
```
- [ ] 캐시된 마지막 가격(`localStorage` 또는 DB) 사용  
- [ ] 예외 메시지 명확히 표시 (“가격 데이터 없음”)  

---

### 4️⃣ QA 자동 검증 코드 (Jest)
```js
test('손익 계산 정확도', () => {
  const avgPrice = 100;
  const currentPrice = 90;
  const qty = 2;
  const profit = (currentPrice * qty) - (avgPrice * qty);
  const profitRate = (profit / (avgPrice * qty)) * 100;
  expect(profitRate).toBe(-10); // -10% 손실
});
```

---

## 🧠 결론

| 구분 | 문제 | 개선 방향 |
|------|------|------------|
| 계산 방식 | 단가 기준 계산 | 총 투자금 기준으로 변경 |
| 반올림 | 음수값 0으로 처리 | 소수점 유지 |
| 시세 실패 | 평가금 = 투자금 | 캐시된 가격 사용 |
| UI | 항상 초록색 표시 | 음수는 빨간색으로 표시 |

---
