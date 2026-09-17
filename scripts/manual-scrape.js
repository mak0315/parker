import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { logger, initializeLogger } from '../src/utils/logger.js';
import { startScrapers } from '../src/scrapers/index.js';

dotenv.config();
initializeLogger();

async function run() {
  logger.info('=== MANUAL SCRAPE START ===');

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parker', {
      serverSelectionTimeoutMS: 5000
    });
    logger.info('✅ MongoDB connected');
  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  const platforms = process.argv[2]
    ? process.argv[2].split(',')
    : ['twitter', 'reddit', 'facebook'];

  const results = await startScrapers({ platforms });

  await mongoose.connection.close();
  logger.info('=== MANUAL SCRAPE COMPLETE ===');
  logger.info(`Summary: ${JSON.stringify(results)}`);
  process.exit(0);
}

run();