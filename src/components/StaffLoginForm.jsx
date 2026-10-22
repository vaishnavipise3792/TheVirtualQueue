/**
 * StaffLoginForm.jsx
 *
 * Shared login form component used by all staff/admin login pages.
 * Accepts role-specific config props for branding.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { Sparkles, Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function StaffLoginForm({
  role,          // e.g. 'STAFF'
  portalLabel,   // e.g. 'STAFF CONSOLE'
  title,         // e.g. 'Staff Login'
  subtitle,      // e.g. 'Access the Staff Console to manage patient queues'
  Icon,          // Lucide icon component for role badge
  accentColor,   // e.g. '#7c3aed'
  defaultEmail,  // prefill for demo convenience
  onOtherPortal, // optional: { label, view } for switching portals
}) {
  const { login, ROLE_DEFAULT_VIEW } = useAuth();
  const { setCurrentView, allOrganizations, setCurrentOrg } = useApp();

  const [email, setEmail]     = useState(defaultEmail || '');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const ac = accentColor || '#7c3aed';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setLoading(true);
    try {
      const user = await login({ email: email.trim().toLowerCase(), password, role });
      // If the user's org is known, set it as the active org
      if (user.organization_id && allOrganizations.length > 0) {
        const userOrg = allOrganizations.find(o => o.id === user.organization_id);
        if (userOrg) setCurrentOrg(userOrg);
      }
      setCurrentView(ROLE_DEFAULT_VIEW[user.role]);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #ede9fe 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px 16px', fontFamily: 'var(--font-body)'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: `linear-gradient(135deg, #8b5cf6 0%, ${ac} 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: `0 8px 24px rgba(124,58,237,0.35)`
          }}>
            <Sparkles size={30} color="#fff" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.9rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Queueless
          </div>
          <div style={{ fontSize: '0.7rem', color: ac, fontWeight: 700, letterSpacing: '0.08em', marginTop: 4 }}>
            AI RANDOM FOREST QUEUE
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff', borderRadius: 20, padding: '36px 32px',
          boxShadow: '0 12px 40px -6px rgba(124,58,237,0.18)',
          border: '1px solid #e9d5ff'
        }}>
          {/* Role badge */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#f5f0fd', borderRadius: 10, padding: '6px 14px', marginBottom: 14
            }}>
              {Icon && <Icon size={15} color={ac} />}
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: ac, letterSpacing: '0.04em' }}>
                {portalLabel}
              </span>
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.45rem', fontWeight: 800, color: '#1e1b4b' }}>
              {title}
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#6b6684' }}>
              {subtitle}
            </p>
          </div>

          {/* Demo credentials hint */}
          <div style={{
            background: '#f5f0fd', borderRadius: 10, padding: '10px 14px',
            marginBottom: 22, border: '1px dashed #d8b4fe',
            fontSize: '0.8rem', color: '#6b21a8', lineHeight: 1.5
          }}>
            <strong>Demo credentials:</strong><br />
            Email: <code style={{ background: '#ede9fe', padding: '0 4px', borderRadius: 4 }}>{defaultEmail || '(see below)'}</code>
            &nbsp;| Password: <code style={{ background: '#ede9fe', padding: '0 4px', borderRadius: 4 }}>password123</code>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#3b2063', marginBottom: 7 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} color="#9ca3af" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email"
                  id={`${role.toLowerCase()}-email`}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px',
                    border: '1.5px solid #e9d5ff', borderRadius: 10,
                    fontFamily: 'var(--font-body)', fontSize: '0.95rem',
                    color: '#1e1b4b', background: '#faf5ff',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = ac}
                  onBlur={e => e.target.style.borderColor = '#e9d5ff'}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#3b2063', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} color="#9ca3af" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPass ? 'text' : 'password'}
                  id={`${role.toLowerCase()}-password`}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', padding: '12px 44px 12px 42px',
                    border: '1.5px solid #e9d5ff', borderRadius: 10,
                    fontFamily: 'var(--font-body)', fontSize: '0.95rem',
                    color: '#1e1b4b', background: '#faf5ff',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = ac}
                  onBlur={e => e.target.style.borderColor = '#e9d5ff'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                    padding: 2, display: 'flex', alignItems: 'center'
                  }}
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 18,
                background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c',
                fontSize: '0.85rem', fontWeight: 500
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              id={`${role.toLowerCase()}-login-submit`}
              style={{
                width: '100%', padding: '13px 20px',
                background: loading ? '#c4b5fd' : `linear-gradient(135deg, #8b5cf6 0%, ${ac} 100%)`,
                color: '#fff', border: 'none', borderRadius: 10,
                fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(124,58,237,0.3)'
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Other portal links */}
          {onOtherPortal && onOtherPortal.length > 0 && (
            <div style={{ marginTop: 24, borderTop: '1px solid #f0e9ff', paddingTop: 20 }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#9f9bb5', textAlign: 'center' }}>
                Other portals:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                {onOtherPortal.map(p => (
                  <button
                    key={p.view}
                    onClick={() => setCurrentView(p.view)}
                    style={{
                      background: '#f5f0fd', border: '1px solid #ddd6fe',
                      color: '#7c3aed', borderRadius: 8,
                      padding: '6px 14px', fontSize: '0.78rem', fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: '#9f9bb5' }}>
          🔒 Secured access — unauthorized use is prohibited.
        </p>
      </div>
    </div>
  );
}
