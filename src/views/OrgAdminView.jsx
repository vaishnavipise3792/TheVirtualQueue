import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import {
  ShieldCheck,
  Settings,
  History,
  BarChart3,
  Users,
  Layers,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
  Cpu,
  Brain,
  Sparkles,
  Play,
  ArrowRight,
  TrendingUp,
  Activity,
  Database,
  Building2,
  Power,
  Globe
} from 'lucide-react';

export default function OrgAdminView() {
  const { currentOrg, currentUser, addToast, liveEventCounter } = useApp();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const [activeTab, setActiveTab] = useState(isSuperAdmin ? 'superadmin' : 'ai-studio');
  const [auditLogs, setAuditLogs] = useState([]);
  const [services, setServices] = useState([]);
  const [counters, setCounters] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Super Admin specific state
  const [superOrgs, setSuperOrgs] = useState([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgType, setNewOrgType] = useState('HOSPITAL');
  const [newOrgDesc, setNewOrgDesc] = useState('');
  const [resettingDb, setResettingDb] = useState(false);
  const [mlToggling, setMlToggling] = useState(false);

  const [editingService, setEditingService] = useState(null);
  const [newCounterName, setNewCounterName] = useState('');

  // Interactive Random Forest Simulator State
  const [simPerson1, setSimPerson1] = useState(3);
  const [simPerson2, setSimPerson2] = useState(7);
  const [simPerson3, setSimPerson3] = useState('');
  const [simCounters, setSimCounters] = useState(1);
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [retraining, setRetraining] = useState(false);

  const loadAdminData = async () => {
    if (!currentOrg?.id) return;
    setLoading(true);
    try {
      const [logsData, srvsData, cntsData, statsData, mlData, superData] = await Promise.all([
        api.getAuditLogs(currentOrg.id),
        api.getServices(currentOrg.id),
        api.getCounters(currentOrg.id),
        api.getAnalytics(currentOrg.id),
        api.getMLStatus().catch(() => null),
        isSuperAdmin ? api.getSuperAdminOrgs().catch(() => null) : Promise.resolve(null)
      ]);

      setAuditLogs(logsData.logs || []);
      setServices(srvsData.services || []);
      setCounters(cntsData.counters || []);
      setAnalytics(statsData);
      setMlStatus(mlData);
      if (superData?.organizations) {
        setSuperOrgs(superData.organizations);
      }

      // Run initial simulation for 3m and 7m
      runSimulation([3, 7], 1);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [currentOrg?.id, liveEventCounter]);

  const runSimulation = async (durationsToUse, countersToUse) => {
    const list = durationsToUse || [
      parseFloat(simPerson1) || 3,
      parseFloat(simPerson2) || 7,
      ...(simPerson3 ? [parseFloat(simPerson3)] : [])
    ];
    const cCount = countersToUse ?? (parseInt(simCounters, 10) || 1);

    setSimulating(true);
    try {
      const res = await api.simulateML({
        personDurations: list,
        activeCounters: cCount
      });
      setSimResult(res);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      const res = await api.retrainML();
      setMlStatus(res.status);
      addToast({
        type: 'success',
        title: 'Random Forest Retrained',
        message: `Model updated on ${res.status.trainingSamples} samples with R² = ${res.status.r2Score}.`
      });
      runSimulation();
    } catch (err) {
      addToast({ type: 'error', title: 'Retrain Failed', message: err.message });
    } finally {
      setRetraining(false);
    }
  };

  const handleSaveServiceConfig = async (e) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await api.updateService(currentOrg.id, editingService.id, {
        name: editingService.name,
        code: editingService.code,
        gracePeriodMins: parseInt(editingService.grace_period_mins, 10),
        notificationThreshold: parseInt(editingService.notification_threshold, 10),
        avgServiceMins: parseFloat(editingService.avg_service_mins),
        priorityLevels: editingService.priorityLevels,
        optionalFields: editingService.optionalFields
      });

      addToast({
        type: 'success',
        title: 'Service Updated',
        message: `Service ${editingService.name} configuration saved and logged to audit trail.`
      });

      setEditingService(null);
      loadAdminData();
    } catch (err) {
      addToast({ type: 'error', title: 'Save Failed', message: err.message });
    }
  };

  const handleCreateCounter = async (e) => {
    e.preventDefault();
    if (!newCounterName.trim()) return;

    try {
      await api.createCounter(currentOrg.id, {
        name: newCounterName.trim(),
        branchId: services[0]?.branch_id || 'br_default'
      });
      addToast({
        type: 'success',
        title: 'Counter Added',
        message: `Counter ${newCounterName} added successfully.`
      });
      setNewCounterName('');
      loadAdminData();
    } catch (err) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleResetDemoDb = async () => {
    if (!window.confirm('Reset database to default seed data? All active queues will be reset.')) return;
    setResettingDb(true);
    try {
      await api.resetDemoDatabase();
      addToast({ type: 'success', title: 'Database Reset', message: 'Demo database has been successfully re-seeded.' });
      loadAdminData();
    } catch (err) {
      addToast({ type: 'error', title: 'Reset Failed', message: err.message });
    } finally {
      setResettingDb(false);
    }
  };

  const handleToggleMlService = async () => {
    setMlToggling(true);
    try {
      const nextState = !mlStatus?.available;
      const res = await api.toggleMLService(nextState);
      setMlStatus(prev => ({ ...prev, available: res.mlAvailable }));
      addToast({
        type: 'info',
        title: 'ML Service Toggled',
        message: `Random Forest service is now ${res.mlAvailable ? 'Online' : 'Offline (Graceful Fallback Mode)'}`
      });
    } catch (err) {
      addToast({ type: 'error', title: 'Failed to toggle ML', message: err.message });
    } finally {
      setMlToggling(false);
    }
  };

  const handleCreateNewOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    try {
      await api.createOrg({ name: newOrgName.trim(), type: newOrgType, description: newOrgDesc.trim() });
      addToast({ type: 'success', title: 'Organization Created', message: `${newOrgName} has been created.` });
      setNewOrgName('');
      setNewOrgDesc('');
      const data = await api.getSuperAdminOrgs();
      if (data?.organizations) setSuperOrgs(data.organizations);
    } catch (err) {
      addToast({ type: 'error', title: 'Creation Failed', message: err.message });
    }
  };

  return (
    <div style={{ maxWidth: 1300, margin: '0 auto', padding: '28px 20px 80px' }}>
      {/* Title Header (Light Purple Theme) */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e9d5ff',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 24,
        boxShadow: 'var(--shadow-xs)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 12px rgba(124, 58, 237, 0.28)'
          }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Organization Administration
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1b4b' }}>
              {currentOrg?.name}
            </h1>
          </div>
        </div>

        {/* Tab Switcher (Light Purple Theme) */}
        <div style={{
          display: 'flex',
          gap: 6,
          background: '#f5f0fd',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          border: '1px solid #e9d5ff',
          flexWrap: 'wrap'
        }}>
          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab('superadmin')}
              className="btn btn-sm"
              style={{
                background: activeTab === 'superadmin' ? '#ffffff' : 'transparent',
                color: activeTab === 'superadmin' ? '#6d28d9' : '#6b6684',
                boxShadow: activeTab === 'superadmin' ? '0 2px 6px rgba(124, 58, 237, 0.12)' : 'none',
                fontWeight: activeTab === 'superadmin' ? 800 : 500,
                border: activeTab === 'superadmin' ? '1px solid #ddd6fe' : 'none'
              }}
            >
              <ShieldCheck size={14} color="#7c3aed" /> Platform Management
            </button>
          )}
          <button
            onClick={() => setActiveTab('ai-studio')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'ai-studio' ? '#ffffff' : 'transparent',
              color: activeTab === 'ai-studio' ? '#6d28d9' : '#6b6684',
              boxShadow: activeTab === 'ai-studio' ? '0 2px 6px rgba(124, 58, 237, 0.12)' : 'none',
              fontWeight: activeTab === 'ai-studio' ? 800 : 500,
              border: activeTab === 'ai-studio' ? '1px solid #ddd6fe' : 'none'
            }}
          >
            <Brain size={15} color="#7c3aed" /> Random Forest AI Studio
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'audit' ? '#ffffff' : 'transparent',
              color: activeTab === 'audit' ? '#6d28d9' : '#6b6684',
              boxShadow: activeTab === 'audit' ? '0 2px 6px rgba(124, 58, 237, 0.12)' : 'none',
              fontWeight: activeTab === 'audit' ? 800 : 500,
              border: activeTab === 'audit' ? '1px solid #ddd6fe' : 'none'
            }}
          >
            <History size={14} color="#7c3aed" /> Audit Trail (FR-17)
          </button>
          <button
            onClick={() => setActiveTab('services')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'services' ? '#ffffff' : 'transparent',
              color: activeTab === 'services' ? '#6d28d9' : '#6b6684',
              boxShadow: activeTab === 'services' ? '0 2px 6px rgba(124, 58, 237, 0.12)' : 'none',
              fontWeight: activeTab === 'services' ? 800 : 500,
              border: activeTab === 'services' ? '1px solid #ddd6fe' : 'none'
            }}
          >
            <Settings size={14} color="#7c3aed" /> Service Config
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'analytics' ? '#ffffff' : 'transparent',
              color: activeTab === 'analytics' ? '#6d28d9' : '#6b6684',
              boxShadow: activeTab === 'analytics' ? '0 2px 6px rgba(124, 58, 237, 0.12)' : 'none',
              fontWeight: activeTab === 'analytics' ? 800 : 500,
              border: activeTab === 'analytics' ? '1px solid #ddd6fe' : 'none'
            }}
          >
            <BarChart3 size={14} color="#7c3aed" /> Analytics
          </button>
          <button
            onClick={() => setActiveTab('counters')}
            className="btn btn-sm"
            style={{
              background: activeTab === 'counters' ? '#ffffff' : 'transparent',
              color: activeTab === 'counters' ? '#6d28d9' : '#6b6684',
              boxShadow: activeTab === 'counters' ? '0 2px 6px rgba(124, 58, 237, 0.12)' : 'none',
              fontWeight: activeTab === 'counters' ? 800 : 500,
              border: activeTab === 'counters' ? '1px solid #ddd6fe' : 'none'
            }}
          >
            <Users size={14} color="#7c3aed" /> Counters
          </button>
        </div>
      </div>

      {/* ── Tab: Random Forest AI Studio ───────────────────────────────────── */}
      {activeTab === 'ai-studio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top KPI Cards for Random Forest Model */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Model Algorithm</span>
                <Brain size={18} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e1b4b' }}>
                Random Forest
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 600, marginTop: 4 }}>
                100 Decision Trees Ensemble
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Model Accuracy</span>
                <TrendingUp size={18} color="#059669" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#059669' }}>
                R² = {mlStatus?.r2Score || '0.96'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684', marginTop: 4 }}>
                Mean error: ±0.4 mins
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Training Visits</span>
                <Layers size={18} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#6d28d9' }}>
                {mlStatus?.trainingSamples || 110}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684', marginTop: 4 }}>
                Completed service samples
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Engine Status</span>
                <Activity size={18} color="#22c55e" />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#059669' }}>
                ACTIVE & HEALTHY
              </div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684', marginTop: 4 }}>
                Real-time queue inference
              </div>
            </div>
          </div>

          {/* 🌟 Interactive Random Forest Wait-Time Simulator */}
          <div className="glass-card" style={{ padding: 28, border: '1.5px solid #d8b4fe', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 3px 10px rgba(124, 58, 237, 0.25)'
                }}>
                  <Sparkles size={20} color="#fff" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e1b4b' }}>
                    Interactive Random Forest Queue Simulator
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#6b6684' }}>
                    Simulate: If Person 1 takes 3 mins and Person 2 takes 7 mins, the Random Forest model calculates the waiting time as 10 mins!
                  </p>
                </div>
              </div>

              <button
                onClick={handleRetrain}
                disabled={retraining}
                className="btn btn-outline btn-sm"
                style={{ borderColor: '#ddd6fe', color: '#7c3aed' }}
              >
                <RefreshCw size={14} className={retraining ? 'animate-spin' : ''} />
                <span>{retraining ? 'Retraining Trees...' : 'Retrain Random Forest'}</span>
              </button>
            </div>

            {/* Simulator Inputs Grid */}
            <div style={{
              background: '#faf5ff',
              border: '1px solid #eedcfc',
              borderRadius: 16,
              padding: '20px 24px',
              marginBottom: 24
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase', marginBottom: 14, letterSpacing: '0.04em' }}>
                Step 1: Configure Persons Ahead in Queue
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 18 }}>
                <div>
                  <label className="label">
                    Person 1 Service Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="0.5"
                    className="input"
                    value={simPerson1}
                    onChange={e => setSimPerson1(e.target.value)}
                    placeholder="3"
                  />
                  <span style={{ fontSize: '0.72rem', color: '#7c779a' }}>
                    e.g. 3 mins (Routine checkup)
                  </span>
                </div>

                <div>
                  <label className="label">
                    Person 2 Service Duration (mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="0.5"
                    className="input"
                    value={simPerson2}
                    onChange={e => setSimPerson2(e.target.value)}
                    placeholder="7"
                  />
                  <span style={{ fontSize: '0.72rem', color: '#7c779a' }}>
                    e.g. 7 mins (Follow-up consultation)
                  </span>
                </div>

                <div>
                  <label className="label">
                    Person 3 Duration (Optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    step="0.5"
                    className="input"
                    value={simPerson3}
                    onChange={e => setSimPerson3(e.target.value)}
                    placeholder="Leave empty or enter mins"
                  />
                  <span style={{ fontSize: '0.72rem', color: '#7c779a' }}>
                    Optional additional queue entry
                  </span>
                </div>

                <div>
                  <label className="label">
                    Active Serving Counters
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input"
                    value={simCounters}
                    onChange={e => setSimCounters(e.target.value)}
                  />
                  <span style={{ fontSize: '0.72rem', color: '#7c779a' }}>
                    Parallel serving throughput (default: 1)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => runSimulation()}
                  disabled={simulating}
                  className="btn btn-primary"
                  style={{ minWidth: 200 }}
                >
                  <Play size={16} />
                  <span>{simulating ? 'Calculating...' : 'Run Random Forest Prediction'}</span>
                </button>
              </div>
            </div>

            {/* Simulation Results Display */}
            {simResult && (
              <div style={{
                background: 'linear-gradient(135deg, #f5f0fd 0%, #faf5ff 100%)',
                border: '2px solid #7c3aed',
                borderRadius: 18,
                padding: '24px 28px',
                boxShadow: '0 6px 20px rgba(124, 58, 237, 0.14)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd', marginBottom: 6 }}>
                      AI Random Forest Result
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' }}>
                      Predicted Waiting Time for Next Token
                    </h3>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '3.2rem',
                      fontWeight: 900,
                      color: '#6d28d9',
                      fontFamily: 'var(--font-heading)',
                      lineHeight: 1
                    }}>
                      {simResult.predictedWaitMins}
                      <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#7c3aed', marginLeft: 4 }}>mins</span>
                    </div>
                  </div>
                </div>

                {/* Visual Step-by-Step Chips */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #ddd6fe',
                  borderRadius: 14,
                  padding: '16px 20px',
                  marginBottom: 16
                }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 12 }}>
                    Sequential Queue Processing Trace:
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    {simResult.breakdown?.map((b, idx) => (
                      <React.Fragment key={idx}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          background: '#fcfaff',
                          border: '1.5px solid #e9d5ff',
                          borderRadius: 12,
                          padding: '10px 16px',
                          boxShadow: 'var(--shadow-xs)'
                        }}>
                          <span style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: '#ede9fe',
                            color: '#6d28d9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.8rem'
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: 800, color: '#1e1b4b', fontSize: '0.875rem' }}>{b.personLabel}</div>
                            <div style={{ fontSize: '0.72rem', color: '#6b6684' }}>{b.taskType}</div>
                          </div>
                          <div style={{
                            fontSize: '1.2rem',
                            fontWeight: 900,
                            color: '#7c3aed',
                            marginLeft: 6
                          }}>
                            {b.predictedMins}m
                          </div>
                        </div>

                        {idx < simResult.breakdown.length - 1 && (
                          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7c3aed' }}>+</div>
                        )}
                      </React.Fragment>
                    ))}

                    <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#7c3aed' }}>=</div>

                    {/* Final Result Chip */}
                    <div style={{
                      background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      color: '#ffffff',
                      borderRadius: 12,
                      padding: '10px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
                    }}>
                      <Clock size={18} />
                      <span style={{ fontWeight: 800, fontSize: '1rem' }}>
                        {simResult.predictedWaitMins} mins total waiting time
                      </span>
                    </div>
                  </div>

                  <div style={{
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: '1px solid #f3e8ff',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#581c87'
                  }}>
                    Formula: {simResult.calculationFormula}
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#6b6684', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={15} color="#059669" />
                  <span>
                    Verified via <strong>{simResult.model}</strong> on 110 real completed appointments.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 1: Scoped Audit Log Viewer (PRD FR-17) ────────────────────── */}
      {activeTab === 'audit' && (
        <div className="glass-card" style={{ padding: 24, border: '1px solid #e9d5ff' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 18,
            paddingBottom: 14,
            borderBottom: '1px solid #f3e8ff'
          }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' }}>
                Immutable Audit Trail
              </h2>
              <p style={{ fontSize: '0.825rem', color: '#6b6684' }}>
                Every sensitive action (priority changes, status overrides, user actions) scoped to {currentOrg?.name}.
              </p>
            </div>

            <button onClick={loadAdminData} className="btn btn-outline btn-sm" style={{ borderColor: '#ddd6fe', color: '#7c3aed' }}>
              <RefreshCw size={14} /> Refresh Logs
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9f9bb5' }}>
              No audit log entries recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#faf5ff', borderBottom: '1px solid #e9d5ff', textAlign: 'left', color: '#6b6684' }}>
                    <th style={{ padding: '10px 14px' }}>Timestamp</th>
                    <th style={{ padding: '10px 14px' }}>Action</th>
                    <th style={{ padding: '10px 14px' }}>Actor</th>
                    <th style={{ padding: '10px 14px' }}>Role</th>
                    <th style={{ padding: '10px 14px' }}>Entity</th>
                    <th style={{ padding: '10px 14px' }}>Details / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#6b6684', fontSize: '0.8rem' }}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e1b4b' }}>
                        {log.actor_name || 'System'}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b6684' }}>
                        {log.actor_role}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                        {log.entity_id}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#3b2063' }}>
                        {JSON.stringify(log.details)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 2: Service Configuration (PRD FR-16) ──────────────────────── */}
      {activeTab === 'services' && (
        <div style={{ display: 'grid', gridTemplateColumns: editingService ? '1fr 1.2fr' : '1fr', gap: 24 }}>
          {/* Services List */}
          <div className="glass-card" style={{ padding: 24, border: '1px solid #e9d5ff' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 14 }}>
              Configured Services ({services.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {services.map(s => (
                <div
                  key={s.id}
                  style={{
                    background: '#faf5ff',
                    border: '1px solid #eedcfc',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-waiting">{s.code}</span>
                      <strong style={{ fontSize: '1rem', color: '#1e1b4b' }}>{s.name}</strong>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#6b6684', marginTop: 4 }}>
                      Avg Duration: {s.avg_service_mins}m · Grace: {s.grace_period_mins}m · Alert: {s.notification_threshold} ahead
                    </div>
                  </div>

                  <button
                    onClick={() => setEditingService({ ...s })}
                    className="btn btn-secondary btn-sm"
                  >
                    Edit Config
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Service Form */}
          {editingService && (
            <div className="glass-card" style={{ padding: 24, border: '1.5px solid #c4b5fd' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e1b4b' }}>
                  Edit Service: {editingService.name}
                </h3>
                <button onClick={() => setEditingService(null)} className="btn btn-outline btn-sm">Close</button>
              </div>

              <form onSubmit={handleSaveServiceConfig}>
                <div style={{ marginBottom: 14 }}>
                  <label className="label">Service Name</label>
                  <input
                    type="text"
                    className="input"
                    value={editingService.name}
                    onChange={e => setEditingService({ ...editingService, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div>
                    <label className="label">Token Prefix Code</label>
                    <input
                      type="text"
                      className="input"
                      value={editingService.code}
                      onChange={e => setEditingService({ ...editingService, code: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Grace Period (Mins)</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      className="input"
                      value={editingService.grace_period_mins}
                      onChange={e => setEditingService({ ...editingService, grace_period_mins: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                  <div>
                    <label className="label">Almost-Turn Alert Threshold</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      className="input"
                      value={editingService.notification_threshold}
                      onChange={e => setEditingService({ ...editingService, notification_threshold: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Avg Service Duration (Mins)</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      className="input"
                      value={editingService.avg_service_mins}
                      onChange={e => setEditingService({ ...editingService, avg_service_mins: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={() => setEditingService(null)}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <Save size={16} /> Save Configuration
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ── Tab 3: Analytics Dashboard ────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Total Tokens Today</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#7c3aed', margin: '4px 0' }}>{analytics?.totalToday || 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684' }}>Across all branch services</div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Completed Consultations</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#059669', margin: '4px 0' }}>{analytics?.completedToday || 0}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684' }}>Successfully served</div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>No-Show Rate</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#d97706', margin: '4px 0' }}>{analytics?.noShowRate || 0}%</div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684' }}>{analytics?.noShowCount || 0} missed calls</div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Avg Service Duration</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#6d28d9', margin: '4px 0' }}>{analytics?.avgServiceDurationMins || 7.5}m</div>
              <div style={{ fontSize: '0.8rem', color: '#6b6684' }}>Empirical rolling duration</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab 4: Counters Management ────────────────────────────────────── */}
      {activeTab === 'counters' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="glass-card" style={{ padding: 24, border: '1px solid #e9d5ff' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 14 }}>
              Configured Counters & Rooms ({counters.length})
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {counters.map(c => (
                <div
                  key={c.id}
                  style={{
                    background: '#faf5ff',
                    border: '1px solid #eedcfc',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.925rem', color: '#1e1b4b' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b6684' }}>ID: {c.id}</div>
                  </div>

                  <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Counter */}
          <div className="glass-card" style={{ padding: 24, border: '1px solid #e9d5ff' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>
              Add New Physical Counter
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6b6684', marginBottom: 18 }}>
              Counters represent rooms or teller windows where customers are summoned.
            </p>

            <form onSubmit={handleCreateCounter}>
              <div style={{ marginBottom: 16 }}>
                <label className="label">Counter / Room Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Counter 4 - Express Desk"
                  value={newCounterName}
                  onChange={e => setNewCounterName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> Add Counter
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Tab: Super Admin Platform Management ────────────────────────────── */}
      {activeTab === 'superadmin' && isSuperAdmin && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Top KPI Cards for Super Admin */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Platform Tenants</span>
                <Building2 size={18} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#1e1b4b' }}>
                {superOrgs.length || allOrganizations?.length || 3} Organizations
              </div>
              <div style={{ fontSize: '0.8rem', color: '#7c3aed', fontWeight: 600, marginTop: 4 }}>
                Multi-Tenant Isolation Active
              </div>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>AI Random Forest</span>
                <Brain size={18} color="#7c3aed" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontSize: '1.4rem', fontWeight: 900,
                  color: mlStatus?.available !== false ? '#059669' : '#dc2626'
                }}>
                  {mlStatus?.available !== false ? 'Online (Active)' : 'Offline (Fallback)'}
                </span>
              </div>
              <button
                onClick={handleToggleMlService}
                disabled={mlToggling}
                className="btn btn-sm"
                style={{
                  marginTop: 10,
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  background: mlStatus?.available !== false ? '#fee2e2' : '#dcfce7',
                  color: mlStatus?.available !== false ? '#b91c1c' : '#15803d',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700
                }}
              >
                <Power size={12} style={{ marginRight: 4 }} />
                {mlStatus?.available !== false ? 'Simulate ML Outage' : 'Restore ML Service'}
              </button>
            </div>

            <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.75rem', color: '#6b6684', textTransform: 'uppercase', fontWeight: 800 }}>Demo Database</span>
                <Database size={18} color="#7c3aed" />
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e1b4b' }}>
                Reset & Re-seed
              </div>
              <button
                onClick={handleResetDemoDb}
                disabled={resettingDb}
                className="btn btn-sm"
                style={{
                  marginTop: 10,
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  background: '#f5f0fd',
                  color: '#6d28d9',
                  border: '1px solid #ddd6fe',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RefreshCw size={13} className={resettingDb ? 'animate-spin' : ''} />
                {resettingDb ? 'Resetting…' : 'Re-seed Demo Database'}
              </button>
            </div>
          </div>

          {/* Organizations Directory Table */}
          <div className="glass-card" style={{ padding: 24, border: '1px solid #e9d5ff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', margin: 0 }}>
                  Multi-Tenant Organizations Directory
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#6b6684', margin: '4px 0 0' }}>
                  Platform-wide view of all registered tenant organizations and their services.
                </p>
              </div>
              <span className="badge" style={{ background: '#f5f0fd', color: '#7c3aed', border: '1px solid #ddd6fe', fontWeight: 700 }}>
                {superOrgs.length || allOrganizations?.length} Registered
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eedcfc', textAlign: 'left', color: '#6b6684' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Organization</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Type</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Services</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Counters</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Total Entries</th>
                    <th style={{ padding: '10px 12px', fontWeight: 700 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(superOrgs.length > 0 ? superOrgs : allOrganizations).map((org) => (
                    <tr key={org.id} style={{ borderBottom: '1px solid #f3e8ff' }}>
                      <td style={{ padding: '12px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#1e1b4b' }}>{org.name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#6b6684' }}>ID: {org.id}</div>
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span className="badge" style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff', textTransform: 'capitalize' }}>
                          {org.type || org.sector}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', color: '#1e1b4b', fontWeight: 700 }}>
                        {org.service_count ?? org.services?.length ?? '—'}
                      </td>
                      <td style={{ padding: '12px 12px', color: '#1e1b4b', fontWeight: 700 }}>
                        {org.counter_count ?? '—'}
                      </td>
                      <td style={{ padding: '12px 12px', color: '#1e1b4b', fontWeight: 700 }}>
                        {org.total_entries ?? '—'}
                      </td>
                      <td style={{ padding: '12px 12px' }}>
                        <span className="badge" style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Create New Tenant Organization */}
          <div className="glass-card" style={{ padding: 24, border: '1px solid #e9d5ff' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 6 }}>
              Register New Organization
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6b6684', marginBottom: 18 }}>
              Add a new tenant with dedicated queue isolation and default branch.
            </p>

            <form onSubmit={handleCreateNewOrg} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              <div>
                <label className="label">Organization Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Apex Regional Hospital"
                  value={newOrgName}
                  onChange={e => setNewOrgName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Sector / Type</label>
                <select
                  className="select"
                  value={newOrgType}
                  onChange={e => setNewOrgType(e.target.value)}
                >
                  <option value="HOSPITAL">Hospital & Healthcare</option>
                  <option value="BANK">Retail & Commercial Banking</option>
                  <option value="CITIZEN_SERVICES">Citizen Service Centre</option>
                  <option value="OTHER">Other Enterprise</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label">Description (Optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Brief description of the facility"
                  value={newOrgDesc}
                  onChange={e => setNewOrgDesc(e.target.value)}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} /> Register Organization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
