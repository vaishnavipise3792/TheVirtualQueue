import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import { soundService } from '../utils/audio.js';
import confetti from 'canvas-confetti';
import {
  MonitorCheck,
  PhoneCall,
  Play,
  CheckCircle,
  SkipForward,
  UserX,
  RotateCcw,
  Clock,
  AlertTriangle,
  Flame,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Users,
  Settings2,
  RefreshCw
} from 'lucide-react';

export default function StaffConsoleView() {
  const {
    currentOrg,
    currentUser,
    addToast,
    liveEventCounter
  } = useApp();

  const [counters, setCounters] = useState([]);
  const [selectedCounterId, setSelectedCounterId] = useState('');
  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');

  // Queue lists
  const [queues, setQueues] = useState({
    waiting: [],
    called: [],
    inService: [],
    completedToday: [],
    noShowOrSkipped: []
  });
  const [loading, setLoading] = useState(true);

  // Active Ticket serving by this counter
  const [activeTicket, setActiveTicket] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Priority Change Modal State
  const [priorityModalEntry, setPriorityModalEntry] = useState(null);
  const [newPriority, setNewPriority] = useState('EMERGENCY');
  const [priorityReason, setPriorityReason] = useState('');

  // Load counters & services
  useEffect(() => {
    if (!currentOrg?.id) return;
    api.getCounters(currentOrg.id).then(data => {
      const cnts = data.counters || [];
      setCounters(cnts);
      if (cnts.length > 0 && !selectedCounterId) {
        setSelectedCounterId(currentUser.counterId || cnts[0].id);
      }
    }).catch(err => console.error(err));

    api.getOrgDetails(currentOrg.id).then(data => {
      setServices(data.services || []);
    }).catch(err => console.error(err));
  }, [currentOrg?.id]);

  // Load queues for staff console
  const loadQueues = async () => {
    if (!currentOrg?.id) return;
    try {
      const staffHeaders = {
        'x-staff-id': currentUser.id,
        'x-staff-name': currentUser.name,
        'x-staff-role': currentUser.role
      };
      const data = await api.getQueues(currentOrg.id, selectedServiceId || null, staffHeaders);
      setQueues(data);

      const currentActive = [...data.inService, ...data.called].find(
        e => e.assigned_counter_id === selectedCounterId
      );
      setActiveTicket(currentActive || null);
    } catch (err) {
      console.error('Failed to load queues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();
  }, [currentOrg?.id, selectedServiceId, selectedCounterId, liveEventCounter]);

  // Elapsed service timer
  useEffect(() => {
    let interval = null;
    if (activeTicket) {
      const startTime = new Date(activeTicket.service_started_at || activeTicket.called_at || Date.now()).getTime();
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setTimerSeconds(elapsed > 0 ? elapsed : 0);
      }, 1000);
    } else {
      setTimerSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activeTicket]);

  const staffHeaders = {
    'x-staff-id': currentUser.id,
    'x-staff-name': currentUser.name,
    'x-staff-role': currentUser.role
  };

  const handleCallNext = async () => {
    if (!selectedServiceId && services.length > 0) {
      addToast({ type: 'alert', title: 'Select Service', message: 'Please select a specific queue to call next.' });
      return;
    }
    const serviceIdToCall = selectedServiceId || services[0]?.id;
    try {
      const res = await api.callNext(currentOrg.id, serviceIdToCall, selectedCounterId, staffHeaders);
      if (res.entry) {
        addToast({
          type: 'success',
          title: `Called Token ${res.entry.token_number}`,
          message: `Assigned to ${counters.find(c => c.id === selectedCounterId)?.name || 'counter'}.`
        });
        soundService.playChime();
        loadQueues();
      } else {
        addToast({ type: 'info', title: 'Empty Queue', message: 'No waiting tokens for this service.' });
      }
    } catch (err) {
      addToast({ type: 'error', title: 'Call Failed', message: err.message });
    }
  };

  const handleRecall = async (entryId) => {
    try {
      const res = await api.recall(currentOrg.id, entryId, staffHeaders);
      addToast({ type: 'info', title: 'Token Recalled', message: res.message });
      soundService.playChime();
    } catch (err) {
      addToast({ type: 'error', title: 'Recall Failed', message: err.message });
    }
  };

  const handleStartService = async (entryId) => {
    try {
      const res = await api.startService(currentOrg.id, entryId, staffHeaders);
      addToast({ type: 'success', title: 'Service Started', message: `Token ${res.entry.token_number} is now in service.` });
      loadQueues();
    } catch (err) {
      addToast({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleCompleteService = async (entryId) => {
    try {
      const res = await api.complete(currentOrg.id, entryId, staffHeaders);
      addToast({ type: 'success', title: 'Service Completed', message: `Token ${res.entry.token_number} completed.` });
      confetti({ particleCount: 50, spread: 50 });
      loadQueues();
    } catch (err) {
      addToast({ type: 'error', title: 'Completion Failed', message: err.message });
    }
  };

  const handleSkip = async (entryId) => {
    try {
      const res = await api.skip(currentOrg.id, entryId, staffHeaders);
      addToast({ type: 'alert', title: 'Token Skipped', message: `Token ${res.entry.token_number} moved to skipped.` });
      loadQueues();
    } catch (err) {
      addToast({ type: 'error', title: 'Skip Failed', message: err.message });
    }
  };

  const handleNoShow = async (entryId) => {
    try {
      const res = await api.noShow(currentOrg.id, entryId, staffHeaders);
      addToast({ type: 'alert', title: 'Marked No-Show', message: `Token ${res.entry.token_number} marked as no-show.` });
      loadQueues();
    } catch (err) {
      addToast({ type: 'error', title: 'Action Failed', message: err.message });
    }
  };

  const handleRequeue = async (entryId) => {
    try {
      const res = await api.requeue(currentOrg.id, entryId, staffHeaders);
      addToast({
        type: 'success',
        title: 'Re-queued Successfully',
        message: `Token ${res.entry.token_number} placed back in WAITING (requeue count: ${res.entry.requeue_count}/1).`
      });
      loadQueues();
    } catch (err) {
      addToast({
        type: 'error',
        title: `Re-queue Denied (${err.status || 409})`,
        message: err.message
      });
    }
  };

  const handlePrioritySubmit = async (e) => {
    e.preventDefault();
    if (!priorityModalEntry) return;

    try {
      const res = await api.changePriority(
        currentOrg.id,
        priorityModalEntry.id,
        newPriority,
        priorityReason || 'Staff triage override',
        staffHeaders
      );

      addToast({
        type: 'success',
        title: 'Priority Updated',
        message: `Token ${res.entry.token_number} changed to ${res.entry.priority_level}. Written to Audit Log.`
      });

      setPriorityModalEntry(null);
      setPriorityReason('');
      loadQueues();
    } catch (err) {
      addToast({ type: 'error', title: 'Priority Change Failed', message: err.message });
    }
  };

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const selectedCounter = counters.find(c => c.id === selectedCounterId);

  return (
    <div style={{ maxWidth: 1380, margin: '0 auto', padding: '28px 20px 80px' }}>
      {/* Console Top Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e9d5ff',
        boxShadow: 'var(--shadow-sm)',
        padding: '18px 26px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)'
          }}>
            <MonitorCheck size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Counter Operator Console · RF Wait Prediction Active
            </div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: '#1e1b4b', margin: 0 }}>
              {currentOrg?.name}
            </h1>
          </div>
        </div>

        {/* Counter & Queue Filtering Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6b21a8', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              My Active Counter:
            </label>
            <select
              value={selectedCounterId}
              onChange={e => setSelectedCounterId(e.target.value)}
              className="select"
              style={{ minWidth: 190, padding: '8px 12px', fontSize: '0.85rem', background: '#ffffff', color: '#1e1b4b', borderColor: '#d8b4fe' }}
            >
              {counters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.7rem', fontWeight: 800, color: '#6b21a8', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Service Queue:
            </label>
            <select
              value={selectedServiceId}
              onChange={e => setSelectedServiceId(e.target.value)}
              className="select"
              style={{ minWidth: 200, padding: '8px 12px', fontSize: '0.85rem', background: '#ffffff', color: '#1e1b4b', borderColor: '#d8b4fe' }}
            >
              <option value="">All Services ({queues.totalWaiting} waiting)</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>
                  [{s.code}] {s.name} ({s.waiting_count || 0})
                </option>
              ))}
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end' }}>
            <button
              onClick={loadQueues}
              className="btn btn-outline"
              title="Refresh Queues"
              style={{ padding: '8px 12px', borderColor: '#d8b4fe', color: '#7c3aed', background: '#ffffff' }}
            >
              <RefreshCw size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Hero Active Serving Station Card (PRD FR-15) */}
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #e9d5ff',
        borderRadius: 'var(--radius-xl)',
        padding: '26px 30px',
        marginBottom: 28,
        boxShadow: 'var(--shadow-md)',
        position: 'relative'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20
        }}>
          {/* Counter info & timer */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                {selectedCounter?.name || 'Counter Assigned'}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Staff Officer: <strong style={{ color: '#0f172a' }}>{currentUser.name}</strong>
              </span>
            </div>

            {activeTicket ? (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
                  Currently Attending
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '2.8rem',
                    fontWeight: 800,
                    fontFamily: 'var(--font-heading)',
                    color: activeTicket.status === 'IN_SERVICE' ? '#059669' : '#d97706',
                    letterSpacing: '0.03em',
                    lineHeight: 1.1
                  }}>
                    {activeTicket.token_number}
                  </span>
                  <span className={`badge ${activeTicket.status === 'IN_SERVICE' ? 'badge-in_service' : 'badge-called'}`}>
                    {activeTicket.status}
                  </span>
                  <span style={{ fontSize: '0.95rem', color: '#334155', fontWeight: 600 }}>
                    {activeTicket.customer_name} ({activeTicket.customer_phone})
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>
                  Ready to Call Next Customer
                </div>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 2 }}>
                  Click "Call Next Token" to summon the highest-priority customer waiting in line.
                </div>
              </div>
            )}
          </div>

          {/* Timer & Main Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {activeTicket && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: 'var(--radius-md)',
                padding: '10px 18px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>
                  Elapsed Time
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: '#0f172a'
                }}>
                  {formatTimer(timerSeconds)}
                </div>
              </div>
            )}

            {!activeTicket ? (
              <button
                onClick={handleCallNext}
                className="btn btn-primary btn-lg"
                style={{ padding: '16px 32px', fontSize: '1.1rem' }}
              >
                <PhoneCall size={20} />
                <span>Call Next Token</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleRecall(activeTicket.id)}
                  className="btn btn-secondary"
                  title="Flash chime and announce on display"
                >
                  <PhoneCall size={16} color="#7c3aed" />
                  <span>Recall</span>
                </button>

                {activeTicket.status === 'CALLED' && (
                  <button
                    onClick={() => handleStartService(activeTicket.id)}
                    className="btn btn-primary"
                  >
                    <Play size={16} />
                    <span>Start Service</span>
                  </button>
                )}

                <button
                  onClick={() => handleCompleteService(activeTicket.id)}
                  className="btn btn-success"
                >
                  <CheckCircle size={16} />
                  <span>Complete</span>
                </button>

                <button
                  onClick={() => handleSkip(activeTicket.id)}
                  className="btn btn-secondary"
                >
                  <SkipForward size={16} />
                  <span>Skip</span>
                </button>

                <button
                  onClick={() => handleNoShow(activeTicket.id)}
                  className="btn btn-danger"
                >
                  <UserX size={16} />
                  <span>No-Show</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Queue Lists Split Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: 24
      }}>
        {/* Waiting Queue List (Priority ordered PRD FR-9) */}
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
                Waiting in Queue ({queues.waiting.length})
              </h2>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Sorted by priority level first, then join timestamp (FR-9)
              </div>
            </div>

            <button
              onClick={handleCallNext}
              disabled={queues.waiting.length === 0}
              className="btn btn-primary btn-sm"
            >
              <PhoneCall size={14} /> Call Next
            </button>
          </div>

          {queues.waiting.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
              No customers waiting in this queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {queues.waiting.map((item, idx) => (
                <div
                  key={item.id}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      color: '#475569'
                    }}>
                      #{idx + 1}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: '1.25rem',
                          fontWeight: 800,
                          fontFamily: 'var(--font-heading)',
                          color: '#0f172a'
                        }}>
                          {item.token_number}
                        </span>

                        <span className={`badge ${
                          item.priority_level === 'EMERGENCY' ? 'badge-priority-emergency' :
                          (item.priority_level === 'PREMIUM' ? 'badge-priority-premium' :
                          (item.priority_level === 'SENIOR' ? 'badge-priority-senior' : 'badge-priority-normal'))
                        }`}>
                          {item.priority_level} (wt {item.priority_weight})
                        </span>
                      </div>

                      <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: 2 }}>
                        <strong>{item.customer_name}</strong> · {item.customer_phone} · {item.service_name}
                      </div>

                      {item.customFields && Object.keys(item.customFields).length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#7c3aed', marginTop: 2, fontWeight: 600 }}>
                          {Object.entries(item.customFields).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions for waiting entry */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: '0.75rem', color: '#6b21a8', textAlign: 'right', marginRight: 6 }}>
                      <div>Joined: {new Date(item.joined_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      <div className="ai-pill" style={{ padding: '2px 8px', fontSize: '0.68rem', marginTop: 3 }}>
                        <Sparkles size={10} /> RF Est: ~{item.estimatedWaitMins}m
                      </div>
                    </div>

                    <button
                      onClick={() => setPriorityModalEntry(item)}
                      className="btn btn-outline btn-sm"
                      title="Override Priority (Audit Logged)"
                    >
                      <Flame size={14} color="#d97706" />
                      <span>Priority</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: No-Show & Skipped (Re-queue station) & Completed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Missed / No-Show Station with 1-Time Re-queue (PRD FR-12, AC-6) */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={16} />
                <span>No-Show / Skipped ({queues.noShowOrSkipped.length})</span>
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Can be re-queued back to line exactly ONCE (PRD FR-12)
              </div>
            </div>

            {queues.noShowOrSkipped.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                No missed or skipped tokens
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {queues.noShowOrSkipped.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#0f172a' }}>{entry.token_number}</span>
                        <span className={`badge ${entry.status === 'NO_SHOW' ? 'badge-no_show' : 'badge-skipped'}`}>
                          {entry.status}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {entry.customer_name} · Requeues: {entry.requeue_count}/1
                      </div>
                    </div>

                    <button
                      onClick={() => handleRequeue(entry.id)}
                      disabled={entry.requeue_count >= 1}
                      className="btn btn-secondary btn-sm"
                      title={entry.requeue_count >= 1 ? 'Already re-queued once (Maximum limit reached)' : 'Re-queue back to waiting line'}
                    >
                      <RotateCcw size={13} />
                      <span>{entry.requeue_count >= 1 ? 'Limit Reached' : 'Re-queue'}</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's Completed Tokens */}
          <div className="glass-card" style={{ padding: 22, flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#059669' }}>
              <CheckCircle size={16} color="#059669" />
              <span>Served Today ({queues.completedToday.length})</span>
            </h3>

            {queues.completedToday.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>
                No completed entries yet today
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 250, overflowY: 'auto' }}>
                {queues.completedToday.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.825rem'
                    }}
                  >
                    <div>
                      <strong style={{ fontFamily: 'var(--font-heading)', color: '#0f172a' }}>{entry.token_number}</strong>
                      <span style={{ color: '#64748b', marginLeft: 8 }}>{entry.service_name}</span>
                    </div>
                    <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                      {entry.completed_at ? new Date(entry.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Done'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Priority Change Modal (PRD FR-10, AC-4) */}
      {priorityModalEntry && (
        <div className="modal-overlay" onClick={() => setPriorityModalEntry(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>
                  Override Token Priority
                </h3>
                <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
                  Token {priorityModalEntry.token_number} ({priorityModalEntry.customer_name})
                </div>
              </div>
            </div>

            <form onSubmit={handlePrioritySubmit} style={{ padding: '24px' }}>
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.8rem',
                color: '#92400e',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                <span>
                  <strong>Audit Log Mandate (PRD FR-10):</strong> Every priority change is permanently recorded with actor name, role, timestamp, and reason.
                </span>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">Current Priority Level</label>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  {priorityModalEntry.priority_level} (Weight: {priorityModalEntry.priority_weight})
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label className="label">New Priority Level</label>
                <select
                  className="select"
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                >
                  <option value="EMERGENCY">EMERGENCY (Highest Priority - Weight 100)</option>
                  <option value="PREMIUM">PREMIUM (Priority Banking - Weight 100)</option>
                  <option value="SENIOR">SENIOR (Senior Citizen - Weight 50)</option>
                  <option value="NORMAL">NORMAL (Standard Queue - Weight 10)</option>
                </select>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="label">
                  Reason for Override <span style={{ color: '#e11d48' }}>*</span>
                </label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="e.g. Patient developed sudden acute chest tightness in waiting area..."
                  value={priorityReason}
                  onChange={e => setPriorityReason(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setPriorityModalEntry(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save & Log to Audit Trail
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
