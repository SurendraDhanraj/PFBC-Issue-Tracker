import { useState } from 'react';
import { useMutation } from 'convex/react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { useBranding } from '../context/BrandingContext';

export default function ForgotPassword() {
  const { appName, splashUrl, logoIcon } = useBranding();
  const requestReset = useMutation(api.auth.requestPasswordReset);
  const validateCode = useMutation(api.auth.validateResetCode);
  const resetPassword = useMutation(api.auth.resetPassword);
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=email, 2=code, 3=new password, 4=done
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestReset({ email });
      setStep(2);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await validateCode({ email, code });
      if (!res.valid) { setError(res.error || 'Invalid code.'); return; }
      setResetToken(res.token);
      setStep(3);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      const res = await resetPassword({ token: resetToken, newPassword });
      if (!res.success) { setError(res.error || 'Reset failed.'); return; }
      setStep(4);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* Logo */}
        <div className="login-logo">
          {splashUrl
            ? <img src={splashUrl} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            : logoIcon}
        </div>
        <h1 className="login-title">{appName}</h1>
        <p className="login-subtitle">Password Reset</p>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
          {['Email', 'Code', 'New Password'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step > i + 1 ? 'var(--status-open)' : step === i + 1 ? 'var(--blue-600)' : 'var(--surface-glass)',
                color: step >= i + 1 ? 'white' : 'var(--text-muted)',
                border: step === i + 1 ? '2px solid var(--blue-600)' : '2px solid transparent',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 11, color: step === i + 1 ? 'var(--blue-600)' : 'var(--text-muted)', fontWeight: step === i + 1 ? 600 : 400 }}>
                {label}
              </span>
              {i < 2 && <div style={{ width: 20, height: 1, background: 'var(--border)' }} />}
            </div>
          ))}
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        {/* Step 1: Email */}
        {step === 1 && (
          <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-email">Your Email Address</label>
              <input id="reset-email" type="email" className="form-control"
                placeholder="you@pf.health.gov.tt"
                value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: 0 }}>
              A 6-digit reset code will be generated. Contact your administrator to receive the code.
            </p>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? '⏳ Sending...' : '📧 Request Reset Code'}
            </button>
          </form>
        )}

        {/* Step 2: Code entry */}
        {step === 2 && (
          <form onSubmit={handleCodeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="alert" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#166534', borderRadius: 8, fontWeight: 500, fontSize: 13 }}>
              ✅ Reset requested. Your administrator has received a 6-digit code to share with you.
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="reset-code">6-Digit Reset Code</label>
              <input id="reset-code" type="text" className="form-control"
                placeholder="e.g. 483920"
                maxLength={6} inputMode="numeric" pattern="\d{6}"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required
                style={{ letterSpacing: 8, fontSize: 22, textAlign: 'center', fontWeight: 700 }} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading || code.length !== 6}>
              {loading ? '⏳ Verifying...' : '🔑 Verify Code'}
            </button>
          </form>
        )}

        {/* Step 3: New password */}
        {step === 3 && (
          <form onSubmit={handlePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-password">New Password</label>
              <input id="new-password" type="password" className="form-control"
                placeholder="At least 8 characters"
                value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">Confirm Password</label>
              <input id="confirm-password" type="password" className="form-control"
                placeholder="Re-enter your new password"
                value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
            </div>
            {/* Strength hint */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Strength: {' '}
              {newPassword.length === 0 ? '—'
                : newPassword.length < 8 ? <span style={{ color: '#ef4444' }}>Too short</span>
                : newPassword.length < 12 ? <span style={{ color: '#f59e0b' }}>Fair</span>
                : <span style={{ color: '#22c55e' }}>Strong</span>}
            </div>
            <button type="submit" className="btn btn-primary btn-lg"
              disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}>
              {loading ? '⏳ Saving...' : '🔐 Set New Password'}
            </button>
          </form>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Password Updated!</div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Your password has been changed. You can now sign in with your new password.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>
              → Go to Sign In
            </button>
          </div>
        )}

        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--blue-600)', textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
