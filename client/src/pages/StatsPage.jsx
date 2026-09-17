import { useEffect, useState } from 'react';
import { API_URL } from '../App.jsx';

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>
      <div>
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {sub && <span className="stat-sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/stats`).then(r => r.json()),
      fetch(`${API_URL}/api/leads?limit=5&sortBy=date`).then(r => r.json())
    ])
      .then(([statsRes, leadsRes]) => {
        setStats(statsRes.data);
        setRecentLeads(leadsRes.data || []);
      })
      .catch(err => setError(err.message));
  }, []);

  if (error) return <div className="error-box">Error loading stats: {error}</div>;
  if (!stats) return <div className="loading">Loading dashboard...</div>;

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>

      <div className="stats-grid">
        <StatCard icon="📊" label="Total Leads" value={stats.totalLeads} />
        <StatCard icon="🆕" label="New Leads" value={stats.newLeads} />
        <StatCard icon="📞" label="Contacts Found" value={stats.contactsFound} />
        <StatCard icon="⭐" label="Avg Score" value={stats.avgScore} sub="/ 100" />
        <StatCard icon="🗓️" label="Today" value={stats.todayLeads} />
        <StatCard icon="✅" label="Qualified" value={stats.qualifiedLeads} />
        <StatCard icon="🤝" label="Contacted" value={stats.contactedLeads} />
        <StatCard icon="🎯" label="Converted" value={stats.convertedLeads} />
      </div>

      <div className="two-columns">
        <div className="panel">
          <h3>Leads by Platform</h3>
          {stats.platformStats.length === 0 ? (
            <p className="empty">No leads yet. Run a scrape first.</p>
          ) : (
            <ul className="platform-list">
              {stats.platformStats.map(p => (
                <li key={p._id}>
                  <span className="platform-name">{platformIcon(p._id)} {p._id}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(p.count / Math.max(...stats.platformStats.map(x => x.count))) * 100}%` }}
                    />
                  </div>
                  <span className="platform-count">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h3>Recent Leads</h3>
          {recentLeads.length === 0 ? (
            <p className="empty">No recent leads.</p>
          ) : (
            <ul className="recent-list">
              {recentLeads.map(lead => (
                <li key={lead._id} className="recent-item">
                  <span className={`score-badge score-${scoreTier(lead.score)}`}>{lead.score}</span>
                  <div>
                    <span className="recent-title">{lead.title}</span>
                    <span className="recent-meta">
                      {platformIcon(lead.platform)} {lead.platform} · {new Date(lead.postDate).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function platformIcon(platform) {
  const icons = {
    twitter: '🐦',
    facebook: '📘',
    reddit: '👽',
    google: '🔍',
    instagram: '📸',
    manual: '✍️'
  };
  return icons[platform] || '📌';
}

function scoreTier(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}