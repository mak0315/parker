# 🏠 Parker - Real Estate Lead Generation Bot

A free, open-source lead aggregation bot for the Islamabad real estate market. Automatically scrapes and organizes leads from Twitter, Reddit, and Facebook into a web dashboard with lead scoring.

## Features
- Multi-platform scraping (Twitter, Reddit, Facebook)
- Lead scoring (keyword relevance, engagement, credibility, urgency)
- Web dashboard with filtering, search, and CSV export
- Automatic contact info extraction (phone / email)
- Rate-limit aware scrapers
- Duplicate detection via content hash

## Tech Stack
| Component | Technology |
|-----------|-----------|
| Backend | Node.js + Express |
| Database | MongoDB (Atlas free tier or local) |
| Scrapers | Node.js + REST APIs |
| Frontend | React + Vite |
| Scheduling | node-cron |

## Local Setup

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas free cluster)

### 1. Install
```bash
npm install
cd client && npm install && cd ..
```

### 2. Configure
Copy `.env.example` to `.env` and fill in:
- `MONGODB_URI` - your MongoDB connection string
- `TWITTER_BEARER_TOKEN` - from developer.twitter.com (optional)
- `FACEBOOK_ACCESS_TOKEN` - from developers.facebook.com (optional)

### 3. Run
```bash
# Terminal 1 - Backend API
npm run dev          # runs on http://localhost:5000

# Terminal 2 - Dashboard
cd client && npm run dev   # runs on http://localhost:3000
```

### 4. Collect Leads
```bash
# Run all configured scrapers once
npm run scrape-now

# Or scrape a specific platform
npm run scrape-now -- twitter,reddit
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads (filters: platform, status, minScore, maxScore, search, sortBy, page, limit) |
| GET | `/api/leads/:id` | Get single lead + related leads |
| GET | `/api/leads/quality` | High-scoring leads (default min 70) |
| POST | `/api/leads` | Create a lead manually |
| PATCH | `/api/leads/:id` | Update status / notes / tags / score |
| DELETE | `/api/leads/:id` | Delete a lead |
| POST | `/api/leads/bulk/update-status` | Bulk status update |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/stats/daily` | Leads per day (last N days) |
| GET | `/api/stats/sources` | Per-platform breakdown |
| GET | `/health` | Health check |
| GET | `/api/scrapers/status` | Scraper configuration status |

## Utility Scripts
```bash
npm run test-apis          # Verify MongoDB + all API keys
npm run clean-old-leads    # Delete leads older than 30 days (keeps active ones)
npm run logs               # Tail application logs
python scripts/test_scraper.py       # Test keyword/contact extraction logic
python scripts/facebook_scraper.py   # Optional Selenium-based FB scraper
```

## Configuration
Edit `config/keywords.js` to control what gets scraped:
- `locations` - Islamabad sectors / areas
- `propertyTypes` - apartments, houses, flats, rooms...
- `keywords` - matching terms
- `urgencyKeywords` - boosts a lead's urgency score
- `subreddits` / `twitterSearchQueries` / `facebookGroups`

## Deployment (Free)
Push to GitHub, then in Render:
1. New → Blueprint → select repo → `render.yaml` auto-configures both services.
2. Set the secret env vars (`MONGODB_URI`, tokens) in the Render dashboard.

## License
MIT - free to use and modify.