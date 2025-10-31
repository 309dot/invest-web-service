#!/bin/bash

# Vercel API 간단 테스트 스크립트
# 사용법: ./test-api-simple.sh https://your-project.vercel.app

VERCEL_URL=$1

if [ -z "$VERCEL_URL" ]; then
  echo "❌ 에러: Vercel URL을 입력해주세요!"
  echo ""
  echo "사용법: ./test-api-simple.sh https://your-project.vercel.app"
  exit 1
fi

echo "🚀 Vercel API 간단 테스트"
echo "🌐 URL: $VERCEL_URL"
echo "⏰ 시작: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 색상 코드
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 카운터
SUCCESS=0
FAIL=0

# 테스트 함수
test_endpoint() {
  local name=$1
  local endpoint=$2
  
  echo ""
  echo "🧪 테스트: $name"
  echo "📍 $VERCEL_URL$endpoint"
  
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL$endpoint")
  
  if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ 성공 ($HTTP_CODE)${NC}"
    ((SUCCESS++))
  else
    echo -e "${RED}❌ 실패 ($HTTP_CODE)${NC}"
    ((FAIL++))
  fi
}

# 1. 기본 페이지
echo ""
echo "📋 [1] 기본 페이지 테스트"
test_endpoint "홈페이지" "/"
test_endpoint "로그인 페이지" "/login"

# 2. 주식 검색 API
echo ""
echo "📋 [2] 주식 검색 API"
test_endpoint "주식 검색 - AAPL" "/api/stocks/search?query=AAPL"
test_endpoint "주식 검색 - 삼성전자" "/api/stocks/search?query=삼성전자"

# 3. 환율 API
echo ""
echo "📋 [3] 환율 API"
test_endpoint "USD/KRW 환율" "/api/exchange-rate?from=USD&to=KRW"

# 4. 포지션 API
echo ""
echo "📋 [4] 포지션 API"
test_endpoint "포지션 목록" "/api/positions"

# 5. 거래 내역 API
echo ""
echo "📋 [5] 거래 내역 API"
test_endpoint "거래 내역" "/api/transactions"

# 6. 잔고 API
echo ""
echo "📋 [6] 잔고 API"
test_endpoint "잔고 조회" "/api/balance"

# 7. 통계 API
echo ""
echo "📋 [7] 통계 API"
test_endpoint "통계 조회" "/api/stats"

# 결과 요약
TOTAL=$((SUCCESS + FAIL))
SUCCESS_RATE=$(awk "BEGIN {printf \"%.1f\", ($SUCCESS/$TOTAL)*100}")

echo ""
echo "=========================================="
echo "📊 테스트 결과 요약"
echo "=========================================="
echo -e "✅ 성공: ${GREEN}$SUCCESS${NC}/$TOTAL"
echo -e "❌ 실패: ${RED}$FAIL${NC}/$TOTAL"
echo -e "📈 성공률: ${YELLOW}${SUCCESS_RATE}%${NC}"
echo "⏰ 종료: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}🎉 모든 테스트 통과!${NC}"
  exit 0
else
  echo -e "${RED}⚠️  일부 테스트 실패${NC}"
  exit 1
fi

