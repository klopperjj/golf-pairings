import { useState, useEffect } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import ScorePage from './pages/ScorePage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

function NavBar({ isAdmin }) {
  const loc = useLocation();
  const links = [
    { to: '/', label: '📋 Draw', exact: true },
    { to: '/score', label: '⛳ Score' },
    { to: '/leaderboard', label: '🏆 Live' },
  ];
  return (
    <nav style={navStyles.bar}>
      {links.map(({ to, label, exact }) => {
        const active = exact ? loc.pathname === to : loc.pathname.startsWith(to);
        return (
          <Link key={to} to={to} style={{ ...navStyles.link, ...(active ? navStyles.linkActive : {}) }}>
            {label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link to="/admin" style={{ ...navStyles.link, ...(loc.pathname === '/admin' ? navStyles.linkActive : {}), fontSize: 11 }}>
          🔧
        </Link>
      )}
    </nav>
  );
}

function DrawRedirect() {
  useEffect(() => { window.location.href = '/draw.html'; }, []);
  return (
    <div style={{ background: C.darkGreen, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 50 }}>
      <div style={{ color: C.gold, fontFamily: 'Helvetica Neue,Arial,sans-serif', fontSize: 14 }}>Loading draw card…</div>
    </div>
  );
}

export default function App() {
  const [player, setPlayer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('golf_player')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('golf_token') || null);

  function handleLogin(p, t) { setPlayer(p); setToken(t); }
  function handleLogout() {
    localStorage.removeItem('golf_token');
    localStorage.removeItem('golf_player');
    setPlayer(null);
    setToken(null);
  }

  const isAdmin = player?.player_index === 0;

  return (
    <div style={{ paddingTop: 44 }}>
      <NavBar isAdmin={isAdmin} />
      <Routes>
        <Route path="/" element={<DrawRedirect />} />
        <Route
          path="/score"
          element={player && token
            ? <ScorePage player={player} token={token} onLogout={handleLogout} />
            : <LoginPage onLogin={handleLogin} />}
        />
        <Route path="/leaderboard" element={<LeaderboardPage player={player} />} />
        <Route
          path="/admin"
          element={player && token
            ? <AdminPage player={player} token={token} />
            : <LoginPage onLogin={handleLogin} />}
        />
      </Routes>
    </div>
  );
}

const navStyles = {
  bar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    background: 'rgba(14,45,28,0.97)', borderBottom: '1px solid rgba(201,168,76,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  },
  link: {
    display: 'inline-flex', alignItems: 'center', padding: '12px 22px',
    color: 'rgba(245,240,232,0.45)', textDecoration: 'none', fontSize: 12,
    fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5,
    borderBottom: '2px solid transparent', transition: 'color 0.2s',
  },
  linkActive: { color: C.gold, borderBottomColor: C.gold },
};
