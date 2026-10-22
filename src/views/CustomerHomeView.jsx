import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import {
  HeartPulse,
  Building2,
  Landmark,
  Clock,
  Users,
  Search,
  ArrowRight,
  Tv,
  Ticket,
  ChevronRight,
  Sparkles,
  Brain,
  Zap,
} from 'lucide-react';

/* Sector colour configs tailored with Light Purple aesthetics */
const SECTOR = {
  HOSPITAL: {
    Icon: HeartPulse,
    label: 'Healthcare',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
    cardBorder: '#e9d5ff',
    cardAccent: '#7c3aed',
    badge: { bg: '#f5f0fd', color: '#6d28d9', border: '#ddd6fe' },
    filterBg: '#f5f0fd',
    filterColor: '#7c3aed',
    filterBorder: '#ddd6fe',
  },
  BANK: {
    Icon: Building2,
    label: 'Banking',
    iconBg: '#ede9fe',
    iconColor: '#6d28d9',
    cardBorder: '#d8b4fe',
    cardAccent: '#6d28d9',
    badge: { bg: '#f3e8ff', color: '#581c87', border: '#c4b5fd' },
    filterBg: '#ede9fe',
    filterColor: '#6d28d9',
    filterBorder: '#c4b5fd',
  },
  SERVICE_CENTRE: {
    Icon: Landmark,
    label: 'Civic Services',
    iconBg: '#faf5ff',
    iconColor: '#8b5cf6',
    cardBorder: '#e9d5ff',
    cardAccent: '#8b5cf6',
    badge: { bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
    filterBg: '#faf5ff',
    filterColor: '#8b5cf6',
    filterBorder: '#ddd6fe',
  },
};

export default function CustomerHomeView() {
  const {
    sectors,
    allOrganizations,
    currentOrg,
    setCurrentOrg,
    openJoinModal,
    navigateToTrack,
    navigateToDisplay,
    liveEventCounter,
  } = useApp();

  const [selectedSector, setSelectedSector] = useState('ALL');
  const [orgDetails, setOrgDetails] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(false);
  const [trackInputCode, setTrackInputCode] = useState('');
  const [trackError, setTrackError] = useState('');

  useEffect(() => {
    if (!currentOrg?.id) return;
    let cancelled = false;
    setLoadingOrg(true);
    api.getOrgDetails(currentOrg.id)
      .then(data => { if (!cancelled) setOrgDetails(data); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoadingOrg(false); });
    return () => { cancelled = true; };
  }, [currentOrg?.id, liveEventCounter]);

  const handleTrackSubmit = e => {
    e.preventDefault();
    const clean = trackInputCode.trim();
    if (!clean) return;
    setTrackError('');
    navigateToTrack(clean);
  };

  const filteredOrgs = allOrganizations.filter(o =>
    selectedSector === 'ALL' ? true : o.type === selectedSector
  );

  return (
    <div style={{ maxWidth: 1320, margin: '0 auto', padding: '28px 20px 80px' }}>

      {/* ── HERO BANNER (Light Purple Theme with Deep Violet Contrast) ─────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #2e1065 60%, #3b0764 100%)',
        borderRadius: 24,
        padding: '48px 40px',
        marginBottom: 36,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 16px 40px -10px rgba(76, 29, 149, 0.35)'
      }}>
        {/* Decorative subtle violet glow orbs */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 280, height: 280,
          borderRadius: '50%', background: 'rgba(168, 85, 247, 0.2)', filter: 'blur(60px)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: -50, left: 200, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(124, 58, 237, 0.15)', filter: 'blur(50px)', pointerEvents: 'none'
        }} />

        {/* Top Accent Line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: 'linear-gradient(90deg, #c084fc 0%, #7c3aed 50%, #facc15 100%)'
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255, 255, 255, 0.14)', color: '#facc15',
          border: '1px solid rgba(250, 204, 21, 0.3)',
          padding: '5px 14px', borderRadius: 999,
          fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 20
        }}>
          <Sparkles size={14} color="#facc15" /> Random Forest AI Waiting Times · Multi-Sector Queues
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 4vw, 3.2rem)',
          fontWeight: 900,
          color: '#ffffff',
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          maxWidth: 720,
          marginBottom: 16,
        }}>
          Skip the queue.{' '}
          <span style={{
            background: 'linear-gradient(135deg, #e9d5ff 0%, #c084fc 50%, #facc15 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Never wait blindly.
          </span>
        </h1>

        <p style={{ color: '#c4b5fd', fontSize: '1.05rem', maxWidth: 600, lineHeight: 1.65, marginBottom: 32 }}>
          Virtual queueing for Hospital OPDs, Bank teller counters, and Citizen Service centres.
          Predicts queue waiting times per person ahead with 100-tree Random Forest Regression.
        </p>

        {/* Live Track Code Input */}
        <form onSubmit={handleTrackSubmit}
          style={{
            display: 'flex', gap: 8, maxWidth: 500,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1.5px solid rgba(221, 214, 254, 0.28)',
            padding: 6, borderRadius: 14,
            backdropFilter: 'blur(8px)'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 12, color: '#c4b5fd' }}>
            <Ticket size={18} />
          </div>
          <input
            type="text"
            placeholder="Have a tracking code? e.g. q_abc123"
            value={trackInputCode}
            onChange={e => setTrackInputCode(e.target.value)}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#ffffff', fontFamily: 'var(--font-mono)', fontSize: '0.9rem',
            }}
          />
          <button type="submit" style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            color: '#ffffff', border: 'none',
            padding: '10px 22px', borderRadius: 10, fontWeight: 800,
            fontSize: '0.875rem', cursor: 'pointer', display: 'flex',
            alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)',
            boxShadow: '0 4px 14px rgba(124, 58, 237, 0.4)'
          }}>
            Track Live <ArrowRight size={15} />
          </button>
        </form>
        {trackError && <p style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: 8 }}>{trackError}</p>}
      </div>

      {/* ── SECTOR FILTER ────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e1b4b' }}>Choose Your Organization</h2>
            <p style={{ fontSize: '0.85rem', color: '#6b6684', marginTop: 2 }}>
              One unified Queue Engine — Hospitals, Financial Branches & Citizen Service Centres
            </p>
          </div>

          {/* Filter tabs (Light Purple) */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { key: 'ALL', label: 'All Sectors' },
              { key: 'HOSPITAL', label: '🏥 Hospital' },
              { key: 'BANK', label: '🏦 Bank' },
              { key: 'SERVICE_CENTRE', label: '🏢 Citizen Service' },
            ].map(t => {
              const on = selectedSector === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setSelectedSector(t.key)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: `1.5px solid ${on ? '#7c3aed' : '#e9d5ff'}`,
                    background: on ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' : '#ffffff',
                    color: on ? '#ffffff' : '#4c1d95',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '0.825rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 160ms ease',
                    boxShadow: on ? '0 2px 10px rgba(124, 58, 237, 0.25)' : 'none'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Org Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {filteredOrgs.map(org => {
            const cfg = SECTOR[org.type] || SECTOR.SERVICE_CENTRE;
            const { Icon } = cfg;
            const isSelected = currentOrg?.id === org.id;

            return (
              <div
                key={org.id}
                onClick={() => setCurrentOrg(org)}
                style={{
                  background: '#ffffff',
                  border: `2px solid ${isSelected ? '#7c3aed' : '#eedcfc'}`,
                  borderRadius: 18,
                  padding: 24,
                  cursor: 'pointer',
                  boxShadow: isSelected
                    ? `0 0 0 3px rgba(124, 58, 237, 0.2), 0 8px 24px rgba(124, 58, 237, 0.12)`
                    : '0 2px 8px rgba(124, 58, 237, 0.04)',
                  transition: 'all 180ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: cfg.iconBg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(124, 58, 237, 0.12)'
                  }}>
                    <Icon size={24} color={cfg.iconColor} />
                  </div>
                  <span style={{
                    padding: '4px 12px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
                    background: cfg.badge.bg, color: cfg.badge.color, border: `1px solid ${cfg.badge.border}`,
                    letterSpacing: '0.04em', textTransform: 'uppercase',
                  }}>
                    {cfg.label}
                  </span>
                </div>

                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 4 }}>
                    {org.name}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: '#6b6684', lineHeight: 1.5 }}>
                    {org.description}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #f3e8ff', fontSize: '0.825rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#6b6684' }}>
                    <Users size={15} color="#7c3aed" />
                    <span><strong style={{ color: '#1e1b4b' }}>{org.active_waiting || 0}</strong> waiting</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#7c3aed', fontWeight: 800 }}>
                    {isSelected ? 'Active Selection ✓' : 'Select'} <ChevronRight size={15} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── SERVICES FOR SELECTED ORG ───────────────────────────── */}
      {currentOrg && (
        <div style={{
          background: '#ffffff',
          borderRadius: 20,
          border: '1.5px solid #e9d5ff',
          boxShadow: '0 4px 20px rgba(124, 58, 237, 0.06)',
          padding: '30px 26px',
          marginTop: 8,
        }}>
          {/* Section header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 14, marginBottom: 24,
            paddingBottom: 20, borderBottom: '1.5px solid #f3e8ff',
          }}>
            <div>
              {(() => {
                const cfg = SECTOR[currentOrg.type] || SECTOR.SERVICE_CENTRE;
                return (
                  <span style={{
                    padding: '4px 14px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800,
                    background: cfg.badge.bg, color: cfg.badge.color, border: `1px solid ${cfg.badge.border}`,
                    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'inline-block', marginBottom: 8,
                  }}>
                    {cfg.label}
                  </span>
                );
              })()}
              <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e1b4b' }}>
                {currentOrg.name} — Available Service Queues
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6b6684', marginTop: 3 }}>
                Join a virtual line with instant Random Forest wait time calculation
              </p>
            </div>

            {orgDetails?.services?.[0] && (
              <button
                onClick={() => navigateToDisplay(orgDetails.services[0].id)}
                className="btn btn-secondary btn-sm"
              >
                <Tv size={15} /> Open TV Waiting Display
              </button>
            )}
          </div>

          {loadingOrg ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9f9bb5' }}>
              Loading active queues…
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 18 }}>
              {orgDetails?.services?.map(service => {
                const cfg = SECTOR[currentOrg.type] || SECTOR.SERVICE_CENTRE;
                return (
                  <div
                    key={service.id}
                    style={{
                      background: '#fcfaff',
                      border: '1.5px solid #eedcfc',
                      borderRadius: 16,
                      padding: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      boxShadow: 'var(--shadow-xs)'
                    }}
                  >
                    {/* Service header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 800,
                          padding: '3px 10px', borderRadius: 8,
                          background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd',
                        }}>
                          {service.code}
                        </span>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e1b4b', marginTop: 8 }}>
                          {service.name}
                        </h3>
                      </div>
                    </div>

                    {/* Stats row with AI Random Forest Indicator */}
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr',
                      gap: 12, background: '#ffffff',
                      border: '1px solid #e9d5ff', borderRadius: 12, padding: 14,
                    }}>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em' }}>
                          In Queue
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#7c3aed', lineHeight: 1.1 }}>
                          {service.waiting_count || 0}
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9f9bb5', marginLeft: 4 }}>tokens</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.7rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Brain size={12} color="#7c3aed" /> RF Wait
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#6d28d9', lineHeight: 1.1 }}>
                          ~{service.estimatedWaitMins || 10}
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9f9bb5', marginLeft: 4 }}>mins</span>
                        </div>
                      </div>
                    </div>

                    {/* Priority note */}
                    <div style={{ fontSize: '0.75rem', color: '#6b6684' }}>
                      <span style={{ fontWeight: 700, color: '#3b2063' }}>Priorities: </span>
                      {service.priorityLevels?.map(p => p.label).join(' · ')}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => openJoinModal(service)}
                        style={{
                          flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff',
                          border: 'none', borderRadius: 10, padding: '12px 0',
                          fontFamily: 'var(--font-heading)', fontSize: '0.925rem', fontWeight: 800,
                          cursor: 'pointer', transition: 'all 160ms ease',
                          boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
                        }}
                        onMouseOver={e => e.currentTarget.style.opacity = '0.92'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}
                      >
                        <Ticket size={16} /> Join Virtual Queue
                      </button>
                      <button
                        onClick={() => navigateToDisplay(service.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ flex: 1, padding: '12px 0', fontSize: '0.85rem' }}
                      >
                        <Tv size={14} /> TV Board
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
