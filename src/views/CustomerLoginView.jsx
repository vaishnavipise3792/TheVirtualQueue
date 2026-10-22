/**
 * CustomerLoginView.jsx
 *
 * Guest login for customers – they enter their name (no password required).
 * Existing guest-customer behaviour is preserved.
 *
 * Route: shown when currentView === 'login-customer'
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { Sparkles, User, ArrowRight, Ticket } from 'lucide-react';

export default function CustomerLoginView() {
  const { login, ROLE_DEFAULT_VIEW } = useAuth();
  const { setCurrentView, addToast } = useApp();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Please enter your name to continue.'); return; }
    setLoading(true);
    try {
      const user = await login({ email: name.trim(), role: 'CUSTOMER' });
      setCurrentView(ROLE_DEFAULT_VIEW[user.role]);
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #ede9fe 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      fontFamily: 'var(--font-body)'
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 24px rgba(124,58,237,0.35)'
          }}>
            <Sparkles size={30} color="#fff" />
          </div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.9rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.04em', lineHeight: 1 }}>
            Queueless
          </div>
          <div style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 700, letterSpacing: '0.08em', marginTop: 4 }}>
            AI RANDOM FOREST QUEUE
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 12px 40px -6px rgba(124,58,237,0.18)',
          border: '1px solid #e9d5ff'
        }}>
          {/* Header */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: '#f5f0fd', borderRadius: 10, padding: '6px 14px',
              marginBottom: 14
            }}>
              <Ticket size={15} color="#7c3aed" />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7c3aed', letterSpacing: '0.04em' }}>
                CUSTOMER ACCESS
              </span>
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-heading)', fontSize: '1.45rem', fontWeight: 800, color: '#1e1b4b' }}>
              Join the Virtual Queue
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#6b6684' }}>
              No account needed — enter your name to browse services and get your token.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#3b2063', marginBottom: 7 }}>
                Your Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#9ca3af" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  id="customer-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px 12px 42px',
                    border: '1.5px solid #e9d5ff', borderRadius: 10,
                    fontFamily: 'var(--font-body)', fontSize: '0.95rem',
                    color: '#1e1b4b', background: '#faf5ff',
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s'
                  }}
                  onFocus={e => e.target.style.borderColor = '#7c3aed'}
                  onBlur={e => e.target.style.borderColor = '#e9d5ff'}
                />
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
              id="customer-login-submit"
              style={{
                width: '100%', padding: '13px 20px',
                background: loading ? '#c4b5fd' : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                color: '#fff', border: 'none', borderRadius: 10,
                fontFamily: 'var(--font-heading)', fontSize: '1rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(124,58,237,0.3)'
              }}
            >
              {loading ? 'Entering...' : 'Continue to Queue'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Divider / Staff Link */}
          <div style={{ marginTop: 24, textAlign: 'center', borderTop: '1px solid #f0e9ff', paddingTop: 20 }}>
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#9f9bb5' }}>
              Are you a staff member?{' '}
              <button
                onClick={() => setCurrentView('login-staff')}
                style={{
                  background: 'none', border: 'none', color: '#7c3aed',
                  fontWeight: 700, cursor: 'pointer', fontSize: '0.82rem', padding: 0
                }}
              >
                Staff Login →
              </button>
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.78rem', color: '#9f9bb5' }}>
          🔒 Your name is only used for queue identification.
        </p>
      </div>
    </div>
  );
}
