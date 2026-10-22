import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import { soundService } from '../utils/audio.js';
import {
  Tv,
  Maximize2,
  Volume2,
  VolumeX,
  Clock,
  Layers,
  ArrowRight,
  Sparkles,
  Users,
  BrainCircuit,
  ShieldCheck
} from 'lucide-react';

export default function DisplayBoardView() {
  const {
    activeDisplayServiceId,
    setActiveDisplayServiceId,
    currentOrg,
    soundEnabled,
    toggleSound,
    liveEventCounter
  } = useApp();

  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState(activeDisplayServiceId || '');
  const [displayData, setDisplayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastCalledTokenRef = useRef(null);

  // Load available services for dropdown
  useEffect(() => {
    if (!currentOrg?.id) return;
    api.getOrgDetails(currentOrg.id).then(data => {
      const srvs = data.services || [];
      setAvailableServices(srvs);
      if (!selectedServiceId && srvs.length > 0) {
        setSelectedServiceId(srvs[0].id);
      }
    }).catch(err => console.error(err));
  }, [currentOrg?.id]);

  // Load display board data
  useEffect(() => {
    const sId = selectedServiceId || activeDisplayServiceId;
    if (!sId) {
      setLoading(false);
      return;
    }

    let isSubscribed = true;
    api.getDisplayBoard(sId)
      .then(data => {
        if (!isSubscribed) return;
        setDisplayData(data);
        setLoading(false);

        // Check if top called token changed to announce over audio
        const currentTopCalled = data.nowServing?.[0]?.tokenNumber;
        if (currentTopCalled && currentTopCalled !== lastCalledTokenRef.current) {
          lastCalledTokenRef.current = currentTopCalled;
          const counter = data.nowServing[0].counterName;
          soundService.speakAnnouncement(currentTopCalled, counter);
        }
      })
      .catch(err => {
        console.error('Display board load error:', err);
        setLoading(false);
      });

    return () => { isSubscribed = false; };
  }, [selectedServiceId, activeDisplayServiceId, liveEventCounter]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      background: 'linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 45%, #ede9fe 100%)',
      color: '#1e1b4b',
      padding: '24px 28px 60px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Board Top Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e9d5ff',
        boxShadow: 'var(--shadow-sm)',
        padding: '14px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
          }}>
            <Tv size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7c3aed', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Lobby Waiting Area Display
              </span>
              <span className="ai-pill" style={{ padding: '2px 8px', fontSize: '0.65rem' }}>
                <BrainCircuit size={11} /> AI Wait Engine Active
              </span>
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#1e1b4b', margin: 0 }}>
              {displayData?.organizationName || currentOrg?.name} · {displayData?.serviceName || 'Live Queue Board'}
            </h1>
          </div>
        </div>

        {/* Display Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Service Switcher */}
          {availableServices.length > 0 && (
            <select
              value={selectedServiceId}
              onChange={e => {
                setSelectedServiceId(e.target.value);
                setActiveDisplayServiceId(e.target.value);
              }}
              className="select"
              style={{
                width: 'auto',
                minWidth: 190,
                fontSize: '0.85rem',
                background: '#ffffff',
                borderColor: '#d8b4fe'
              }}
            >
              {availableServices.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="btn btn-secondary btn-sm"
            style={{
              borderColor: '#e9d5ff',
              background: soundEnabled ? '#ede9fe' : '#ffffff',
              color: soundEnabled ? '#7c3aed' : '#64748b'
            }}
            title={soundEnabled ? 'Chime and speech announcement active' : 'Audio announcement is muted'}
          >
            {soundEnabled ? <Volume2 size={16} color="#7c3aed" /> : <VolumeX size={16} />}
            <span>{soundEnabled ? 'Audio On' : 'Muted'}</span>
          </button>

          {/* Fullscreen TV Mode */}
          <button
            onClick={toggleFullscreen}
            className="btn btn-outline btn-sm"
            style={{ borderColor: '#d8b4fe', color: '#6d28d9' }}
          >
            <Maximize2 size={15} />
            <span>Fullscreen</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', margin: 'auto', color: '#6b21a8' }}>
          <Sparkles className="animate-spin" size={28} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700 }}>Connecting to Waiting Area Screen...</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 24,
          flex: 1
        }}>
          {/* Left Column: Prominent "NOW CALLING / SERVING" Grid */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 10px #10b981'
                }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  Now Serving / Called
                </h2>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#6b21a8', fontWeight: 600 }}>
                Automatic voice announcement on call
              </span>
            </div>

            {displayData?.nowServing?.length === 0 ? (
              <div style={{
                background: 'rgba(255, 255, 255, 0.7)',
                border: '2px dashed #d8b4fe',
                borderRadius: 'var(--radius-xl)',
                padding: '60px 24px',
                textAlign: 'center',
                color: '#6b21a8'
              }}>
                <Users size={40} style={{ margin: '0 auto 12px', color: '#a855f7' }} />
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#1e1b4b' }}>No tokens currently called</div>
                <div style={{ fontSize: '0.9rem', color: '#6b21a8', marginTop: 4 }}>
                  Waiting for staff officer to call the next visitor
                </div>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 18
              }}>
                {displayData?.nowServing?.map((item, idx) => {
                  const isTop = idx === 0;
                  return (
                    <div
                      key={item.tokenNumber}
                      className="animate-scale"
                      style={{
                        padding: '24px 26px',
                        borderRadius: 'var(--radius-xl)',
                        border: isTop ? '2.5px solid #7c3aed' : '1px solid #e9d5ff',
                        background: isTop
                          ? 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)'
                          : 'rgba(255, 255, 255, 0.85)',
                        boxShadow: isTop ? '0 10px 25px rgba(124, 58, 237, 0.15)' : 'var(--shadow-sm)',
                        position: 'relative'
                      }}
                    >
                      {isTop && (
                        <div style={{
                          position: 'absolute',
                          top: 14,
                          right: 14,
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          fontSize: '0.68rem',
                          fontWeight: 900,
                          padding: '4px 10px',
                          borderRadius: 999,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                        }}>
                          ▶ NOW CALLING
                        </div>
                      )}

                      <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Token Number
                      </div>
                      <div style={{
                        fontSize: 'clamp(2.8rem, 6vw, 3.8rem)',
                        fontWeight: 900,
                        fontFamily: 'var(--font-heading)',
                        color: isTop ? '#5b21b6' : '#1e1b4b',
                        letterSpacing: '0.04em',
                        lineHeight: 1.1,
                        margin: '6px 0 16px'
                      }}>
                        {item.tokenNumber}
                      </div>

                      <div style={{
                        paddingTop: 14,
                        borderTop: '1px solid #ede9fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: '#6b21a8', textTransform: 'uppercase', fontWeight: 800 }}>
                            Counter / Room
                          </div>
                          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e1b4b' }}>
                            {item.counterName}
                          </div>
                        </div>

                        <span style={{
                          padding: '4px 12px',
                          borderRadius: 999,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: item.status === 'IN_SERVICE' ? '#dcfce7' : '#fef3c7',
                          color: item.status === 'IN_SERVICE' ? '#15803d' : '#b45309',
                          border: `1px solid ${item.status === 'IN_SERVICE' ? '#86efac' : '#fde68a'}`,
                        }}>
                          {item.status === 'IN_SERVICE' ? 'In Consultation' : 'Called'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Waiting Queue Ticker */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            border: '1px solid #e9d5ff',
            borderRadius: 'var(--radius-xl)',
            padding: 22,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 14,
              borderBottom: '1px solid #ede9fe'
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 900, color: '#1e1b4b', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                  Up Next in Line
                </h3>
                <div style={{ fontSize: '0.72rem', color: '#6b21a8', marginTop: 2 }}>
                  Priority & Estimated AI Arrival Order
                </div>
              </div>

              <div style={{
                background: '#ede9fe',
                color: '#6d28d9',
                fontWeight: 900,
                fontSize: '0.85rem',
                padding: '4px 12px',
                borderRadius: 999,
                border: '1px solid #d8b4fe'
              }}>
                {displayData?.totalWaiting || 0} Waiting
              </div>
            </div>

            {/* Waiting List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
              {displayData?.upNext?.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: '#6b21a8', fontSize: '0.9rem' }}>
                  Queue is clear. No waiting visitors.
                </div>
              ) : (
                displayData?.upNext?.map((entry) => (
                  <div
                    key={entry.tokenNumber}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e9d5ff',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 4px rgba(124, 58, 237, 0.04)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 26,
                        height: 26,
                        borderRadius: '50%',
                        background: '#ede9fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 900,
                        color: '#6d28d9'
                      }}>
                        {entry.position}
                      </div>
                      <div>
                        <div style={{
                          fontSize: '1.25rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-heading)',
                          color: '#1e1b4b',
                          letterSpacing: '0.03em',
                          lineHeight: 1.1
                        }}>
                          {entry.tokenNumber}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      padding: '3px 10px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 800,
                      background: entry.priorityLevel === 'EMERGENCY' ? '#ffe4e6'
                               : entry.priorityLevel === 'PREMIUM' ? '#ede9fe' : '#f5f3ff',
                      color: entry.priorityLevel === 'EMERGENCY' ? '#e11d48'
                           : entry.priorityLevel === 'PREMIUM' ? '#6d28d9' : '#6b21a8',
                      border: `1px solid ${entry.priorityLevel === 'EMERGENCY' ? '#fecdd3' : '#d8b4fe'}`,
                      letterSpacing: '0.04em',
                    }}>
                      {entry.priorityLevel}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Privacy Guarantee Note */}
            <div style={{
              marginTop: 'auto',
              paddingTop: 16,
              borderTop: '1px solid #ede9fe',
              fontSize: '0.72rem',
              color: '#6b21a8',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}>
              <ShieldCheck size={14} color="#7c3aed" />
              <span>Public Privacy: No customer names or contact info shown on lobby displays.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
