import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Clock, MessageSquare, Briefcase, Calendar } from 'lucide-react';
import api from '../api';

export default function RoleReminders({ schedules, setSchedules, showAlert, showConfirm }) {
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [reminders, setReminders] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  
  const [formData, setFormData] = useState({
    role: '',
    daysPrior: '', // e.g. "1, 3, 5"
    messageTemplate: 'Hi {Name}! This is a reminder for your role as {Role} this coming Sunday.'
  });

  useEffect(() => {
    if (selectedScheduleId) {
      const schedule = schedules.find(s => s._id === selectedScheduleId);
      if (schedule) {
        setReminders(schedule.roleReminders || []);
      }
    } else {
      setReminders([]);
    }
  }, [selectedScheduleId, schedules]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedScheduleId) return;

    try {
      const schedule = schedules.find(s => s._id === selectedScheduleId);
      const newReminders = [...(schedule.roleReminders || [])];
      
      const parsedDays = formData.daysPrior.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));

      const newRule = {
        role: formData.role,
        daysPrior: parsedDays,
        messageTemplate: formData.messageTemplate
      };

      if (editingIndex !== null) {
        newReminders[editingIndex] = newRule;
      } else {
        newReminders.push(newRule);
      }

      // Update backend via PUT request
      const payload = {
        scheduleName: schedule.scheduleName,
        cronTime: schedule.cronTime,
        chatUrl: schedule.chatUrl,
        message: schedule.message,
        messageQueue: schedule.messageQueue,
        roleReminders: newReminders
      };

      const response = await api.put(`/automation/schedule/${selectedScheduleId}`, payload);
      
      setSchedules(prev => prev.map(s => s._id === selectedScheduleId ? response.data.data : s));
      setIsModalOpen(false);
      setEditingIndex(null);
      setFormData({ role: '', daysPrior: '', messageTemplate: '' });
      if (showAlert) showAlert('Success', 'Role Reminder updated successfully.');

    } catch (err) {
      console.error(err);
      if (showAlert) showAlert('Error', 'Failed to save role reminder.');
    }
  };

  const handleDelete = async (index) => {
    if (!showConfirm || !selectedScheduleId) return;

    showConfirm('Delete Reminder Rule', 'Are you sure you want to delete this reminder rule?', async () => {
      try {
        const schedule = schedules.find(s => s._id === selectedScheduleId);
        const newReminders = [...(schedule.roleReminders || [])];
        newReminders.splice(index, 1);

        const payload = {
          scheduleName: schedule.scheduleName,
          cronTime: schedule.cronTime,
          chatUrl: schedule.chatUrl,
          message: schedule.message,
          messageQueue: schedule.messageQueue,
          roleReminders: newReminders
        };

        const response = await api.put(`/automation/schedule/${selectedScheduleId}`, payload);
        setSchedules(prev => prev.map(s => s._id === selectedScheduleId ? response.data.data : s));

      } catch (err) {
        console.error(err);
        if (showAlert) showAlert('Error', 'Failed to delete role reminder.');
      }
    });
  };

  const handleEdit = (rule, index) => {
    setEditingIndex(index);
    setFormData({
      role: rule.role,
      daysPrior: rule.daysPrior.join(', '),
      messageTemplate: rule.messageTemplate
    });
    setIsModalOpen(true);
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label className="form-label">Select Group Schedule</label>
        <select 
          className="form-input" 
          value={selectedScheduleId}
          onChange={(e) => setSelectedScheduleId(e.target.value)}
        >
          <option value="">-- Choose a schedule --</option>
          {schedules.map(s => (
            <option key={s._id} value={s._id}>{s.scheduleName}</option>
          ))}
        </select>
      </div>

      {selectedScheduleId ? (
        <div className="card" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
            <h4 style={{ margin: 0 }}>Configured Roles</h4>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditingIndex(null); setFormData({ role: '', daysPrior: '', messageTemplate: 'Hi {Name}! This is a reminder for your role as {Role} this coming Sunday.' }); setIsModalOpen(true); }}>
              <Plus size={14} /> Add Rule
            </button>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {reminders.map((rule, idx) => (
              <div key={idx} className="card" style={{ 
                padding: '1.25rem', 
                background: 'var(--surface)', 
                border: '1px solid var(--surface-border)', 
                borderRadius: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.2s',
                position: 'relative',
                overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#8b5cf6' }} />
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '0.6rem', borderRadius: '50%', color: '#8b5cf6' }}>
                      <Briefcase size={20} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        {rule.role}
                      </h4>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Role</p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', width: '100%' }}>
                    <Calendar size={14} /> Nudge Schedule
                  </span>
                  {rule.daysPrior.map(d => (
                    <span key={d} style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '600' }}>
                      {d} days before
                    </span>
                  ))}
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <MessageSquare size={14} /> Message Template
                  </span>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    "{rule.messageTemplate}"
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0.4rem' }} onClick={() => handleEdit(rule, idx)}>
                    <Edit2 size={16} style={{ marginRight: '0.4rem' }} /> Edit
                  </button>
                  <button className="btn btn-secondary text-danger" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0.4rem', borderColor: 'transparent', background: 'rgba(239, 68, 68, 0.05)' }} onClick={() => handleDelete(idx)}>
                    <Trash2 size={16} /> 
                  </button>
                </div>
              </div>
            ))}
            {reminders.length === 0 && (
              <div className="card" style={{ gridColumn: '1 / -1', padding: '3rem 2rem', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border-color)' }}>
                <Clock size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
                <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>No Reminders Configured</h4>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add a rule to automate private messages to the members assigned to this schedule.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Please select a schedule above to configure its role reminders.
        </div>
      )}

      {isModalOpen && (
        <div className="ma-modal-overlay">
          <div className="card ma-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3>{editingIndex !== null ? 'Edit Role Reminder' : 'Add Role Reminder'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="ma-icon-btn">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Excel Role Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  placeholder="e.g. Presider, Opening Prayer"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Days Prior to Event (Comma separated)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.daysPrior}
                  onChange={(e) => setFormData({...formData, daysPrior: e.target.value})}
                  placeholder="e.g. 1, 3, 5 (for Mon, Wed, Fri if Sunday is the event)"
                  required 
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  If the target event is Sunday (day 0), entering 6, 4, 2 means they will be nudged Monday, Wednesday, and Friday.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Private Message Template</label>
                <textarea 
                  className="form-textarea" 
                  value={formData.messageTemplate}
                  onChange={(e) => setFormData({...formData, messageTemplate: e.target.value})}
                  required 
                  style={{ minHeight: '100px' }}
                />
              </div>
              <div className="ma-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
