import twitterScraper from './twitter.js';
import redditScraper from './reddit.js';
import facebookScraper from './facebook.js';
import { logger } from '../utils/logger.js';

const scrapers = {
  twitter: twitterScraper,
  reddit: redditScraper,
  facebook: facebookScraper
};

export async function startScrapers(options = {}) {
  const platforms = options.platforms || Object.keys(scrapers);
  const results = {};

  logger.info(`🚀 Starting scrapers for platforms: ${platforms.join(', ')}`);

  for (const platform of platforms) {
    const scraper = scrapers[platform];
    if (!scraper) {
      logger.warn(`Unknown platform: ${platform}`);
      continue;
    }

    try {
      logger.info(`⏳ Scraping ${platform}...`);
      const posts = await scraper.search();

      if (posts.length > 0) {
        const saveResult = platform === 'twitter'
          ? await scraper.saveTweets(posts)
          : await scraper.savePosts(posts);

        results[platform] = {
          found: posts.length,
          ...saveResult
        };
      } else {
        results[platform] = { found: 0, saved: 0, duplicates: 0 };
      }

      logger.info(`✅ ${platform} scrape complete`);
      logger.info(`   Found: ${posts.length} | Saved: ${results[platform].saved} | Duplicates: ${results[platform].duplicates}`);
    } catch (error) {
      logger.error(`❌ ${platform} scrape failed:`, error.message);
      results[platform] = { found: 0, saved: 0, duplicates: 0, error: error.message };
    }
  }

  logger.info(`📊 Scrape run complete: ${JSON.stringify(results)}`);
  return results;
}

export function getScraperStatus() {
  return {
    twitter: { enabled: !!process.env.TWITTER_BEARER_TOKEN },
    reddit: { enabled: true },
    facebook: { enabled: !!process.env.FACEBOOK_ACCESS_TOKEN }
  };
}

export default scrapers;