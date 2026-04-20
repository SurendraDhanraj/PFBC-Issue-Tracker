import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { appName, tagline, splashUrl, logoIcon } = useBranding();
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
        <div className="login-logo">
          {splashUrl
            ? <img src={splashUrl} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12 }} />
            : logoIcon}
        </div>
        <h1 className="login-title">{appName}</h1>
        <p className="login-subtitle">{tagline}</p>

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
          <Link
            to="/forgot-password"
            style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--blue-400)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Forgot your password?
          </Link>
        </form>
      </div>
    </div>

  );
}
