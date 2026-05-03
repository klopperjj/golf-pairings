import { useState } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import ScorePage from './pages/ScorePage.jsx';
import LeaderboardPage from './pages/LeaderboardPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import EventInfoPage from './pages/EventInfoPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import { EventProvider, EventLoadingGate, useEvent } from './lib/eventContext.jsx';

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

/** NavBar uses event slug from the URL (if any) so links stay scoped to the
 *  same event the user is viewing. Active-event routes use short paths. */
function NavBar({ isAdmin }) {
  const loc = useLocation();
  const slugMatch = loc.pathname.match(/^\/events\/([^/]+)/);
  const slug = slugMatch ? slugMatch[1] : null;
  const base = slug ? `/events/${slug}` : '';

  const links = [
    { to: `${base}/draw` || '/draw',         label: '📋 Draw' },
    { to: `${base}/score` || '/score',       label: '⛳ Score' },
    { to: `${base}/leaderboard` || '/leaderboard', label: '🏆 Live' },
    { to: '/events',                          label: '🗓 Events' },
  ].map(l => ({ ...l, to: l.to || '/' }));

  return (
    <nav style={navStyles.bar}>
      {links.map(({ to, label }) => {
        const active = to === '/' ? loc.pathname === to : loc.pathname.startsWith(to);
        return (
          <Link key={to} to={to} style={{ ...navStyles.link, ...(active ? navStyles.linkActive : {}) }}>
            {label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link to={`${base}/admin` || '/admin'} style={{ ...navStyles.link, ...(loc.pathname.endsWith('/admin') ? navStyles.linkActive : {}), fontSize: 11 }}>
          🔧
        </Link>
      )}
    </nav>
  );
}

/** Redirect "/" to the active event's draw/info page. */
function RootRedirect() {
  return <Navigate to="/draw" replace />;
}

/** Shared route content, gated on event load. */
function EventRoutes({ player, token, onLogin, onLogout }) {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/events" element={<HistoryPage />} />

      {/* Active-event short routes */}
      <Route path="/draw" element={<EventLoadingGate><EventInfoPage /></EventLoadingGate>} />
      <Route path="/score" element={<EventLoadingGate>{player && token
        ? <ScorePage player={player} token={token} onLogout={onLogout} />
        : <LoginPage onLogin={onLogin} />}</EventLoadingGate>} />
      <Route path="/leaderboard" element={<EventLoadingGate><LeaderboardPage player={player} /></EventLoadingGate>} />
      <Route path="/admin" element={<EventLoadingGate>{player && token
        ? <AdminPage player={player} token={token} />
        : <LoginPage onLogin={onLogin} />}</EventLoadingGate>} />

      {/* Slug-scoped routes for archived/non-active events */}
      <Route path="/events/:slug/draw" element={<EventLoadingGate><EventInfoPage /></EventLoadingGate>} />
      <Route path="/events/:slug/leaderboard" element={<EventLoadingGate><LeaderboardPage player={player} /></EventLoadingGate>} />
      <Route path="/events/:slug/score" element={<EventLoadingGate>{player && token
        ? <ScorePage player={player} token={token} onLogout={onLogout} />
        : <LoginPage onLogin={onLogin} />}</EventLoadingGate>} />
      <Route path="/events/:slug/admin" element={<EventLoadingGate>{player && token
        ? <AdminPage player={player} token={token} />
        : <LoginPage onLogin={onLogin} />}</EventLoadingGate>} />
    </Routes>
  );
}

/** Inner component that consumes EventContext (for is_admin from JWT comparison). */
function AppShell({ player, token, onLogin, onLogout }) {
  // Admin gating: trust the JWT payload (set at login). The event context's
  // own isReadOnly flag prevents archived-event mutations server-side regardless.
  const isAdmin = !!player?.is_admin;

  return (
    <div style={{ paddingTop: 44 }}>
      <NavBar isAdmin={isAdmin} />
      <EventRoutes player={player} token={token} onLogin={onLogin} onLogout={onLogout} />
    </div>
  );
}

export default function App() {
  const [player, setPlayer] = useState(() => {
    try { return JSON.parse(localStorage.getItem('golf_player')); } catch { return null; }
  });
  const [token, setToken] = useState(() => localStorage.getItem('golf_token') || null);

  function handleLogin(p, t) {
    setPlayer(p); setToken(t);
    localStorage.setItem('golf_player', JSON.stringify(p));
    localStorage.setItem('golf_token', t);
  }
  function handleLogout() {
    localStorage.removeItem('golf_token');
    localStorage.removeItem('golf_player');
    setPlayer(null);
    setToken(null);
  }

  return (
    <EventProvider>
      <AppShell player={player} token={token} onLogin={handleLogin} onLogout={handleLogout} />
    </EventProvider>
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
    display: 'inline-flex', alignItems: 'center', padding: '12px 18px',
    color: 'rgba(245,240,232,0.45)', textDecoration: 'none', fontSize: 12,
    fontFamily: 'Helvetica Neue,Arial,sans-serif', letterSpacing: 0.5,
    borderBottom: '2px solid transparent', transition: 'color 0.2s',
  },
  linkActive: { color: C.gold, borderBottomColor: C.gold },
};
