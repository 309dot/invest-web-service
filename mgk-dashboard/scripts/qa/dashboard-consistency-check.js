#!/usr/bin/env node

const BASE_URL = process.env.QA_BASE_URL ?? 'http://localhost:3000';
const USER_ID = process.env.QA_USER_ID ?? 'default_user';
const PORTFOLIO_ID = process.env.QA_PORTFOLIO_ID ?? 'main';
const TOLERANCE = Number(process.env.QA_TOLERANCE ?? '5'); // currency units

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed [${response.status}] ${path}: ${body}`);
  }
  return response.json();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

async function main() {
  console.info('QA 체크: 포트폴리오/거래 데이터 일관성 검증');
  console.info(` - BASE_URL: ${BASE_URL}`);
  console.info(` - USER_ID: ${USER_ID}`);
  console.info(` - PORTFOLIO_ID: ${PORTFOLIO_ID}`);

  const positions = await fetchJson(`/api/positions?portfolioId=${PORTFOLIO_ID}&userId=${USER_ID}`);
  const transactions = await fetchJson(`/api/transactions?portfolioId=${PORTFOLIO_ID}&userId=${USER_ID}&includeStats=true`);

  const totals = positions.totals;
  const stats = transactions.stats;

  if (!totals || !stats) {
    throw new Error('필수 데이터(totals 또는 stats)를 가져오지 못했습니다. API 응답을 확인하세요.');
  }

  const usdInvested = totals.byCurrency?.USD?.totalInvested ?? 0;
  const usdBuyAmount = stats.byCurrency?.USD?.totalBuyAmount ?? 0;
  const krwInvested = totals.byCurrency?.KRW?.totalInvested ?? 0;
  const krwBuyAmount = stats.byCurrency?.KRW?.totalBuyAmount ?? 0;

  const usdDifference = Math.abs(usdInvested - usdBuyAmount);
  const krwDifference = Math.abs(krwInvested - krwBuyAmount);

  const usdStatus = usdDifference <= TOLERANCE ? '✅' : '⚠️';
  const krwStatus = krwDifference <= TOLERANCE ? '✅' : '⚠️';

  console.info('\n[USD] 총 투자금 vs 거래 매수 금액');
  console.info(` - 포지션 총 투자금: $${formatCurrency(usdInvested)}`);
  console.info(` - 거래 매수 총액: $${formatCurrency(usdBuyAmount)}`);
  console.info(` - 차이: $${formatCurrency(usdDifference)} (${usdStatus})`);

  console.info('\n[KRW] 총 투자금 vs 거래 매수 금액');
  console.info(` - 포지션 총 투자금: ₩${formatCurrency(krwInvested)}`);
  console.info(` - 거래 매수 총액: ₩${formatCurrency(krwBuyAmount)}`);
  console.info(` - 차이: ₩${formatCurrency(krwDifference)} (${krwStatus})`);

  if (usdDifference > TOLERANCE || krwDifference > TOLERANCE) {
    process.exitCode = 1;
    console.error('\n❌ 허용 오차를 초과한 통화가 있습니다. 데이터 변환 로직을 확인하세요.');
  } else {
    console.info('\n✅ 모든 통화가 허용 오차 내에서 일치합니다.');
  }
}

main().catch((error) => {
  console.error('\n❌ QA 스크립트 실행 중 오류가 발생했습니다.');
  console.error(error);
  process.exitCode = 1;
});

