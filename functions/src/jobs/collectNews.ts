import { firestore } from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import Parser from "rss-parser";

import { db } from "../utils/firebase";

interface NewsItem {
  title?: string;
  link?: string;
  isoDate?: string;
  contentSnippet?: string;
}

const SOURCES = [
  "https://news.google.com/rss/search?q=MGK+finance&hl=ko&gl=KR&ceid=KR:ko",
  "https://news.google.com/rss/search?q=NASDAQ:MGK&hl=ko&gl=KR&ceid=KR:ko",
];

async function fetchNewsFeeds() {
  const items: NewsItem[] = [];

  for (const source of SOURCES) {
    try {
      const feed = await parser.parseURL(source);
      items.push(...(feed.items ?? []));
    } catch (error) {
      logger.error("RSS 파싱 실패", { source, error });
    }
  }

  return items;
}

function determineImportance(snippet?: string) {
  if (!snippet) return "Medium";
  const lowered = snippet.toLowerCase();
  if (lowered.includes("urgent") || lowered.includes("soars")) {
    return "High";
  }
  if (lowered.includes("slight") || lowered.includes("steady")) {
    return "Low";
  }
  return "Medium";
}

export const collectNewsJob = onSchedule({
  schedule: "15 * * * *",
  timeZone: "Asia/Seoul",
}, async () => {
  logger.info("[collectNewsJob] 시작");

  const newsItems = await fetchNewsFeeds();

  if (!newsItems.length) {
    logger.warn("[collectNewsJob] 수집된 뉴스가 없습니다.");
    return;
  }

  const batch = db.batch();
  const now = firestore.FieldValue.serverTimestamp();

  newsItems.slice(0, 20).forEach((item) => {
    if (!item.title || !item.link) return;

    const docRef = db.collection("newsItems").doc();
    batch.set(docRef, {
      title: item.title,
      link: item.link,
      source: "Google News",
      collectedAt: now,
      snippet: item.contentSnippet ?? null,
      publishedAt: item.isoDate ? firestore.Timestamp.fromDate(new Date(item.isoDate)) : now,
      importance: determineImportance(item.contentSnippet),
    });
  });

  await batch.commit();
  logger.info("[collectNewsJob] 저장 완료", { count: newsItems.length });
});
