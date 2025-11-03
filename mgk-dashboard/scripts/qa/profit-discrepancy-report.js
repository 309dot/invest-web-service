#!/usr/bin/env node
/*
 * QA Script: Profit/Loss Discrepancy Report
 *
 * Usage:
 *   node scripts/qa/profit-discrepancy-report.js
 *
 * Environment variables:
 *   BASE_URL      - API base url (default: http://localhost:3000)
 *   USER_ID       - Target user id (default: default_user)
 *   PORTFOLIO_ID  - Target portfolio id (default: main)
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USER_ID = process.env.USER_ID || 'default_user';
const PORTFOLIO_ID = process.env.PORTFOLIO_ID || 'main';

const fetchImpl = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

async function fetchJson(path) {
  const response = await fetchImpl(`${BASE_URL}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Request failed: ${path} → ${response.status} ${body}`);
  }
  return response.json();
}

function formatNumber(value, decimals = 2) {
  return Number(value).toFixed(decimals);
}

function toNumber(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'seconds' in value) {
    return value.seconds;
  }
  return Number(value) || 0;
}

async function main() {
  console.log('⚙️  Profit/Loss discrepancy audit');
  console.log(` - BASE_URL: ${BASE_URL}`);
  console.log(` - USER_ID: ${USER_ID}`);
  console.log(` - PORTFOLIO_ID: ${PORTFOLIO_ID}`);

  const positionsResponse = await fetchJson(
    `/api/positions?userId=${USER_ID}&portfolioId=${PORTFOLIO_ID}`
  );
  const positions = positionsResponse.positions || [];

  const analysisResponse = await fetchJson(
    `/api/portfolio/analysis?userId=${USER_ID}&portfolioId=${PORTFOLIO_ID}`
  );

  const threshold = {
    value: 1, // 1 KRW or 1 USD
    rate: 0.5, // 0.5% difference
  };

  const discrepancies = [];

  positions.forEach((position) => {
    const currency = position.currency === 'KRW' ? 'KRW' : 'USD';
    const shares = position.shares || 0;
    const currentPrice = position.currentPrice || 0;
    const calcValue = shares * currentPrice;
    const storedValue = position.totalValue || 0;
    const valueDiff = calcValue - storedValue;
    const diffAbs = Math.abs(valueDiff);
    const diffRate = storedValue !== 0 ? (valueDiff / storedValue) * 100 : 0;

    if (diffAbs > threshold.value || Math.abs(diffRate) > threshold.rate) {
      discrepancies.push({
        symbol: position.symbol,
        market: position.market,
        currency,
        priceSource: position.priceSource ?? 'unknown',
        shares: formatNumber(shares, 4),
        currentPrice: formatNumber(currentPrice, currency === 'KRW' ? 0 : 2),
        storedValue: formatNumber(storedValue, currency === 'KRW' ? 0 : 2),
        recalculatedValue: formatNumber(calcValue, currency === 'KRW' ? 0 : 2),
        diffAmount: formatNumber(valueDiff, currency === 'KRW' ? 0 : 2),
        diffRate: formatNumber(diffRate, 3),
      });
    }
  });

  const analysisTotalValue = analysisResponse.analysis?.totalValue ?? 0;
  const positionTotalValue = positions.reduce((sum, pos) => sum + (pos.totalValue || 0), 0);
  const totalDiff = analysisTotalValue - positionTotalValue;

  console.log('\n📊 Summary');
  console.log(` - Positions fetched: ${positions.length}`);
  console.log(
    ` - Portfolio total (analysis): ${formatNumber(analysisTotalValue)} (${analysisResponse.analysis?.baseCurrency ?? 'KRW'})`
  );
  console.log(
    ` - Sum of position totals: ${formatNumber(positionTotalValue)} (${analysisResponse.analysis?.baseCurrency ?? 'KRW'})`
  );
  console.log(` - Total difference: ${formatNumber(totalDiff)}`);

  if (discrepancies.length === 0) {
    console.log('\n✅ No significant discrepancies detected.');
  } else {
    console.log(`\n⚠️  Found ${discrepancies.length} position discrepancies:`);
    discrepancies.forEach((item, index) => {
      console.log(
        ` ${index + 1}. ${item.symbol} (${item.currency}) [가격 소스: ${item.priceSource}] → 저장값 ${item.storedValue}, 재계산 ${item.recalculatedValue} (차이 ${item.diffAmount}, ${item.diffRate}%)`
      );
    });
  }

  if (analysisResponse.analysis?.exchangeRate) {
    const fx = analysisResponse.analysis.exchangeRate;
    console.log(
      `\n📈 Exchange rate used: 1 ${fx.base} = ${formatNumber(fx.rate, 2)} ${fx.quote} (${fx.source})`
    );
  }
}

main().catch((error) => {
  console.error('❌ QA script failed:', error);
  process.exit(1);
});


