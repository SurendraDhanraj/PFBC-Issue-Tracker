import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const seedMutation = useMutation(api.seed.seedAll);
  const seedDistrictsMutation = useMutation(api.seedDistricts.seedDistricts);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Auto-seed categories, leave types, admin user and districts on first run
      await seedMutation().catch(() => {});
      await seedDistrictsMutation().catch(() => {});
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🏥</div>
        <h1 className="login-title">Point Fortin</h1>
        <p className="login-subtitle">Public Health Administration System</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div className="alert alert-error">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="you@pf.health.gov.tt"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: '14px 16px', background: 'rgba(59,130,246,0.08)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.15)' }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default Admin Credentials</div>
          <div style={{ fontSize: 13, color: 'var(--blue-300)' }}>📧 admin@pf.health.gov.tt</div>
          <div style={{ fontSize: 13, color: 'var(--blue-300)' }}>🔑 Admin@1234</div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 20 }}>
          Point Fortin Borough Corporation · Public Health Division
        </p>
      </div>
    </div>
  );
}
