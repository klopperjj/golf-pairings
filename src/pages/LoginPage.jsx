import { useState } from 'react';

export default function LoginPage({ onLogin }) {
  const [mobile, setMobile] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Simple device fingerprint from browser signals
  function getDeviceFingerprint() {
    const raw = [
      navigator.userAgent,
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
    ].join('|');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return Math.abs(hash).toString(36);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: mobile.trim(),
          pin: pin.trim(),
          deviceFingerprint: getDeviceFingerprint(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      localStorage.setItem('golf_token', data.token);
      localStorage.setItem('golf_player', JSON.stringify(data.player));
      onLogin(data.player, data.token);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.goldBar} />
        <div style={styles.header}>
          <svg width="28" height="28" viewBox="0 0 30 30" style={{ display: 'block', margin: '0 auto 14px' }}>
            <circle cx="15" cy="26" r="2.8" fill="rgba(201,168,76,0.3)" />
            <rect x="14.2" y="6" width="1.6" height="20" fill="#c9a84c" />
            <polygon points="15.8,6 25,11 15.8,16" fill="#c9a84c" />
          </svg>
          <div style={styles.eyebrow}>Stellenbosch Invitational · 2026</div>
          <div style={styles.title}>Score Entry</div>
          <div style={styles.sub}>Sign in to enter your four-ball scores</div>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Mobile Number</label>
            <input
              type="tel"
              placeholder="e.g. 0821234567"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              style={styles.input}
              inputMode="numeric"
              maxLength={15}
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>4-Digit PIN</label>
            <input
              type="password"
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value)}
              style={{ ...styles.input, letterSpacing: '0.3em', textAlign: 'center' }}
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              required
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In ⛳'}
          </button>
        </form>

        <div style={styles.footer}>PIN issued via WhatsApp · Contact Juan if locked out</div>
        <div style={styles.goldBar} />
      </div>
    </div>
  );
}

const C = { green: '#1c4832', darkGreen: '#0e2d1c', gold: '#c9a84c', teal: '#4ecfb0', text: '#f5f0e8' };

const styles = {
  page: {
    background: C.darkGreen,
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  card: {
    background: C.green,
    width: 360,
    borderRadius: 3,
    color: C.text,
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
  },
  goldBar: { height: 5, background: 'linear-gradient(90deg,#a07830,#c9a84c,#e8c96a,#c9a84c,#a07830)' },
  header: { padding: '28px 36px 22px', textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,0.3)' },
  eyebrow: { color: C.gold, fontSize: 10, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 'normal', marginBottom: 5 },
  sub: { fontSize: 11, color: 'rgba(245,240,232,0.38)', letterSpacing: 1.5, fontStyle: 'italic' },
  form: { padding: '24px 32px' },
  fieldGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Helvetica Neue,Arial,sans-serif', color: 'rgba(201,168,76,0.7)', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box', background: 'rgba(0,0,0,0.25)',
    border: '1px solid rgba(201,168,76,0.3)', borderRadius: 3,
    color: C.text, fontSize: 16, padding: '10px 14px', fontFamily: 'Helvetica Neue,Arial,sans-serif',
    outline: 'none',
  },
  error: { background: 'rgba(220,60,60,0.15)', border: '1px solid rgba(220,60,60,0.3)', borderRadius: 3, color: 'rgba(220,100,100,0.9)', fontSize: 12, padding: '8px 12px', marginBottom: 14, fontFamily: 'Helvetica Neue,Arial,sans-serif' },
  btn: {
    width: '100%', background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.5)',
    borderRadius: 3, color: C.gold, fontSize: 14, padding: '12px', cursor: 'pointer',
    fontFamily: "Georgia,'Times New Roman',serif", letterSpacing: 1, marginTop: 8,
  },
  footer: { textAlign: 'center', padding: '10px 20px 14px', fontSize: 10, color: 'rgba(245,240,232,0.22)', fontFamily: 'Helvetica Neue,Arial,sans-serif', fontStyle: 'italic' },
};
