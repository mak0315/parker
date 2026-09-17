import dotenv from 'dotenv';
import mongoose from 'mongoose';
import axios from 'axios';
import { logger } from '../src/utils/logger.js';

dotenv.config();

async function testMongoDB() {
  logger.info('Testing MongoDB connection...');
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parker', {
      serverSelectionTimeoutMS: 5000
    });

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    logger.info(`✅ MongoDB connected. Collections: ${collections.map(c => c.name).join(', ') || 'none'}`);
    await mongoose.connection.close();
    return true;
  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);
    logger.error('   Check MONGODB_URI in .env');
    return false;
  }
}

async function testTwitter() {
  logger.info('Testing Twitter API...');
  if (!process.env.TWITTER_BEARER_TOKEN) {
    logger.info('⚠️  TWITTER_BEARER_TOKEN not set - skipping');
    return 'skipped';
  }

  try {
    const response = await axios.get('https://api.twitter.com/2/tweets/search/recent', {
      params: { query: 'Islamabad rent', max_results: 10 },
      headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` },
      timeout: 10000
    });
    logger.info(`✅ Twitter API works. Found ${response.data.data?.length || 0} tweets`);
    return true;
  } catch (error) {
    if (error.response?.status === 401) {
      logger.error('❌ Twitter API: Invalid bearer token');
    } else if (error.response?.status === 429) {
      logger.error('❌ Twitter API: Rate limited');
    } else {
      logger.error(`❌ Twitter API error: ${error.message}`);
    }
    return false;
  }
}

async function testFacebook() {
  logger.info('Testing Facebook API...');
  if (!process.env.FACEBOOK_ACCESS_TOKEN) {
    logger.info('⚠️  FACEBOOK_ACCESS_TOKEN not set - skipping');
    return 'skipped';
  }

  try {
    const response = await axios.get('https://graph.facebook.com/v19.0/me', {
      params: { access_token: process.env.FACEBOOK_ACCESS_TOKEN },
      timeout: 10000
    });
    logger.info(`✅ Facebook API works. App user: ${response.data.name || response.data.id}`);
    return true;
  } catch (error) {
    logger.error(`❌ Facebook API error: ${error.response?.data?.error?.message || error.message}`);
    return false;
  }
}

async function testReddit() {
  logger.info('Testing Reddit API...');
  try {
    const response = await axios.get('https://www.reddit.com/r/islamabad/new.json', {
      params: { limit: 1 },
      headers: { 'User-Agent': 'Parker-LeadBot/1.0' },
      timeout: 10000
    });
    logger.info('✅ Reddit API works');
    return true;
  } catch (error) {
    logger.error(`❌ Reddit API error: ${error.message}`);
    return false;
  }
}

async function run() {
  logger.info('=== PARKER API TESTS ===');
  const results = {
    mongodb: await testMongoDB(),
    twitter: await testTwitter(),
    facebook: await testFacebook(),
    reddit: await testReddit()
  };

  logger.info('=== TEST SUMMARY ===');
  for (const [key, value] of Object.entries(results)) {
    const label = value === true ? '✅ PASS' : value === 'skipped' ? '⚠️  SKIPPED' : '❌ FAIL';
    logger.info(`${label}  ${key}`);
  }

  process.exit(0);
}

run();