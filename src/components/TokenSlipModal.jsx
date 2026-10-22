import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import QRCode from 'qrcode';
import {
  Printer,
  ExternalLink,
  X,
  Clock,
  Sparkles,
  Brain,
  Layers,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

export default function TokenSlipModal() {
  const { tokenSlipData, closeTokenSlip, navigateToTrack } = useApp();
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    if (!tokenSlipData?.trackingCode) return;
    const url = `${window.location.origin}/track/${tokenSlipData.trackingCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }).catch(() => {
      // Fallback: select a temporary input
      const inp = document.createElement('input');
      inp.value = url;
      document.body.appendChild(inp);
      inp.select();
      document.execCommand('copy');
      document.body.removeChild(inp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // Build the correct tracking URL using pathname-based routing
  const trackUrl = tokenSlipData?.trackingCode
    ? `${window.location.origin}/track/${tokenSlipData.trackingCode}`
    : '';

  useEffect(() => {
    if (trackUrl) {
      QRCode.toDataURL(trackUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1e1b4b',
          light: '#ffffff'
        }
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code generation failed:', err));
    }
  }, [trackUrl]);

  if (!tokenSlipData) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleOpenLiveTracker = () => {
    const code = tokenSlipData.trackingCode;
    closeTokenSlip();
    navigateToTrack(code);
  };

  const waitMins = tokenSlipData.estimatedWaitMins ?? 10;
  const breakdown = tokenSlipData.waitBreakdown || tokenSlipData.breakdown || [];
  const formula = tokenSlipData.calculationFormula || (
    breakdown.length > 0 
      ? breakdown.map((b, i) => `Person ${i+1} (${b.predictedMins}m)`).join(' + ') + ` = ${waitMins} mins`
      : 'Calculated using Random Forest Regressor'
  );

  return (
    <div className="modal-overlay" onClick={closeTokenSlip}>
      <div 
        className="modal-content" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 480, padding: 0, overflow: 'hidden', border: '1px solid #ddd6fe' }}
      >
        {/* Printable Ticket Slip Area */}
        <div 
          className="printable-slip"
          style={{
            background: '#ffffff',
            color: '#1e1b4b',
            padding: '28px 24px',
            textAlign: 'center',
            position: 'relative'
          }}
        >
          {/* Close button (hidden on print) */}
          <button
            onClick={closeTokenSlip}
            className="btn btn-outline btn-sm"
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              borderRadius: 'var(--radius-full)',
              padding: 5,
              color: '#6b21a8',
              borderColor: '#e9d5ff',
              background: '#faf5ff'
            }}
          >
            <X size={16} />
          </button>

          {/* AI Virtual Token Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#f3e8ff',
            border: '1px solid #d8b4fe',
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 800,
            color: '#6b21a8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 12
          }}>
            <Sparkles size={13} color="#7c3aed" /> Queueless Virtual Token
          </div>

          <h2 style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: '#1e1b4b',
            marginBottom: 2
          }}>
            {tokenSlipData.organizationName}
          </h2>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#6b21a8', marginBottom: 16 }}>
            {tokenSlipData.serviceName}
          </div>

          {/* Big Token Number Display (Light Purple Theme) */}
          <div style={{
            background: 'linear-gradient(135deg, #faf5ff 0%, #f5f0fd 100%)',
            border: '2px dashed #c4b5fd',
            borderRadius: 18,
            padding: '16px 24px',
            margin: '0 auto 18px',
            display: 'inline-block',
            minWidth: 240,
            boxShadow: '0 4px 15px rgba(124, 58, 237, 0.08)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Your Token Number
            </div>
            <div style={{
              fontSize: '2.8rem',
              fontWeight: 900,
              color: '#581c87',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.04em',
              lineHeight: 1.15
            }}>
              {tokenSlipData.tokenNumber}
            </div>
            <div style={{
              display: 'inline-block',
              marginTop: 4,
              padding: '2px 10px',
              borderRadius: 999,
              fontSize: '0.75rem',
              fontWeight: 700,
              background: tokenSlipData.priorityLevel === 'EMERGENCY' ? '#fee2e2' : (tokenSlipData.priorityLevel === 'PREMIUM' ? '#f3e8ff' : '#ede9fe'),
              color: tokenSlipData.priorityLevel === 'EMERGENCY' ? '#dc2626' : (tokenSlipData.priorityLevel === 'PREMIUM' ? '#7e22ce' : '#6d28d9')
            }}>
              Priority: {tokenSlipData.priorityLevel}
            </div>
          </div>

          {/* 🧠 AI Random Forest Predicted Waiting Time Card */}
          <div style={{
            background: '#faf5ff',
            border: '1px solid #d8b4fe',
            borderRadius: 14,
            padding: '14px 16px',
            margin: '0 auto 16px',
            textAlign: 'left'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800, color: '#6b21a8' }}>
                <Brain size={16} color="#7c3aed" />
                <span>AI Predicted Waiting Time</span>
              </div>
              <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', fontSize: '0.7rem' }}>
                Random Forest (100 Trees)
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#4c1d95', lineHeight: 1 }}>
                ~{waitMins}
                <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7c3aed', marginLeft: 4 }}>mins</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684' }}>
                ahead of your turn
              </div>
            </div>

            {/* Individual Person Breakdown Visualization (e.g. 3m + 7m = 10m) */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e9d5ff',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: '0.8rem',
              color: '#3b2063'
            }}>
              <div style={{ fontSize: '0.725rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 6 }}>
                Queue Duration Calculation:
              </div>

              {breakdown.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {breakdown.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#ede9fe',
                          color: '#6d28d9',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: 800
                        }}>
                          {idx + 1}
                        </span>
                        <span>{item.personLabel}</span>
                        <span style={{ fontSize: '0.72rem', color: '#8b5cf6' }}>({item.taskType || item.priority})</span>
                      </span>
                      <strong style={{ color: '#6d28d9' }}>{item.predictedMins} mins</strong>
                    </div>
                  ))}
                  <div style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '1px dashed #e9d5ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 800,
                    color: '#4c1d95',
                    fontSize: '0.825rem'
                  }}>
                    <span>Total Wait ({formula})</span>
                    <span style={{ color: '#7c3aed' }}>= {waitMins} mins</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#6b6684', fontStyle: 'italic', fontSize: '0.78rem' }}>
                  {formula}
                </div>
              )}
            </div>
          </div>

          {/* QR Code — encodes /track/:trackingCode (correct pathname route) */}
          <div style={{ margin: '8px auto 14px', textAlign: 'center' }}>
            {qrDataUrl ? (
              <>
                <img 
                  src={qrDataUrl} 
                  alt="Scan to track queue live" 
                  style={{ width: 150, height: 150, borderRadius: 10, border: '2px solid #ddd6fe', padding: 4, background: '#fff' }} 
                />
                <div style={{ fontSize: '0.75rem', color: '#6b6684', marginTop: 4 }}>
                  📱 Scan to open your live tracking page
                </div>
              </>
            ) : (
              <div style={{ fontSize: '0.78rem', color: '#9f9bb5', padding: '10px 0' }}>Generating QR code…</div>
            )}
            <button
              onClick={handleCopyLink}
              style={{
                marginTop: 8,
                background: copied ? '#d1fae5' : '#f3e8ff',
                border: `1px solid ${copied ? '#6ee7b7' : '#d8b4fe'}`,
                color: copied ? '#065f46' : '#6b21a8',
                borderRadius: 8,
                padding: '5px 14px',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {copied ? '✓ Link Copied!' : '🔗 Copy Tracking Link'}
            </button>
          </div>

          <div style={{
            fontSize: '0.75rem',
            color: '#8b85a3',
            borderTop: '1px solid #f3e8ff',
            paddingTop: 8,
            marginTop: 8
          }}>
            Joined: {new Date(tokenSlipData.joinedAt || Date.now()).toLocaleTimeString()} · Code: {tokenSlipData.trackingCode}
          </div>
        </div>

        {/* Modal Footer Controls (Light Purple Buttons) */}
        <div style={{
          padding: '16px 20px',
          background: '#f5f0fd',
          borderTop: '1px solid #ddd6fe',
          display: 'flex',
          gap: 12
        }}>
          <button
            onClick={handlePrint}
            className="btn btn-secondary"
            style={{ flex: 1 }}
          >
            <Printer size={16} />
            <span>Print Slip</span>
          </button>

          <button
            onClick={handleOpenLiveTracker}
            className="btn btn-primary"
            style={{ flex: 1.3 }}
          >
            <ExternalLink size={16} />
            <span>Open Live Tracker</span>
          </button>
        </div>
      </div>
    </div>
  );
}
