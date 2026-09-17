import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { logger, initializeLogger } from '../src/utils/logger.js';
import Lead from '../src/models/Lead.js';

dotenv.config();
initializeLogger();

async function run() {
  logger.info('=== LEAD CLEANUP START ===');
  const maxAgeDays = parseInt(process.argv[2]) || 30;

  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parker', {
      serverSelectionTimeoutMS: 5000
    });
  } catch (error) {
    logger.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }

  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  const statusesToKeep = ['contacted', 'qualified', 'converted'];
  const oldLeads = await Lead.find({
    createdAt: { $lt: cutoff },
    status: { $nin: statusesToKeep },
    followUpDate: { $exists: false }
  });

  logger.info(`Found ${oldLeads.length} leads older than ${maxAgeDays} days to clean up`);

  const result = await Lead.deleteMany({
    createdAt: { $lt: cutoff },
    status: { $nin: statusesToKeep },
    followUpDate: { $exists: false }
  });

  logger.info(`✅ Deleted ${result.deletedCount} old leads`);
  logger.info(`Keeping ${await Lead.countDocuments({ status: { $in: statusesToKeep } })} active leads (contacted/qualified/converted)`);

  await mongoose.connection.close();
  logger.info('=== LEAD CLEANUP COMPLETE ===');
  process.exit(0);
}

run();