import { useEffect, useState } from 'react';
import { API_URL } from '../App.jsx';

const PLATFORMS = ['twitter', 'facebook', 'reddit', 'google', 'instagram', 'manual'];
const STATUSES = ['new', 'viewed', 'contacted', 'qualified', 'converted', 'rejected'];
const PLATFORM_ICONS = {
  twitter: '🐦', facebook: '📘', reddit: '👽',
  google: '🔍', instagram: '📸', manual: '✍️'
};

function LeadCard({ lead, onStatusChange }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="lead-card">
      <div className="lead-head" onClick={() => setExpanded(!expanded)}>
        <span className={`score-badge score-${scoreTier(lead.score)}`}>{lead.score}</span>
        <div className="lead-main">
          <span className="lead-title">{lead.title}</span>
          <span className="lead-meta">
            {PLATFORM_ICONS[lead.platform]} {lead.platform}
            {' · '}{new Date(lead.postDate).toLocaleString()}
            {lead.hasPhone && ' · 📞'}
            {lead.hasEmail && ' · ✉️'}
            {lead.mentionsUrgency && ' · ⚡'}
          </span>
        </div>
        <span className="lead-status status-${lead.status}">{lead.status}</span>
      </div>

      {expanded && (
        <div className="lead-body">
          <p className="lead-content">{lead.content}</p>

          <div className="lead-details">
            {lead.author?.name && <span>👤 {lead.author.name}</span>}
            {lead.contact?.phone && <span>📞 {lead.contact.phone}</span>}
            {lead.contact?.email && <span>✉️ {lead.contact.email}</span>}
            {lead.sourceUrl && (
              <a href={lead.sourceUrl} target="_blank" rel="noreferrer" className="source-link">🔗 View Original Post</a>
            )}
          </div>

          <div className="engagement-row">
            <span>👍 {lead.engagement?.likes || 0}</span>
            <span>💬 {lead.engagement?.comments || 0}</span>
            <span>🔁 {lead.engagement?.shares || 0}</span>
            <span>👀 {lead.viewCount || 0}</span>
          </div>

          <div className="score-breakdown">
            <span title="Keyword relevance">Keyword: {lead.scoreBreakdown?.keywordRelevance}</span>
            <span title="Engagement">Engagement: {lead.scoreBreakdown?.engagementScore}</span>
            <span title="Credibility">Credibility: {lead.scoreBreakdown?.credibilityScore}</span>
            <span title="Urgency">Urgency: {lead.scoreBreakdown?.urgencyScore}</span>
          </div>

          <label className="status-select">
            Status:
            <select
              value={lead.status}
              onChange={e => onStatusChange(lead._id, e.target.value)}
            >
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

function scoreTier(score) {
  if (score >= 80) return 'high';
  if (score >= 60) return 'mid';
  return 'low';
}

export default function LeadsPage() {
  const [data, setData] = useState({ data: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    platform: '',
    status: '',
    search: '',
    minScore: '',
    maxScore: '',
    sortBy: 'score',
    sortOrder: 'desc'
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLead, setNewLead] = useState({ title: '', content: '', platform: 'manual', sourceUrl: '' });

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });

    setLoading(true);
    fetch(`${API_URL}/api/leads?${params.toString()}`)
      .then(r => r.json())
      .then(json => {
        setData(json);
        setError(null);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  }

  async function updateStatus(id, status) {
    const res = await fetch(`${API_URL}/api/leads/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      setFilters(prev => ({ ...prev }));
    }
  }

  async function deleteLead(id) {
    if (!confirm('Delete this lead?')) return;
    const res = await fetch(`${API_URL}/api/leads/${id}`, { method: 'DELETE' });
    if (res.ok) setFilters(prev => ({ ...prev }));
  }

  async function addLead(e) {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLead)
    });
    if (res.ok) {
      alert('Lead added');
      setShowAddForm(false);
      setNewLead({ title: '', content: '', platform: 'manual', sourceUrl: '' });
      setFilters(prev => ({ ...prev }));
    } else {
      const json = await res.json();
      alert(`Error: ${json.message || 'Could not add lead'}`);
    }
  }

  const { pagination } = data;

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Leads</h2>
        <div className="page-actions">
          <button className="btn" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Cancel' : '+ Add Lead'}
          </button>
          <button className="btn btn-secondary" onClick={exportCSV}>Export CSV</button>
        </div>
      </div>

      {showAddForm && (
        <form className="add-form panel" onSubmit={addLead}>
          <h3>Add Manual Lead</h3>
          <input
            placeholder="Title (min 5 chars)"
            value={newLead.title}
            onChange={e => setNewLead({ ...newLead, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Content"
            value={newLead.content}
            onChange={e => setNewLead({ ...newLead, content: e.target.value })}
            required
            rows={3}
          />
          <input
            placeholder="Source URL (https://...)"
            value={newLead.sourceUrl}
            onChange={e => setNewLead({ ...newLead, sourceUrl: e.target.value })}
            required
            type="url"
          />
          <select
            value={newLead.platform}
            onChange={e => setNewLead({ ...newLead, platform: e.target.value })}
          >
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button className="btn" type="submit">Save Lead</button>
        </form>
      )}

      <div className="filter-bar panel">
        <input
          className="search-input"
          placeholder="Search leads..."
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
        />
        <select value={filters.platform} onChange={e => setFilter('platform', e.target.value)}>
          <option value="">All Platforms</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filters.sortBy} onChange={e => setFilter('sortBy', e.target.value)}>
          <option value="score">Sort: Score</option>
          <option value="date">Sort: Date</option>
          <option value="engagement">Sort: Engagement</option>
        </select>
        <select value={filters.sortOrder} onChange={e => setFilter('sortOrder', e.target.value)}>
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
        <input
          className="score-input"
          type="number"
          placeholder="Min score"
          value={filters.minScore}
          onChange={e => setFilter('minScore', e.target.value)}
        />
      </div>

      {error && <div className="error-box">Error: {error}</div>}
      {loading && <div className="loading">Loading leads...</div>}

      {!loading && !error && data.data.length === 0 && (
        <p className="empty">No leads found. Run a scrape (`npm run scrape-now`) or add one manually.</p>
      )}

      <div className="lead-list">
        {data.data.map(lead => (
          <LeadCard
            key={lead._id}
            lead={lead}
            onStatusChange={updateStatus}
            onDelete={deleteLead}
          />
        ))}
      </div>

      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-secondary"
            disabled={pagination.page <= 1}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
          >
            ← Prev
          </button>
          <span className="page-indicator">Page {pagination.page} of {pagination.pages} ({pagination.total} leads)</span>
          <button
            className="btn btn-secondary"
            disabled={pagination.page >= pagination.pages}
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );

  async function exportCSV() {
    const res = await fetch(`${API_URL}/api/leads?limit=100`);
    const json = await res.json();
    const leads = json.data || [];

    const header = ['Title', 'Platform', 'Status', 'Score', 'Phone', 'Email', 'Source URL', 'Post Date', 'Content'];
    const rows = leads.map(l => [
      `"${(l.title || '').replace(/"/g, '""')}"`,
      l.platform,
      l.status,
      l.score,
      l.contact?.phone || '',
      l.contact?.email || '',
      l.sourceUrl || '',
      new Date(l.postDate).toISOString(),
      `"${(l.content || '').replace(/"/g, '""')}"`
    ]);

    const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `parker-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}