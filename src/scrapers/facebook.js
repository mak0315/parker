import axios from 'axios';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';
import { facebookGroups } from '../../config/keywords.js';

class FacebookScraper {
  constructor() {
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.baseUrl = 'https://graph.facebook.com/v19.0';
  }

  async search() {
    if (!this.accessToken) {
      logger.warn('Facebook API token not configured, skipping Facebook scraper');
      return [];
    }

    const leads = [];

    for (const group of facebookGroups) {
      try {
        logger.info(`Searching Facebook group: ${group}`);
        const groupId = await this.findGroupId(group);
        if (groupId) {
          const posts = await this.searchGroup(groupId, group);
          leads.push(...posts);
        }
      } catch (error) {
        logger.error(`Facebook scraper error for "${group}":`, error.message);
      }
    }

    logger.info(`Facebook scraper found ${leads.length} potential leads`);
    return leads;
  }

  async findGroupId(groupName) {
    try {
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q: groupName,
          type: 'group',
          access_token: this.accessToken
        },
        timeout: 10000
      });

      const groups = response.data.data || [];
      return groups.length > 0 ? groups[0].id : null;
    } catch (error) {
      logger.error('Error finding Facebook group:', error.message);
      return null;
    }
  }

  async searchGroup(groupId, groupName) {
    const leads = [];
    const keywords = ['rent', 'apartment', 'flat', 'furnished', 'available', 'bedroom'];

    try {
      const response = await axios.get(`${this.baseUrl}/${groupId}/feed`, {
        params: {
          limit: 50,
          fields: 'message,created_time,from,link,id,likes.summary(true),comments.summary(true)',
          access_token: this.accessToken
        },
        timeout: 10000
      });

      const posts = response.data.data || [];

      for (const post of posts) {
        const message = post.message || '';
        const isRelevant = keywords.some(k => message.toLowerCase().includes(k));
        if (!isRelevant) continue;

        const postAge = (Date.now() - new Date(post.created_time).getTime()) / (1000 * 60 * 60 * 24);
        if (postAge > 7) continue;

        const lead = new Lead({
          title: message.substring(0, 100),
          content: message,
          platform: 'facebook',
          sourceUrl: post.link || `https://facebook.com/${post.id}`,
          postId: post.id,
          author: {
            name: post.from?.name,
            username: post.from?.name,
            profileUrl: `https://facebook.com/${post.from?.id}`
          },
          engagement: {
            likes: post.likes?.summary?.total_count || 0,
            comments: post.comments?.summary?.total_count || 0,
            shares: 0
          },
          postDate: new Date(post.created_time)
        });

        lead.extractContactInfo();
        lead.recalculateScore();

        leads.push(lead);
      }

      return leads;
    } catch (error) {
      logger.error(`Error searching Facebook group ${groupName}:`, error.message);
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
        logger.error(`Error saving Facebook post: ${error.message}`);
      }
    }

    logger.info(`Facebook: Saved ${saved} new leads, updated ${duplicates} existing`);
    return { saved, duplicates };
  }
}

export default new FacebookScraper();