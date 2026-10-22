import React from 'react';
import { useApp } from '../context/AppContext.jsx';
import { CheckCircle2, AlertCircle, Info, Bell, X } from 'lucide-react';

export default function NotificationToast() {
  const { toasts } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      maxWidth: 400,
      pointerEvents: 'none'
    }}>
      {toasts.map((toast) => {
        let borderClr = 'var(--indigo-primary)';
        let IconComp = Info;
        let bgGlow = 'var(--indigo-glow)';

        if (toast.type === 'success') {
          borderClr = 'var(--emerald-primary)';
          bgGlow = 'var(--emerald-glow)';
          IconComp = CheckCircle2;
        } else if (toast.type === 'error') {
          borderClr = 'var(--rose-primary)';
          bgGlow = 'var(--rose-glow)';
          IconComp = AlertCircle;
        } else if (toast.type === 'alert') {
          borderClr = 'var(--amber-primary)';
          bgGlow = 'var(--amber-glow)';
          IconComp = Bell;
        }

        return (
          <div
            key={toast.id}
            className="animate-slide-up"
            style={{
              pointerEvents: 'auto',
              background: 'rgba(15, 23, 42, 0.95)',
              backdropFilter: 'blur(16px)',
              border: `1px solid ${borderClr}`,
              boxShadow: `0 8px 30px rgba(0,0,0,0.6), 0 0 20px ${bgGlow}`,
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12
            }}
          >
            <div style={{ color: borderClr, marginTop: 2, flexShrink: 0 }}>
              <IconComp size={20} />
            </div>
            <div style={{ flex: 1 }}>
              {toast.title && (
                <div style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 2
                }}>
                  {toast.title}
                </div>
              )}
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {toast.message}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
