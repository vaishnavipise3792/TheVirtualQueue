import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import {
  UserCheck,
  Printer,
  Sparkles,
  AlertCircle,
  Clock,
  Users,
  Search,
  CheckCircle,
  Send,
  Ticket,
  Brain,
  Check
} from 'lucide-react';

const DURATION_PRESETS = [
  { key: '3', label: 'Quick Routine (~3m)', hint: 'Routine consult / payment / renewal', value: 3 },
  { key: '7', label: 'Standard Review (~7m)', hint: 'Regular checkup / ECG / senior review', value: 7 },
  { key: '12', label: 'Extended Procedure (~12m)', hint: 'Comprehensive review / loan / trauma', value: 12 },
  { key: 'auto', label: '🤖 Auto Random Forest', hint: 'Machine Learning predicts based on history', value: null }
];

export default function FrontDeskView() {
  const {
    currentOrg,
    currentUser,
    openTokenSlip,
    addToast,
    liveEventCounter
  } = useApp();

  const [services, setServices] = useState([]);
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('NORMAL');
  const [selectedDurationKey, setSelectedDurationKey] = useState('auto');
  const [customFields, setCustomFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [recentWalkins, setRecentWalkins] = useState([]);

  // Load services for current organization
  useEffect(() => {
    if (!currentOrg?.id) return;
    api.getOrgDetails(currentOrg.id).then(data => {
      const srvs = data.services || [];
      setServices(srvs);
      if (srvs.length > 0 && !selectedServiceId) {
        setSelectedServiceId(srvs[0].id);
      }
    }).catch(err => console.error(err));
  }, [currentOrg?.id, liveEventCounter]);

  const selectedService = services.find(s => s.id === selectedServiceId) || services[0];
  const priorityConfigs = selectedService?.priorityLevels || [{ key: 'NORMAL', label: 'Normal', weight: 10 }];
  const optionalFields = selectedService?.optionalFields || [];

  const handleCustomFieldChange = (key, val) => {
    setCustomFields(prev => ({ ...prev, [key]: val }));
  };

  const handleRegisterWalkin = async (e) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setErrorMsg('Customer name is required for registration');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const staffHeaders = {
        'x-staff-id': currentUser.id,
        'x-staff-name': currentUser.name,
        'x-staff-role': currentUser.role
      };

      const selectedPreset = DURATION_PRESETS.find(p => p.key === selectedDurationKey);
      const finalFields = { ...customFields };
      if (selectedPreset?.value) {
        finalFields.expected_duration_mins = selectedPreset.value;
      }

      const result = await api.registerWalkin(currentOrg.id, {
        serviceId: selectedService.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || '+910000000000',
        priorityLevel,
        customFields: finalFields
      }, staffHeaders);

      addToast({
        type: 'success',
        title: 'Walk-in Registered',
        message: `Token ${result.tokenNumber} issued successfully. Predicted wait: ~${result.estimatedWaitMins || 10} mins.`
      });

      setRecentWalkins(prev => [
        {
          tokenNumber: result.tokenNumber,
          customerName: customerName.trim(),
          serviceName: selectedService.name,
          time: new Date().toLocaleTimeString(),
          priority: result.priorityLevel,
          trackingCode: result.trackingCode,
          waitMins: result.estimatedWaitMins || 10,
          formula: result.calculationFormula
        },
        ...prev.slice(0, 9)
      ]);

      openTokenSlip({
        tokenNumber: result.tokenNumber,
        trackingCode: result.trackingCode,
        serviceName: selectedService.name,
        serviceCode: selectedService.code,
        organizationName: currentOrg.name,
        priorityLevel: result.priorityLevel,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        joinedAt: result.joinedAt,
        positionAhead: result.positionAhead,
        estimatedWaitMins: result.estimatedWaitMins,
        waitMethod: result.waitMethod,
        waitBreakdown: result.breakdown || result.waitBreakdown,
        calculationFormula: result.calculationFormula,
        rfDetails: result.rfDetails
      });

      setCustomerName('');
      setCustomerPhone('');
      setPriorityLevel('NORMAL');
      setSelectedDurationKey('auto');
      setCustomFields({});
    } catch (err) {
      setErrorMsg(err.message || 'Failed to register walk-in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 20px 80px' }}>
      {/* Title Header (Light Purple Theme) */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid #e9d5ff',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 28,
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
            <UserCheck size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Front-Desk Operations
            </div>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#1e1b4b' }}>
              Rapid Walk-in Registration & AI Wait-Time Prediction
            </h1>
          </div>
        </div>

        <div style={{
          background: '#f5f0fd',
          border: '1px solid #ddd6fe',
          borderRadius: 'var(--radius-md)',
          padding: '8px 16px',
          fontSize: '0.85rem',
          color: '#3b2063'
        }}>
          Operator: <strong style={{ color: '#7c3aed' }}>{currentUser.name}</strong> ({currentUser.role})
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.3fr 1fr',
        gap: 28
      }}>
        {/* Left Column: Rapid Walk-in Entry Form */}
        <div className="glass-card" style={{ padding: 28, border: '1px solid #e9d5ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' }}>
              Issue Walk-In Token
            </h2>
            <span className="badge" style={{ background: '#ede9fe', color: '#6d28d9', border: '1px solid #c4b5fd' }}>
              <Brain size={12} style={{ marginRight: 4 }} /> Random Forest Active
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#6b6684', marginBottom: 20 }}>
            Instantly register visitors, generate printed slips, and preview the Random Forest wait-time calculation.
          </p>

          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#be123c',
              fontSize: '0.85rem',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleRegisterWalkin}>
            {/* Service Selection */}
            <div style={{ marginBottom: 16 }}>
              <label className="label">Destination Service Queue</label>
              <select
                className="select"
                value={selectedServiceId}
                onChange={e => setSelectedServiceId(e.target.value)}
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name} (Waiting: {s.waiting_count || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Name & Phone */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div>
                <label className="label">Customer / Patient Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Ramesh Patel"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="label">Mobile Number (Optional)</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 98765 00000"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Expected Task Duration / Complexity Presets */}
            <div style={{ marginBottom: 18 }}>
              <label className="label">Expected Task Duration (Random Forest Feature)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DURATION_PRESETS.map(preset => {
                  const isSelected = selectedDurationKey === preset.key;
                  return (
                    <div
                      key={preset.key}
                      onClick={() => setSelectedDurationKey(preset.key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${isSelected ? '#7c3aed' : '#e9d5ff'}`,
                        background: isSelected ? '#f5f0fd' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                        boxShadow: isSelected ? '0 2px 8px rgba(124, 58, 237, 0.12)' : 'none'
                      }}
                    >
                      <div style={{
                        fontSize: '0.825rem',
                        fontWeight: 700,
                        color: isSelected ? '#581c87' : '#1e1b4b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span>{preset.label}</span>
                        {isSelected && <Check size={14} color="#7c3aed" />}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6b6684', marginTop: 2 }}>
                        {preset.hint}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Priority Selection */}
            <div style={{ marginBottom: 18 }}>
              <label className="label">Priority Level</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {priorityConfigs.map(p => {
                  const isSelected = priorityLevel === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPriorityLevel(p.key)}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${isSelected ? '#7c3aed' : '#e9d5ff'}`,
                        background: isSelected ? '#f5f0fd' : '#ffffff',
                        color: isSelected ? '#581c87' : '#1e1b4b',
                        fontWeight: isSelected ? 800 : 500,
                        cursor: 'pointer',
                        fontSize: '0.825rem',
                        transition: 'all var(--transition-fast)'
                      }}
                    >
                      {p.label} (wt: {p.weight})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Fields */}
            {optionalFields.length > 0 && (
              <div style={{
                background: '#faf5ff',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                marginBottom: 20,
                border: '1px solid #eedcfc'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 10 }}>
                  Service Details
                </div>
                {optionalFields.map(f => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <label className="label">{f.label}</label>
                    {f.type === 'select' ? (
                      <select
                        className="select"
                        value={customFields[f.key] || ''}
                        onChange={e => handleCustomFieldChange(f.key, e.target.value)}
                      >
                        <option value="">-- Choose {f.label} --</option>
                        {f.options?.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input"
                        placeholder={`Enter ${f.label}...`}
                        value={customFields[f.key] || ''}
                        onChange={e => handleCustomFieldChange(f.key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px' }}
            >
              <Ticket size={18} />
              <span>{submitting ? 'Generating...' : 'Issue Walk-In Token & Print Slip'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Recent Walk-ins & Live AI Queue Status */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick AI Info Box */}
          <div style={{
            background: 'linear-gradient(135deg, #faf5ff 0%, #f5f0fd 100%)',
            border: '1px solid #ddd6fe',
            borderRadius: 16,
            padding: '18px 20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Brain size={18} color="#7c3aed" />
              <strong style={{ fontSize: '0.925rem', color: '#1e1b4b' }}>
                AI Wait-Time Formula Active
              </strong>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#6b6684', lineHeight: 1.5 }}>
              Each visitor's duration is predicted via 100 Random Forest decision trees. Summing the queue ahead guarantees realistic waiting estimates.
            </p>
          </div>

          {/* Recent Walk-in List */}
          <div className="glass-card" style={{ padding: 22, border: '1px solid #e9d5ff' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e1b4b', marginBottom: 14 }}>
              Recently Issued Walk-In Tokens
            </h3>

            {recentWalkins.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: '#9f9bb5', fontSize: '0.875rem' }}>
                No walk-ins registered in this session yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentWalkins.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: '#fcfaff',
                      border: '1px solid #eedcfc',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <strong style={{ color: '#6d28d9', fontSize: '1.05rem', fontFamily: 'var(--font-heading)' }}>
                          {w.tokenNumber}
                        </strong>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e1b4b' }}>
                          {w.customerName}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b6684', marginTop: 2 }}>
                        {w.serviceName} · {w.time}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#7c3aed' }}>
                        ~{w.waitMins}m wait
                      </div>
                      <button
                        onClick={() => openTokenSlip({
                          tokenNumber: w.tokenNumber,
                          trackingCode: w.trackingCode,
                          serviceName: w.serviceName,
                          organizationName: currentOrg.name,
                          priorityLevel: w.priority
                        })}
                        className="btn btn-outline btn-sm"
                        style={{ marginTop: 4, padding: '3px 8px', fontSize: '0.75rem', borderColor: '#ddd6fe', color: '#7c3aed' }}
                      >
                        <Printer size={12} /> Reprint
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
