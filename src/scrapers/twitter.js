import axios from 'axios';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';
import { twitterSearchQueries } from '../../config/keywords.js';

class TwitterScraper {
  constructor() {
    this.bearerToken = process.env.TWITTER_BEARER_TOKEN;
    this.baseUrl = 'https://api.twitter.com/2';
    this.keywords = twitterSearchQueries;
  }

  async search() {
    if (!this.bearerToken) {
      logger.warn('Twitter API token not configured, skipping Twitter scraper');
      return [];
    }

    try {
      const leads = [];

      for (const keyword of this.keywords) {
        logger.info(`Searching Twitter for: "${keyword}"`);
        const tweets = await this.searchTweets(keyword);
        leads.push(...tweets);
      }

      logger.info(`Twitter scraper found ${leads.length} potential leads`);
      return leads;
    } catch (error) {
      logger.error('Twitter scraper error:', error.message);
      return [];
    }
  }

  async searchTweets(query) {
    const leads = [];
    const headers = {
      'Authorization': `Bearer ${this.bearerToken}`,
      'User-Agent': 'Parker-LeadBot'
    };

    try {
      const response = await axios.get(`${this.baseUrl}/tweets/search/recent`, {
        params: {
          query: `${query} -is:retweet lang:en OR lang:ur`,
          'tweet.fields': 'created_at,public_metrics,author_id',
          'expansions': 'author_id',
          'user.fields': 'created_at,public_metrics',
          'max_results': 100
        },
        headers,
        timeout: 10000
      });

      const tweets = response.data.data || [];
      const users = response.data.includes?.users || [];

      const userMap = {};
      users.forEach(user => {
        userMap[user.id] = user;
      });

      for (const tweet of tweets) {
        const user = userMap[tweet.author_id];
        if (!user) continue;

        const hasContact = /(\+92|03)\d{9}|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(tweet.text);

        const lead = new Lead({
          title: tweet.text.substring(0, 100),
          content: tweet.text,
          platform: 'twitter',
          sourceUrl: `https://twitter.com/${user.username}/status/${tweet.id}`,
          postId: tweet.id,
          author: {
            name: user.name,
            username: user.username,
            profileUrl: `https://twitter.com/${user.username}`,
            accountAge: Math.floor(
              (Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)
            )
          },
          engagement: {
            likes: tweet.public_metrics.like_count,
            comments: tweet.public_metrics.reply_count,
            shares: tweet.public_metrics.retweet_count
          },
          postDate: new Date(tweet.created_at)
        });

        lead.extractContactInfo();
        lead.recalculateScore();

        if (hasContact) {
          lead.score = Math.min(lead.score + 15, 100);
        }

        leads.push(lead);
      }

      return leads;
    } catch (error) {
      if (error.response?.status === 429) {
        logger.warn('Twitter rate limit reached, waiting before retry...');
      } else {
        logger.error(`Error searching Twitter for "${query}":`, error.message);
      }
      return leads;
    }
  }

  async saveTweets(tweetObjects) {
    let saved = 0;
    let duplicates = 0;

    for (const lead of tweetObjects) {
      try {
        const existing = await Lead.findOne({ sourceUrl: lead.sourceUrl });

        if (existing) {
          existing.updateEngagement(lead.engagement);
          existing.recalculateScore();
          await existing.save();
          duplicates++;
        } else {
          await lead.save();
          saved++;
        }
      } catch (error) {
        logger.error(`Error saving tweet lead: ${error.message}`);
      }
    }

    logger.info(`Twitter: Saved ${saved} new leads, updated ${duplicates} existing`);
    return { saved, duplicates };
  }
}

export default new TwitterScraper();