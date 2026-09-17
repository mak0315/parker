import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LeadsPage from './pages/LeadsPage.jsx';
import StatsPage from './pages/StatsPage.jsx';

export const API_URL = import.meta.env.VITE_API_URL || '';

export default function App() {
  const [serverOnline, setServerOnline] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then(res => setServerOnline(res.ok))
      .catch(() => setServerOnline(false));

    const interval = setInterval(() => {
      fetch(`${API_URL}/api/health`)
        .then(res => setServerOnline(res.ok))
        .catch(() => setServerOnline(false));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo">🏠</span>
          <h1>Parker</h1>
          <span className="tagline">Islamabad Lead Tracker</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end className="nav-link">Dashboard</NavLink>
          <NavLink to="/leads" className="nav-link">Leads</NavLink>
        </nav>
        <span className={`status-dot ${serverOnline ? 'online' : 'offline'}`}>
          {serverOnline ? 'API Online' : 'API Offline'}
        </span>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<StatsPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}