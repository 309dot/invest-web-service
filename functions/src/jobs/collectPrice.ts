import { firestore } from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import fetch from "node-fetch";

import { db } from "../utils/firebase";

interface AlphaVantageResponse {
  "Global Quote"?: {
    "05. price"?: string;
    "09. change"?: string;
    "10. change percent"?: string;
    "07. latest trading day"?: string;
  };
}

interface ExchangeRateResponse {
  "conversion_rates"?: {
    [key: string]: number;
  };
}

const SYMBOL = "MGK";
const EXCHANGE_API_URL = "https://v6.exchangerate-api.com/v6";

async function fetchCurrentPrice() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("ALPHA_VANTAGE_API_KEY가 설정되지 않았습니다.");
  }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${SYMBOL}&apikey=${apiKey}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Alpha Vantage 요청 실패: ${response.status}`);
  }

  const data = (await response.json()) as AlphaVantageResponse;
  const quote = data["Global Quote"];

  if (!quote || !quote["05. price"]) {
    throw new Error("Alpha Vantage 응답에 가격 데이터가 없습니다.");
  }

  return {
    price: Number(quote["05. price"]),
    change: quote["09. change"] ? Number(quote["09. change"]) : 0,
    changePercent: quote["10. change percent"] ? Number(quote["10. change percent"].replace("%", "")) : 0,
    latestTradingDay: quote["07. latest trading day"] ?? new Date().toISOString().split("T")[0],
  };
}

async function fetchExchangeRate() {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    throw new Error("EXCHANGE_RATE_API_KEY가 설정되지 않았습니다.");
  }

  const url = `${EXCHANGE_API_URL}/${apiKey}/latest/USD`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`ExchangeRate API 요청 실패: ${response.status}`);
  }

  const data = (await response.json()) as ExchangeRateResponse;
  const rate = data.conversion_rates?.KRW ?? null;

  if (!rate) {
    throw new Error("환율 데이터를 찾을 수 없습니다.");
  }

  return rate;
}

export const collectPriceJob = onSchedule({
  schedule: "0 * * * *",
  timeZone: "Asia/Seoul",
}, async () => {
  logger.info("[collectPriceJob] 시작");

  try {
    const [priceData, exchangeRate] = await Promise.all([
      fetchCurrentPrice(),
      fetchExchangeRate(),
    ]);

    const docRef = await db.collection("priceSnapshots").add({
      symbol: SYMBOL,
      price: priceData.price,
      change: priceData.change,
      changePercent: priceData.changePercent,
      latestTradingDay: priceData.latestTradingDay,
      exchangeRate,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    logger.info("[collectPriceJob] 저장 완료", {id: docRef.id});
  } catch (error) {
    logger.error("[collectPriceJob] 실패", error instanceof Error ? {
      message: error.message,
      stack: error.stack,
    } : error);
    throw error;
  }
});

