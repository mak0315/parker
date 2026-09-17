import express from 'express';
import { query, body, param, validationResult } from 'express-validator';
import Lead from '../models/Lead.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

router.get('/',
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('platform').optional().isIn(['twitter', 'facebook', 'reddit', 'google', 'instagram', 'manual']),
  query('status').optional().isIn(['new', 'viewed', 'contacted', 'qualified', 'converted', 'rejected']),
  query('minScore').optional().isInt({ min: 0, max: 100 }).toInt(),
  query('maxScore').optional().isInt({ min: 0, max: 100 }).toInt(),
  query('search').optional().isString().trim(),
  query('sortBy').optional().isIn(['score', 'date', 'engagement']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  validateRequest,
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        platform,
        status,
        minScore,
        maxScore,
        search,
        sortBy = 'score',
        sortOrder = 'desc'
      } = req.query;

      const filter = {};
      if (platform) filter.platform = platform;
      if (status) filter.status = status;
      if (minScore || maxScore) {
        filter.score = {};
        if (minScore) filter.score.$gte = minScore;
        if (maxScore) filter.score.$lte = maxScore;
      }

      if (search) {
        filter.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content: { $regex: search, $options: 'i' } },
          { 'contact.phone': { $regex: search, $options: 'i' } }
        ];
      }

      const sortObj = {};
      if (sortBy === 'date') sortObj.postDate = sortOrder === 'desc' ? -1 : 1;
      else if (sortBy === 'engagement') sortObj['engagement.likes'] = sortOrder === 'desc' ? -1 : 1;
      else sortObj.score = sortOrder === 'desc' ? -1 : 1;

      const skip = (page - 1) * limit;

      const [leads, total] = await Promise.all([
        Lead.find(filter)
          .sort(sortObj)
          .skip(skip)
          .limit(limit)
          .lean(),
        Lead.countDocuments(filter)
      ]);

      logger.info(`Retrieved ${leads.length} leads with filters: ${JSON.stringify(filter)}`);

      res.json({
        success: true,
        data: leads,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error fetching leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching leads',
        error: error.message
      });
    }
  }
);

router.get('/quality',
  query('minScore').optional().isInt({ min: 0, max: 100 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  validateRequest,
  async (req, res) => {
    try {
      const { minScore = 70, limit = 50 } = req.query;
      const leads = await Lead.getQualityLeads(minScore, limit);

      res.json({
        success: true,
        data: leads,
        count: leads.length
      });
    } catch (error) {
      logger.error('Error fetching quality leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching quality leads'
      });
    }
  }
);

router.get('/stats/platform', async (req, res) => {
  try {
    const stats = await Lead.aggregate([
      {
        $group: {
          _id: '$platform',
          count: { $sum: 1 },
          avgScore: { $avg: '$score' },
          newLeads: {
            $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error fetching platform stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching stats'
    });
  }
});

router.get('/:id',
  param('id').isMongoId(),
  validateRequest,
  async (req, res) => {
    try {
      const result = await Lead.getLeadWithRelated(req.params.id);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      await Lead.updateOne(
        { _id: req.params.id },
        { $inc: { viewCount: 1 }, lastInteraction: new Date() }
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error fetching lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching lead'
      });
    }
  }
);

router.post('/',
  body('title').notEmpty().trim().isLength({ min: 5, max: 500 }),
  body('content').notEmpty().trim().isLength({ min: 10 }),
  body('platform').isIn(['twitter', 'facebook', 'reddit', 'google', 'instagram', 'manual']),
  body('sourceUrl').isURL(),
  body('score').optional().isInt({ min: 0, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const {
        title,
        content,
        platform,
        sourceUrl,
        score = 50,
        author,
        contact
      } = req.body;

      const existing = await Lead.findOne({ sourceUrl });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Lead already exists'
        });
      }

      const lead = new Lead({
        title,
        content,
        platform,
        sourceUrl,
        score,
        author: author || {},
        contact: contact || {}
      });

      lead.extractContactInfo();
      lead.recalculateScore();
      lead.generateContentHash();

      await lead.save();

      logger.info(`New lead created: ${lead._id} from ${platform}`);

      res.status(201).json({
        success: true,
        data: lead,
        message: 'Lead created successfully'
      });
    } catch (error) {
      logger.error('Error creating lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating lead',
        error: error.message
      });
    }
  }
);

router.patch('/:id',
  param('id').isMongoId(),
  body('status').optional().isIn(['new', 'viewed', 'contacted', 'qualified', 'converted', 'rejected']),
  body('notes').optional().isString().trim(),
  body('tags').optional().isArray(),
  body('followUpDate').optional().isISO8601(),
  body('score').optional().isInt({ min: 0, max: 100 }),
  validateRequest,
  async (req, res) => {
    try {
      const { status, notes, tags, followUpDate, score } = req.body;

      const updateData = { lastInteraction: new Date() };
      if (status) updateData.status = status;
      if (notes !== undefined) updateData.notes = notes;
      if (tags) updateData.tags = tags;
      if (followUpDate) updateData.followUpDate = followUpDate;
      if (score !== undefined) updateData.score = score;

      const lead = await Lead.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true, runValidators: true }
      );

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      logger.info(`Lead updated: ${req.params.id}, status: ${status}`);

      res.json({
        success: true,
        data: lead,
        message: 'Lead updated successfully'
      });
    } catch (error) {
      logger.error('Error updating lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating lead'
      });
    }
  }
);

router.delete('/:id',
  param('id').isMongoId(),
  validateRequest,
  async (req, res) => {
    try {
      const lead = await Lead.findByIdAndDelete(req.params.id);

      if (!lead) {
        return res.status(404).json({
          success: false,
          message: 'Lead not found'
        });
      }

      logger.info(`Lead deleted: ${req.params.id}`);

      res.json({
        success: true,
        message: 'Lead deleted successfully'
      });
    } catch (error) {
      logger.error('Error deleting lead:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting lead'
      });
    }
  }
);

router.post('/bulk/update-status',
  body('leadIds').isArray({ min: 1 }).custom(value => value.every(id => typeof id === 'string')),
  body('status').isIn(['new', 'viewed', 'contacted', 'qualified', 'converted', 'rejected']),
  validateRequest,
  async (req, res) => {
    try {
      const { leadIds, status } = req.body;

      const result = await Lead.bulkUpdateStatus(leadIds, status);

      logger.info(`Bulk updated ${result.modifiedCount} leads to status: ${status}`);

      res.json({
        success: true,
        message: `Updated ${result.modifiedCount} leads`,
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      logger.error('Error bulk updating leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error bulk updating leads'
      });
    }
  }
);

export default router;