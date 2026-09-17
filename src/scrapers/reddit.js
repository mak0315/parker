import axios from 'axios';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';
import { subreddits } from '../../config/keywords.js';

class RedditScraper {
  constructor() {
    this.baseUrl = 'https://www.reddit.com';
    this.keywords = ['rent', 'apartment', 'flat', 'short term', 'rental', 'furnished', 'bedroom'];
  }

  async search() {
    try {
      const leads = [];

      for (const subreddit of subreddits) {
        logger.info(`Searching Reddit subreddit: ${subreddit}`);
        const posts = await this.searchSubreddit(subreddit);
        leads.push(...posts);
      }

      logger.info(`Reddit scraper found ${leads.length} potential leads`);
      return leads;
    } catch (error) {
      logger.error('Reddit scraper error:', error.message);
      return [];
    }
  }

  async searchSubreddit(subreddit) {
    const leads = [];

    try {
      const response = await axios.get(
        `${this.baseUrl}/${subreddit}/new.json`,
        {
          params: { limit: 100 },
          headers: {
            'User-Agent': 'Parker-LeadBot/1.0 (by ParkerLeadGen)'
          },
          timeout: 10000
        }
      );

      const posts = response.data?.data?.children || [];

      for (const post of posts) {
        const data = post.data;
        if (!data || data.removed_by_category || data.spoiler) continue;

        const titleAndText = `${data.title} ${data.selftext || ''}`.toLowerCase();
        const isRelevant = this.keywords.some(k => titleAndText.includes(k));
        if (!isRelevant) continue;

        const postAge = (Date.now() - data.created_utc * 1000) / (1000 * 60 * 60 * 24);
        if (postAge > 7) continue;

        const lead = new Lead({
          title: data.title,
          content: data.selftext || data.title,
          platform: 'reddit',
          sourceUrl: `https://reddit.com${data.permalink}`,
          postId: data.id,
          author: {
            name: data.author,
            username: data.author,
            profileUrl: `https://reddit.com/u/${data.author}`
          },
          engagement: {
            likes: data.ups,
            comments: data.num_comments,
            shares: data.num_shares || 0
          },
          postDate: new Date(data.created_utc * 1000)
        });

        lead.extractContactInfo();
        lead.recalculateScore();

        leads.push(lead);
      }

      return leads;
    } catch (error) {
      logger.error(`Error searching Reddit ${subreddit}:`, error.message);
      return leads;
    }
  }

  async savePosts(postObjects) {
    let saved = 0;
    let duplicates = 0;

    for (const lead of postObjects) {
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
        logger.error(`Error saving Reddit post: ${error.message}`);
      }
    }

    logger.info(`Reddit: Saved ${saved} new leads, updated ${duplicates} existing`);
    return { saved, duplicates };
  }
}

export default new RedditScraper();