import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import { soundService } from '../utils/audio.js';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BellRing,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Brain,
  ChevronDown,
  ChevronUp,
  Star,
  Send,
  Copy
} from 'lucide-react';

/* ─── Feedback Rating Form ────────────────────────────────────── */
function FeedbackForm({ trackingCode, onDone }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const ratingLabels = {
    1: 'Very Poor', 2: 'Poor', 3: 'Below Average', 4: 'Fair', 5: 'Average',
    6: 'Good', 7: 'Very Good', 8: 'Great', 9: 'Excellent', 10: '⭐ Outstanding!'
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating) { setError('Please select a rating from 1 to 10.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch(`/api/public/track/${trackingCode}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, feedbackText })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Submission failed');
      onDone(rating);
    } catch (err) {
      setError(err.message || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #f5f0fd 100%)', border: '2px solid #c4b5fd', borderRadius: 18, padding: '28px 24px', marginTop: 20, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
        <Star size={22} color="#7c3aed" fill="#c4b5fd" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>How was your experience?</h3>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#6b21a8', marginBottom: 20, fontWeight: 500 }}>
        Rate your Queueless experience &nbsp;(1 = Very Poor · 10 = Outstanding)
      </p>
      {error && (
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', borderRadius: 8, padding: '8px 12px', fontSize: '0.825rem', marginBottom: 14 }}>{error}</div>
      )}
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => {
            const sel = rating === n;
            const hov = hovered === n;
            return (
              <button key={n} type="button"
                onClick={() => setRating(n)}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  border: `2px solid ${(sel||hov) ? '#7c3aed' : '#d8b4fe'}`,
                  background: sel ? 'linear-gradient(135deg,#7c3aed,#6d28d9)' : (hov ? '#ede9fe' : '#fff'),
                  color: sel ? '#fff' : '#4c1d95',
                  fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer',
                  transition: 'all 0.15s', transform: (sel||hov) ? 'scale(1.12)' : 'scale(1)'
                }}>{n}</button>
            );
          })}
        </div>
        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: rating ? '#6d28d9' : '#9f9bb5', minHeight: 22, marginBottom: 16 }}>
          {rating ? `You selected: ${rating}/10 — ${ratingLabels[rating]}` : 'Tap a number above to rate'}
        </div>
        <textarea
          placeholder="Tell us about your experience (optional)…"
          value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
          rows={3}
          style={{ width: '100%', borderRadius: 10, border: '1.5px solid #d8b4fe', padding: '10px 14px', fontSize: '0.875rem', color: '#1e1b4b', background: '#fff', resize: 'vertical', outline: 'none', fontFamily: 'inherit', marginBottom: 16, boxSizing: 'border-box' }}
        />
        <button type="submit" disabled={submitting || !rating} className="btn btn-primary" style={{ width: '100%', opacity: (!rating || submitting) ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Send size={16} />
          <span>{submitting ? 'Submitting…' : 'Submit Feedback'}</span>
        </button>
      </form>
    </div>
  );
}

function FeedbackThankYou({ rating }) {
  return (
    <div style={{ background: 'linear-gradient(135deg,#d1fae5 0%,#ecfdf5 100%)', border: '2px solid #6ee7b7', borderRadius: 16, padding: '22px 20px', marginTop: 20, textAlign: 'center' }}>
      <CheckCircle2 size={32} color="#059669" style={{ margin: '0 auto 8px' }} />
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#065f46' }}>Thank you for your feedback! 🎉</div>
      <div style={{ fontSize: '0.875rem', color: '#047857', marginTop: 4 }}>
        You rated this experience <strong>{rating}/10</strong>. Your input helps us serve everyone better.
      </div>
    </div>
  );
}

function TrackingQRCode({ trackingCode }) {
  const [qrUrl, setQrUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const trackLink = `${window.location.origin}/track/${trackingCode}`;

  useEffect(() => {
    QRCode.toDataURL(trackLink, { width: 180, margin: 2, color: { dark: '#1e1b4b', light: '#ffffff' } })
      .then(setQrUrl).catch(console.error);
  }, [trackLink]);

  const handleCopy = () => {
    navigator.clipboard.writeText(trackLink).catch(() => {
      const inp = document.createElement('input');
      inp.value = trackLink;
      document.body.appendChild(inp); inp.select(); document.execCommand('copy'); document.body.removeChild(inp);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ background: '#faf5ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: '18px 16px', marginBottom: 20, textAlign: 'center' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>📱 Save Your Tracking Link</div>
      {qrUrl
        ? <img src={qrUrl} alt="Scan to open tracking page" style={{ width: 140, height: 140, borderRadius: 8, border: '2px solid #ddd6fe', padding: 4, background: '#fff' }} />
        : <div style={{ width: 140, height: 140, background: '#ede9fe', borderRadius: 8, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', fontSize: '0.75rem' }}>Generating…</div>
      }
      <div style={{ fontSize: '0.72rem', color: '#6b6684', marginTop: 6, marginBottom: 10 }}>Scan or copy to return to this page later</div>
      <button onClick={handleCopy} style={{ background: copied ? '#d1fae5' : '#f3e8ff', border: `1px solid ${copied ? '#6ee7b7' : '#c4b5fd'}`, color: copied ? '#065f46' : '#6b21a8', borderRadius: 8, padding: '6px 16px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Copy size={13} />{copied ? 'Copied!' : 'Copy Tracking Link'}
      </button>
    </div>
  );
}

export default function CustomerTrackView() {
  const {
    trackingCode,
    setCurrentView,
    liveEventCounter,
    addToast
  } = useApp();

  const [trackData, setTrackData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);
  const [showRfDetails, setShowRfDetails] = useState(true);

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(null);
  const [feedbackLoaded, setFeedbackLoaded] = useState(false);

  const loadTracking = useCallback(async (codeToUse) => {
    const code = codeToUse || trackingCode;
    if (!code) {
      setError('No tracking code provided. Please join a queue or enter your tracking code.');
      setLoading(false);
      return;
    }

    try {
      const data = await api.getTracking(code);
      setTrackData(data);
      setError('');

      if (data.status === 'COMPLETED' && !hasCelebrated) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setHasCelebrated(true);
      }

      if (data.isAlmostTurn && data.status === 'WAITING') {
        soundService.playAlert?.();
      }
    } catch (err) {
      setError(err.message || 'Unable to find queue record with this tracking code.');
    } finally {
      setLoading(false);
    }
  }, [trackingCode, hasCelebrated]);

  // Preload existing review status when COMPLETED
  useEffect(() => {
    if (trackData?.status === 'COMPLETED' && !feedbackLoaded) {
      setFeedbackLoaded(true);
      fetch(`/api/public/track/${trackingCode}/review`)
        .then(r => r.json())
        .then(d => {
          if (d.hasReview && d.review) {
            setFeedbackSubmitted(true);
            setFeedbackRating(d.review.rating);
          }
        })
        .catch(() => {});
    }
  }, [trackData?.status, trackingCode, feedbackLoaded]);

  useEffect(() => {
    loadTracking();
  }, [trackingCode, liveEventCounter]);

  const handleCancelQueue = async () => {
    if (!window.confirm('Are you sure you want to leave this virtual queue? This action cannot be undone.')) {
      return;
    }

    setCancelling(true);
    try {
      await api.cancelTracking(trackingCode);
      addToast({
        type: 'info',
        title: 'Queue Left',
        message: 'Your token has been cancelled. You have left the virtual queue.'
      });
      loadTracking();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Cancel Failed',
        message: err.message
      });
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 640, margin: '80px auto', textAlign: 'center', color: '#6b6684' }}>
        <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 14px', color: '#7c3aed' }} />
        <p style={{ fontWeight: 600 }}>Loading your live virtual queue position...</p>
      </div>
    );
  }

  if (error || !trackData) {
    return (
      <div style={{ maxWidth: 540, margin: '60px auto', padding: '0 20px' }}>
        <div className="glass-card" style={{ padding: 36, textAlign: 'center', border: '1px solid #e9d5ff' }}>
          <AlertTriangle size={48} color="#e11d48" style={{ margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 8 }}>Tracking Code Not Found</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b6684', marginBottom: 24, lineHeight: 1.5 }}>
            {error || 'We could not locate an active queue entry with this code.'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={() => setCurrentView('landing')}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} /> Return to Directory
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine status color & label
  let statusBadgeClass = 'badge-waiting';
  let statusTitle = 'Waiting in Queue';
  let statusDesc = 'Relax! We will notify you when it is your turn to head to the counter.';

  if (trackData.status === 'CALLED') {
    statusBadgeClass = 'badge-called';
    statusTitle = '🔔 NOW CALLING!';
    statusDesc = `Please proceed immediately to ${trackData.assignedCounter || 'your assigned counter'}.`;
  } else if (trackData.status === 'IN_SERVICE') {
    statusBadgeClass = 'badge-in_service';
    statusTitle = 'Being Attended';
    statusDesc = `You are currently being served at ${trackData.assignedCounter || 'the counter'}.`;
  } else if (trackData.status === 'COMPLETED') {
    statusBadgeClass = 'badge-completed';
    statusTitle = 'Service Completed';
    statusDesc = 'Thank you for visiting! Your consultation or service is finished.';
  } else if (trackData.status === 'NO_SHOW') {
    statusBadgeClass = 'badge-no_show';
    statusTitle = 'Missed / No-Show';
    statusDesc = 'The token was called and exceeded the grace period. Staff can re-queue you once.';
  } else if (trackData.status === 'SKIPPED') {
    statusBadgeClass = 'badge-skipped';
    statusTitle = 'Skipped by Staff';
    statusDesc = 'Your token was skipped. Please speak with the front desk or counter staff.';
  } else if (trackData.status === 'CANCELLED') {
    statusBadgeClass = 'badge-cancelled';
    statusTitle = 'Cancelled';
    statusDesc = 'You have cancelled this token and left the queue.';
  }

  const breakdown = trackData.breakdown || [];
  // Never fall back to a hardcoded 10 — show the real value or "Calculating..."
  const waitMins = trackData.estimatedWaitMins;
  const isWaitKnown = typeof waitMins === 'number' && waitMins >= 0;
  const useRF = trackData.waitMethod === 'random_forest_regressor';
  const formula = trackData.calculationFormula || (
    breakdown.length > 0
      ? breakdown.map((b, i) => `Person ${i+1} (${b.predictedMins}m)`).join(' + ') + ` = ${isWaitKnown ? waitMins : '?'} mins`
      : 'Calculating via Random Forest Regressor…'
  );

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 80px' }}>
      {/* Top Breadcrumb & Live Refresh */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
      }}>
        <button
          onClick={() => setCurrentView('landing')}
          className="btn btn-outline btn-sm"
          style={{ gap: 6, borderColor: '#ddd6fe', color: '#6d28d9' }}
        >
          <ArrowLeft size={14} /> Back to Directory
        </button>

        <button
          onClick={() => loadTracking()}
          className="btn btn-outline btn-sm"
          title="Refresh Live Status"
          style={{ borderColor: '#ddd6fe', color: '#6d28d9' }}
        >
          <RefreshCw size={14} /> Refresh Live Status
        </button>
      </div>

      {/* "Almost Your Turn" Alert Banner */}
      {trackData.isAlmostTurn && (
        <div 
          className="animate-slide-up"
          style={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            borderRadius: 16,
            padding: '16px 22px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 4px 18px rgba(217, 119, 6, 0.25)'
          }}
        >
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <BellRing size={22} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
              🔔 Almost Your Turn — Head to the Counter Area!
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.92)', marginTop: 2 }}>
              Only <strong>{trackData.positionAhead}</strong> {trackData.positionAhead === 1 ? 'person is' : 'people are'} ahead of you.
            </div>
          </div>
        </div>
      )}

      {/* Main Live Tracking Ticket Card (Light Purple Aesthetic) */}
      <div className="glass-card" style={{
        padding: '32px 28px',
        border: '1px solid #ddd6fe',
        boxShadow: '0 12px 36px -6px rgba(124, 58, 237, 0.12)',
        position: 'relative',
        background: '#ffffff'
      }}>
        {/* Organization & Service Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f3e8ff',
          paddingBottom: 18,
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12
        }}>
          <div>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {trackData.organizationName}
            </div>
            <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e1b4b', marginTop: 2 }}>
              {trackData.serviceName}
            </h2>
          </div>

          <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '0.85rem', padding: '6px 14px' }}>
            {statusTitle}
          </span>
        </div>

        {/* Hero Token Number Box */}
        <div style={{
          textAlign: 'center',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
          borderRadius: 20,
          padding: '28px 20px',
          marginBottom: 24,
          boxShadow: '0 10px 30px rgba(30, 27, 75, 0.25)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle decorative glow */}
          <div style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(168, 85, 247, 0.25)',
            filter: 'blur(30px)',
            pointerEvents: 'none'
          }} />

          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#c4b5fd', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
            YOUR LIVE QUEUE TOKEN
          </div>

          <div style={{
            fontSize: 'clamp(3rem, 10vw, 5rem)',
            fontWeight: 900,
            fontFamily: 'var(--font-heading)',
            color: '#facc15',
            letterSpacing: '0.06em',
            lineHeight: 1,
            margin: '0 0 12px',
            textShadow: '0 4px 18px rgba(250, 204, 21, 0.35)'
          }}>
            {trackData.tokenNumber}
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '5px 18px',
            borderRadius: 999,
            fontSize: '0.8rem',
            color: '#ede9fe',
          }}>
            Priority Category: <strong style={{ color: '#fff' }}>{trackData.priorityLevel}</strong>
          </div>
        </div>

        {/* Status Message Description */}
        <div style={{
          textAlign: 'center',
          fontSize: '0.975rem',
          color: '#3b2063',
          marginBottom: 24,
          lineHeight: 1.5,
          fontWeight: 500
        }}>
          {statusDesc}
        </div>

        {/* Assigned Counter Card (if Called or In-Service) */}
        {trackData.assignedCounter && (trackData.status === 'CALLED' || trackData.status === 'IN_SERVICE') && (
          <div 
            className="animate-slide-up"
            style={{
              background: 'linear-gradient(135deg, #f5f0fd 0%, #ede9fe 100%)',
              border: '2px solid #7c3aed',
              borderRadius: 'var(--radius-lg)',
              padding: '22px 24px',
              textAlign: 'center',
              marginBottom: 24,
              boxShadow: '0 6px 24px rgba(124, 58, 237, 0.18)'
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Proceed to Assigned Counter
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 900,
              color: '#1e1b4b',
              margin: '6px 0',
              fontFamily: 'var(--font-heading)'
            }}>
              {trackData.assignedCounter}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#4c1d95', fontWeight: 500 }}>
              Please present your token number to the staff member
            </div>
          </div>
        )}

        {/* Queue Metrics Grid (if still Waiting) */}
        {trackData.status === 'WAITING' && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginBottom: 24
          }}>
            {/* Position Ahead */}
            <div style={{
              background: '#faf5ff',
              border: '1px solid #eedcfc',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 18px',
              textAlign: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#7c3aed', marginBottom: 6 }}>
                <Users size={18} />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Position Ahead</span>
              </div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#1e1b4b' }}>
                {trackData.positionAhead}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b6684', fontWeight: 600 }}>
                {trackData.positionAhead === 0 ? 'You are next in line!' : `${trackData.positionAhead} ${trackData.positionAhead === 1 ? 'person' : 'people'} ahead`}
              </div>
            </div>

            {/* Estimated Wait */}
            <div style={{ background: '#faf5ff', border: '1px solid #eedcfc', borderRadius: 'var(--radius-lg)', padding: '20px 18px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#7c3aed', marginBottom: 6 }}>
                <Clock size={18} />
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Est. Waiting Time</span>
              </div>
              {trackData.positionAhead === 0 ? (
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>Next Up!</div>
              ) : isWaitKnown && waitMins > 0 ? (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#6d28d9' }}>
                    ~{waitMins}<span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#7c3aed', marginLeft: 4 }}>mins</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b6684', fontWeight: 600 }}>
                    {useRF ? '⚡ Random Forest Regressor' : '⚡ Estimated'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '1rem', fontWeight: 700, color: '#9f9bb5', paddingTop: 8 }}>Calculating…</div>
              )}
            </div>
          </div>
        )}

        {/* 🧠 Deep-Dive Random Forest Prediction Breakdown Card */}
        {trackData.status === 'WAITING' && (
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #d8b4fe',
            borderRadius: 16,
            padding: '20px',
            marginBottom: 24,
            boxShadow: '0 4px 20px rgba(124, 58, 237, 0.08)'
          }}>
            <div 
              onClick={() => setShowRfDetails(!showRfDetails)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Brain size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '0.925rem', fontWeight: 800, color: '#1e1b4b' }}>
                    How {useRF ? 'Random Forest' : 'AI'} Predicts Your Waiting Time
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>
                    Calculated per person ahead · {useRF ? '100 Trees Ensemble' : 'Heuristic Model'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
                  {trackData.positionAhead} People Ahead
                </span>
                {showRfDetails ? <ChevronUp size={18} color="#7c3aed" /> : <ChevronDown size={18} color="#7c3aed" />}
              </div>
            </div>

            {showRfDetails && (
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f3e8ff' }}>
                {/* Visual Formula Pill */}
                <div style={{
                  background: 'linear-gradient(135deg, #f5f0fd 0%, #faf5ff 100%)',
                  border: '1px solid #ddd6fe',
                  borderRadius: 12,
                  padding: '12px 16px',
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', marginBottom: 4 }}>
                    Live AI Computation Formula:
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: '#4c1d95',
                    wordBreak: 'break-word'
                  }}>
                    {formula}
                  </div>
                </div>

                {/* Person-by-Person Breakdown */}
                {breakdown.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b6684', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Individual Service Times Ahead:
                    </div>

                    {breakdown.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: '#fcfaff',
                          border: '1px solid #eedcfc',
                          borderRadius: 10,
                          fontSize: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            background: '#ede9fe',
                            color: '#6d28d9',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.75rem'
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <strong style={{ color: '#1e1b4b' }}>{item.personLabel}</strong>
                            <div style={{ fontSize: '0.72rem', color: '#7c779a' }}>
                              {item.taskType} · Priority: {item.priority}
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7c3aed' }}>
                            ~{item.predictedMins} mins
                          </div>
                          <div style={{ fontSize: '0.675rem', color: '#9f9bb5' }}>
                            RF estimate
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 14,
                  fontSize: '0.75rem',
                  color: '#6b6684',
                  background: '#faf5ff',
                  padding: '8px 12px',
                  borderRadius: 8
                }}>
                  <Sparkles size={14} color="#7c3aed" />
                  <span>
                    {useRF ? 'Random Forest factors in historical durations, service category, time of day, and counter concurrency.' : 'Estimate based on average service time and queue depth.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* QR Code Panel: shows /track/:code URL (not hash-based) */}
        <TrackingQRCode trackingCode={trackingCode} />

        {/* Privacy Notice (PRD AC-5: Zero names shown!) */}
        <div style={{ background: '#f8fafc', border: '1px solid #eedcfc', borderRadius: 'var(--radius-md)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem', color: '#6b6684', marginBottom: 20 }}>
          <ShieldCheck size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
          <span><strong>Privacy Protected:</strong> Your name and phone number are strictly confidential and never displayed on public tracking links or display screens.</span>
        </div>

        {/* Cancel Queue Action (PRD FR-6) */}
        {trackData.canCancel && (
          <div style={{ borderTop: '1px solid #f3e8ff', paddingTop: 20, textAlign: 'center' }}>
            <button
              onClick={handleCancelQueue}
              disabled={cancelling}
              className="btn btn-outline btn-sm"
              style={{ color: '#e11d48', borderColor: '#fecdd3' }}
            >
              <XCircle size={15} />
              <span>{cancelling ? 'Leaving queue...' : 'Leave Virtual Queue'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Feedback Section — shown only when COMPLETED ── */}
      {trackData.status === 'COMPLETED' && (
        feedbackSubmitted
          ? <FeedbackThankYou rating={feedbackRating} />
          : <FeedbackForm
              trackingCode={trackingCode}
              onDone={(r) => { setFeedbackSubmitted(true); setFeedbackRating(r); }}
            />
      )}
    </div>
  );
}
