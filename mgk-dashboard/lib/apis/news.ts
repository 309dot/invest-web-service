import axios from 'axios';

export interface RSSNewsItem {
  title: string;
  link: string;
  pubDate: Date;
  source: string;
  description?: string;
}

// Cache for news (10 minutes)
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Collect news from Google News RSS feed
 * @param keywords - Keywords to search for
 * @param language - Language code (default: en)
 */
export async function collectNews(keywords: string[], language: string = 'en'): Promise<RSSNewsItem[]> {
  const cacheKey = `news-${keywords.join('-')}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    const allNews: RSSNewsItem[] = [];

    for (const keyword of keywords) {
      // Google News RSS feed URL
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${language}&gl=US&ceid=US:${language}`;

      const response = await axios.get(rssUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        },
      });

      const xmlData = response.data;
      const newsItems = parseRSSFeed(xmlData, keyword);

      allNews.push(...newsItems);
    }

    // Filter to last 24 hours and remove duplicates
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentNews = allNews.filter(item => item.pubDate > oneDayAgo);
    const uniqueNews = removeDuplicates(recentNews);

    // Sort by date (newest first)
    uniqueNews.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

    // Cache the result
    cache.set(cacheKey, { data: uniqueNews, timestamp: Date.now() });

    return uniqueNews;
  } catch (error) {
    console.error('Error collecting news:', error);

    if (cached) {
      console.warn('Returning expired cache data due to API error');
      return cached.data;
    }

    return [];
  }
}

/**
 * Parse RSS XML feed to extract news items
 */
function parseRSSFeed(xmlData: string, keyword: string): RSSNewsItem[] {
  const items: RSSNewsItem[] = [];

  try {
    // Simple regex-based XML parsing (consider using xml2js for production)
    const itemMatches = xmlData.match(/<item>[\s\S]*?<\/item>/g) || [];

    itemMatches.forEach(itemXml => {
      const title = extractXMLValue(itemXml, 'title');
      const link = extractXMLValue(itemXml, 'link');
      const pubDate = extractXMLValue(itemXml, 'pubDate');
      const source = extractXMLValue(itemXml, 'source');
      const description = extractXMLValue(itemXml, 'description');

      if (title && link && pubDate) {
        items.push({
          title: decodeHTMLEntities(title),
          link: link,
          pubDate: new Date(pubDate),
          source: source || 'Google News',
          description: description ? decodeHTMLEntities(description) : undefined,
        });
      }
    });
  } catch (error) {
    console.error('Error parsing RSS feed:', error);
  }

  return items;
}

/**
 * Extract value from XML tag
 */
function extractXMLValue(xml: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[#\w]+;/g, entity => entities[entity] || entity);
}

/**
 * Remove duplicate news items based on title similarity
 */
function removeDuplicates(news: RSSNewsItem[]): RSSNewsItem[] {
  const unique: RSSNewsItem[] = [];
  const seenTitles = new Set<string>();

  news.forEach(item => {
    const normalizedTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      unique.push(item);
    }
  });

  return unique;
}

/**
 * Calculate relevance score based on title and keywords
 */
export function calculateRelevanceScore(title: string, keywords: string[]): number {
  let score = 0;
  const lowerTitle = title.toLowerCase();

  keywords.forEach(keyword => {
    if (lowerTitle.includes(keyword.toLowerCase())) {
      score += 20;
    }
  });

  // Additional scoring factors
  if (lowerTitle.includes('stock') || lowerTitle.includes('share')) score += 10;
  if (lowerTitle.includes('market')) score += 10;
  if (lowerTitle.includes('earnings') || lowerTitle.includes('revenue')) score += 15;
  if (lowerTitle.includes('growth') || lowerTitle.includes('surge')) score += 10;
  if (lowerTitle.includes('fall') || lowerTitle.includes('drop') || lowerTitle.includes('decline')) score += 10;

  return Math.min(score, 100);
}

/**
 * Categorize news based on title content
 */
export function categorizeNews(title: string): 'tech' | 'economy' | 'market' {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('tech') || lowerTitle.includes('ai') || lowerTitle.includes('software')) {
    return 'tech';
  }

  if (lowerTitle.includes('economy') || lowerTitle.includes('gdp') || lowerTitle.includes('inflation')) {
    return 'economy';
  }

  return 'market';
}

/**
 * Determine news importance based on relevance score
 */
export function determineImportance(relevanceScore: number): 'High' | 'Medium' | 'Low' {
  if (relevanceScore >= 60) return 'High';
  if (relevanceScore >= 30) return 'Medium';
  return 'Low';
}

/**
 * Clear the cache
 */
export function clearCache() {
  cache.clear();
}
