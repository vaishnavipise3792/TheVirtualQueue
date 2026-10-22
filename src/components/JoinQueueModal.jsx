import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../utils/api.js';
import {
  X,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Clock,
  Users,
  Brain,
  Zap,
  Check
} from 'lucide-react';

const DURATION_PRESETS = [
  { key: '3', label: 'Quick Routine (~3m)', hint: 'Brief checkup / standard slip', value: 3 },
  { key: '7', label: 'Standard Consult (~7m)', hint: 'Regular checkup / ECG / senior review', value: 7 },
  { key: '12', label: 'Extended Review (~12m)', hint: 'In-depth consultation / specialist procedure', value: 12 },
  { key: 'auto', label: '🤖 Random Forest Auto', hint: 'Machine Learning predicts based on profile', value: null }
];

export default function JoinQueueModal() {
  const {
    joinModalService,
    closeJoinModal,
    currentOrg,
    openTokenSlip,
    addToast
  } = useApp();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('NORMAL');
  const [selectedDurationKey, setSelectedDurationKey] = useState('auto');
  const [customFields, setCustomFields] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!joinModalService) return null;

  const priorities = joinModalService.priorityLevels || [
    { key: 'NORMAL', label: 'Normal Queue', weight: 10 }
  ];
  const optionalFields = joinModalService.optionalFields || [];

  const handleFieldChange = (key, value) => {
    setCustomFields(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setErrorMsg('Please provide your name and phone number to receive your virtual token.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {

      const finalFields = { ...customFields };


      const result = await api.joinQueue({
        organizationId: currentOrg.id,
        serviceId: joinModalService.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        priorityLevel,
        customFields: finalFields
      });

      addToast({
        type: 'success',
        title: 'Virtual Token Issued!',
        message: `Token ${result.tokenNumber} is ready for ${joinModalService.name}. Tracking link generated.`
      });

      closeJoinModal();

      // Open Token Slip Modal with detailed Random Forest calculation
      openTokenSlip({
        tokenNumber: result.tokenNumber,
        trackingCode: result.trackingCode,
        serviceName: joinModalService.name,
        serviceCode: joinModalService.code,
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
    } catch (err) {
      setErrorMsg(err.message || 'Failed to join queue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={closeJoinModal}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ border: '1px solid #ddd6fe' }}>
        {/* Header (Light Purple Theme) */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #f3e8ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="badge badge-waiting">{joinModalService.code}</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e1b4b' }}>
                Join Virtual Queue
              </h3>
            </div>
            <div style={{ fontSize: '0.825rem', color: '#6b21a8', marginTop: 2, fontWeight: 500 }}>
              {currentOrg?.name} · {joinModalService.name}
            </div>
          </div>
          <button
            onClick={closeJoinModal}
            className="btn btn-outline btn-sm"
            style={{ borderRadius: 'var(--radius-full)', padding: '6px 8px', borderColor: '#e9d5ff', color: '#6b21a8' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Service Stats & AI Banner */}
        <div style={{
          padding: '12px 24px',
          background: '#faf5ff',
          borderBottom: '1px solid #eedcfc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.825rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4c1d95' }}>
            <Users size={15} color="#7c3aed" />
            <span>Currently waiting: <strong style={{ color: '#1e1b4b' }}>{joinModalService.waiting_count || 0} tokens</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#4c1d95' }}>
            <Brain size={15} color="#7c3aed" />
            <span>AI Waiting Time: <strong style={{ color: '#6d28d9' }}>~{joinModalService.estimatedWaitMins || 10} mins</strong></span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {errorMsg && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#be123c',
              fontSize: '0.85rem',
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Customer Name */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">
              Full Name <span style={{ color: 'var(--rose-primary)' }}>*</span>
            </label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Aarav Sharma"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: '#7c779a' }}>
              🔒 Privacy Guaranteed: Your name is strictly confidential and never displayed on public screens.
            </span>
          </div>

          {/* Mobile Phone */}
          <div style={{ marginBottom: 16 }}>
            <label className="label">
              Mobile Phone Number <span style={{ color: 'var(--rose-primary)' }}>*</span>
            </label>
            <input
              type="tel"
              className="input"
              placeholder="+91 98765 43210"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              required
            />
            <span style={{ fontSize: '0.72rem', color: '#7c779a' }}>
              Used to trigger your real-time "Almost Your Turn" notification alert.
            </span>
          </div>



          {/* Priority Level Configuration */}
          <div style={{ marginBottom: 18 }}>
            <label className="label">Queue Priority Category</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
              {priorities.map(p => {
                const isSelected = priorityLevel === p.key;
                return (
                  <div
                    key={p.key}
                    onClick={() => setPriorityLevel(p.key)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${isSelected ? '#7c3aed' : '#e9d5ff'}`,
                      background: isSelected ? '#f5f0fd' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{
                      fontSize: '0.825rem',
                      fontWeight: 700,
                      color: isSelected ? '#581c87' : '#1e1b4b'
                    }}>
                      {p.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#7c779a', marginTop: 2 }}>
                      Weight: {p.weight}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector-Specific Optional Fields */}
          {optionalFields.length > 0 && (
            <div style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: '1px solid #f3e8ff',
              marginBottom: 18
            }}>
              <div style={{ fontSize: '0.775rem', fontWeight: 800, color: '#7c3aed', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Service Specific Details
              </div>

              {optionalFields.map(field => (
                <div key={field.key} style={{ marginBottom: 12 }}>
                  <label className="label">{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      className="select"
                      value={customFields[field.key] || ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                    >
                      <option value="">-- Select {field.label} --</option>
                      {field.options?.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="input"
                      placeholder={`Enter ${field.label.toLowerCase()}...`}
                      value={customFields[field.key] || ''}
                      onChange={e => handleFieldChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
            <button
              type="button"
              onClick={closeJoinModal}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ minWidth: 160 }}
            >
              {submitting ? 'Predicting & Issuing...' : (
                <>
                  <span>Get My Token</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
