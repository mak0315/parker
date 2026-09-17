import express from 'express';
import mongoose from 'mongoose';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const dbConnected = mongoose.connection.readyState === 1;

    const health = {
      status: dbConnected ? 'healthy' : 'degraded',
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected'
    };

    if (dbConnected) {
      try {
        health.leads_count = await Lead.countDocuments();
        const lastLead = await Lead.findOne().sort({ createdAt: -1 });
        health.last_scrape = lastLead ? lastLead.createdAt : null;
      } catch (err) {
        logger.error('Health check metric error:', err.message);
      }
    }

    res.status(dbConnected ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;