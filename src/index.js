import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import cron from 'node-cron';
import rateLimit from 'express-rate-limit';

import { initializeLogger, logger } from './utils/logger.js';
import leadsRouter from './routes/leads.js';
import statsRouter from './routes/stats.js';
import healthRouter from './routes/health.js';
import { startScrapers, getScraperStatus } from './scrapers/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestValidator } from './middleware/requestValidator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

initializeLogger();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api', apiLimiter);

app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(requestValidator);

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/parker', {
      serverSelectionTimeoutMS: 5000
    });
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error.message);
    logger.error('   Make sure MONGODB_URI is set in .env');
    process.exit(1);
  }
}

app.get('/', (req, res) => {
  res.json({
    name: 'Parker API',
    version: '1.0.0',
    docs: '/api/leads',
    health: '/health',
    status: 'running'
  });
});

app.use('/api/leads', leadsRouter);
app.use('/api/stats', statsRouter);
app.use('/health', healthRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

app.get('/api/scrapers/status', (req, res) => {
  res.json({
    success: true,
    data: getScraperStatus()
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.originalUrl
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`🚀 Parker server running on port ${PORT}`);
      logger.info(`🔗 API: http://localhost:${PORT}/api`);
      logger.info(`🏥 Health: http://localhost:${PORT}/health`);
    });

    if (NODE_ENV === 'production' || process.env.ENABLE_SCRAPERS === 'true') {
      logger.info('🤖 Starting automated scrapers...');
      startScrapers();
    }

    setupScheduledTasks();

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

function setupScheduledTasks() {
  const scrapingInterval = process.env.SCRAPING_INTERVAL || '0 * * * *';

  cron.schedule(scrapingInterval, async () => {
    logger.info('⏰ Starting scheduled scrape...');
    try {
      await startScrapers();
    } catch (error) {
      logger.error('Scheduled scrape failed:', error);
    }
  });

  cron.schedule('0 0 * * 0', async () => {
    logger.info('🧹 Running cleanup task...');
    try {
      const { Lead } = await import('./models/Lead.js');
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const result = await Lead.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
      logger.info(`Cleaned up ${result.deletedCount} old leads`);
    } catch (error) {
      logger.error('Cleanup task failed:', error);
    }
  });

  logger.info('⏰ Scheduled tasks configured');
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  mongoose.connection.close();
  process.exit(0);
});

startServer();

export default app;