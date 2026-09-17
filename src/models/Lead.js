import mongoose from 'mongoose';
import crypto from 'crypto';

const leadSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 300
    },
    platform: {
      type: String,
      enum: ['twitter', 'facebook', 'reddit', 'google', 'instagram', 'manual'],
      required: true,
      index: true
    },
    sourceUrl: {
      type: String,
      required: true
    },
    postId: {
      type: String,
      sparse: true
    },
    author: {
      name: String,
      username: String,
      profileUrl: String,
      profileImage: String,
      accountAge: Number
    },
    contact: {
      phone: String,
      email: String,
      whatsapp: String
    },
    property: {
      type: String,
      location: String,
      bedrooms: Number,
      price: Number,
      currency: {
        type: String,
        default: 'PKR'
      },
      rentalType: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        sparse: true
      }
    },
    engagement: {
      likes: { type: Number, default: 0 },
      comments: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      views: { type: Number, default: 0 }
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    scoreBreakdown: {
      keywordRelevance: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 },
      credibilityScore: { type: Number, default: 0 },
      urgencyScore: { type: Number, default: 0 }
    },
    status: {
      type: String,
      enum: ['new', 'viewed', 'contacted', 'qualified', 'converted', 'rejected'],
      default: 'new'
    },
    notes: {
      type: String,
      trim: true
    },
    tags: [String],
    followUpDate: Date,
    hasPhone: { type: Boolean, default: false },
    hasEmail: { type: Boolean, default: false },
    mentionsUrgency: { type: Boolean, default: false },
    isFraud: { type: Boolean, default: false },
    postDate: {
      type: Date,
      default: Date.now
    },
    language: {
      type: String,
      default: 'ur'
    },
    imageUrls: [String],
    contentHash: {
      type: String
    },
    viewCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    lastInteraction: Date
  },
  {
    timestamps: true,
    collection: 'leads'
  }
);

leadSchema.index({ platform: 1, createdAt: -1 });
leadSchema.index({ score: -1 });
leadSchema.index({ status: 1 });
leadSchema.index({ 'author.username': 1 });
leadSchema.index({ sourceUrl: 1 }, { unique: true, sparse: true });
leadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 });
leadSchema.index({ 'contact.phone': 1 }, { sparse: true });
leadSchema.index({ 'contact.email': 1 }, { sparse: true });
leadSchema.index({ contentHash: 1 }, { sparse: true });

leadSchema.methods.generateContentHash = function() {
  const hash = crypto
    .createHash('sha256')
    .update(this.content.toLowerCase())
    .digest('hex');
  this.contentHash = hash;
};

leadSchema.methods.extractContactInfo = function() {
  const phoneRegex = /(?:(\+92)|0)?(?:3\d{2}|\d{2})\d{7,8}/g;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const phones = this.content.match(phoneRegex);
  const emails = this.content.match(emailRegex);

  if (phones && phones.length > 0) {
    this.contact.phone = phones[0];
    this.hasPhone = true;
  }

  if (emails && emails.length > 0) {
    this.contact.email = emails[0];
    this.hasEmail = true;
  }
};

leadSchema.methods.updateEngagement = function(metrics) {
  this.engagement = {
    likes: metrics.likes || this.engagement.likes,
    comments: metrics.comments || this.engagement.comments,
    shares: metrics.shares || this.engagement.shares,
    views: metrics.views || this.engagement.views
  };
  this.markModified('engagement');
};

leadSchema.methods.recalculateScore = function() {
  let score = 50;
  const relevantKeywords = ['rent', 'apartment', 'house', 'furnished', 'available', 'flat', 'bedroom'];
  const contentLower = this.content.toLowerCase();
  const keywordMatches = relevantKeywords.filter(k => contentLower.includes(k));
  this.scoreBreakdown.keywordRelevance = Math.min(keywordMatches.length * 5, 25);

  const totalEngagement = this.engagement.likes + this.engagement.comments + this.engagement.shares;
  this.scoreBreakdown.engagementScore = Math.min(totalEngagement / 5, 20);

  let credibility = 0;
  if (this.hasPhone) credibility += 10;
  if (this.hasEmail) credibility += 10;
  if (this.author && this.author.accountAge > 90) credibility += 10;
  this.scoreBreakdown.credibilityScore = credibility;

  const urgencyKeywords = ['urgent', 'asap', 'immediately', 'today', 'last', 'available now', 'contact now'];
  const hasUrgency = urgencyKeywords.some(k => contentLower.includes(k));
  this.mentionsUrgency = hasUrgency;
  this.scoreBreakdown.urgencyScore = hasUrgency ? 25 : 0;

  score =
    this.scoreBreakdown.keywordRelevance +
    this.scoreBreakdown.engagementScore +
    this.scoreBreakdown.credibilityScore +
    this.scoreBreakdown.urgencyScore;

  this.score = Math.min(Math.max(score, 0), 100);
};

leadSchema.statics.getLeadWithRelated = async function(leadId) {
  const lead = await this.findById(leadId);
  if (!lead) return null;

  const relatedLeads = await this.find({
    'author.username': lead.author.username,
    _id: { $ne: leadId }
  }).limit(5);

  return { lead, relatedLeads };
};

leadSchema.statics.bulkUpdateStatus = async function(leadIds, status) {
  return await this.updateMany(
    { _id: { $in: leadIds } },
    { status, lastInteraction: new Date() }
  );
};

leadSchema.statics.getByPlatform = async function(platform, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  return await this.find({ platform })
    .sort({ score: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
};

leadSchema.statics.getQualityLeads = async function(minScore = 70, limit = 50) {
  return await this.find({ score: { $gte: minScore } })
    .sort({ score: -1 })
    .limit(limit)
    .lean();
};

const Lead = mongoose.model('Lead', leadSchema);

export default Lead;
