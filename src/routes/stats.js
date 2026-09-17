import express from 'express';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [
      totalLeads,
      newLeads,
      contactedLeads,
      qualifiedLeads,
      convertedLeads,
      platformStats,
      avgScore,
      todayLeads
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ status: 'new' }),
      Lead.countDocuments({ status: 'contacted' }),
      Lead.countDocuments({ status: 'qualified' }),
      Lead.countDocuments({ status: 'converted' }),
      Lead.aggregate([
        { $group: { _id: '$platform', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Lead.aggregate([
        { $group: { _id: null, avg: { $avg: '$score' } } }
      ]),
      Lead.countDocuments({
        postDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalLeads,
        newLeads,
        contactedLeads,
        qualifiedLeads,
        convertedLeads,
        todayLeads,
        avgScore: avgScore.length > 0 ? Math.round(avgScore[0].avg * 10) / 10 : 0,
        platformStats,
        contactsFound: await Lead.countDocuments({ $or: [{ hasPhone: true }, { hasEmail: true }] })
      }
    });
  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats'
    });
  }
});

router.get('/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await Lead.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching daily stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching daily stats'
    });
  }
});

router.get('/sources', async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          withContact: { $sum: { $cond: [{ $or: ['$hasPhone', '$hasEmail'] }, 1, 0] } },
          avgScore: { $avg: '$score' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching source stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching source stats'
    });
  }
});

export default router;