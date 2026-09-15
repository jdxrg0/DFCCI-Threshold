import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Plus, Trash2, X, MessageSquare, Clock, Link as LinkIcon, Edit2, Upload, List, Timer, Key, Copy } from 'lucide-react';
import * as automation from '../services/automation';
import * as settings from '../services/settings';
import { parseExcelSchedule, generateQueueFromAssignments } from '../utils/excelParser';
import './MessengerAutomation.css';



const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

export default function MessengerAutomation({ showAlert, showConfirm }) {
  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    targetUrl: '',
    message: '',
    time: '12:00',
    selectedDays: []
  });
  
  const [messageQueue, setMessageQueue] = useState([]);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [queueToView, setQueueToView] = useState([]);
  const [queueEditingId, setQueueEditingId] = useState(null); // Used to patch an item

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const data = await automation.listSchedules();
        setSchedules(data);
      } catch (error) {
        console.error('Failed to load schedules', error);
      }
    };
    fetchSchedules();

    // Restore draft if page refreshed
    const savedDraft = localStorage.getItem('ma_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.isModalOpen) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setFormData(parsed.formData);
          setEditingId(parsed.editingId);
          setMessageQueue(parsed.messageQueue || []);
          setIsModalOpen(true);
        }
        // eslint-disable-next-line no-empty
      } catch {}
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem('ma_draft', JSON.stringify({
      isModalOpen, formData, editingId, messageQueue
    }));
  }, [isModalOpen, formData, editingId, messageQueue]);

  const [showCodeGenerator, setShowCodeGenerator] = useState(false);
  const [weeklyCodeConfig, setWeeklyCodeConfig] = useState(null);

  // Dispatch Form State
  const [enableDispatch, setEnableDispatch] = useState(false);
  const [dispatchUrl, setDispatchUrl] = useState('');
  const [dispatchDay, setDispatchDay] = useState('0');
  const [dispatchTime, setDispatchTime] = useState('13:00');
  const [dispatchMessage, setDispatchMessage] = useState('Here is the weekly code: {WeeklyCode}');
  const [isSavingDispatch, setIsSavingDispatch] = useState(false);

  const fetchWeeklyCodeConfig = async () => {
    try {
      const config = await settings.getWeeklyCode();
      setWeeklyCodeConfig(config);
      if (config) {
        setEnableDispatch(config.enableDispatch || false);
        setDispatchUrl(config.dispatchUrl || '');
        const cronParts = (config.dispatchCron || '0 13 * * 0').split(' ');
        if (cronParts.length >= 5) {
          setDispatchTime(`${cronParts[1].padStart(2, '0')}:${cronParts[0].padStart(2, '0')}`);
          setDispatchDay(cronParts[4]);
        }
        setDispatchMessage(config.dispatchMessage || 'Here is the weekly code: {WeeklyCode}');
      }
    } catch (err) {
      console.error('Failed to fetch weekly code config:', err);
    }
  };

  const handleSaveDispatchConfig = async () => {
    try {
      setIsSavingDispatch(true);
      const [hr, min] = dispatchTime.split(':');
      const formattedCron = `${parseInt(min)} ${parseInt(hr)} * * ${dispatchDay}`;
      
      const res = await settings.saveWeeklyCode({
        enableDispatch,
        dispatchUrl,
        dispatchCron: formattedCron,
        dispatchMessage
      });
      setWeeklyCodeConfig(res);
      if (showAlert) showAlert('Success', 'Weekly Code Dispatch Configuration Saved!');
    } catch (err) {
      console.error('Failed to save config', err);
      if (showAlert) showAlert('Error', 'Failed to save configuration');
    } finally {
      setIsSavingDispatch(false);
    }
  };

  useEffect(() => {
    if (showCodeGenerator) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchWeeklyCodeConfig();
    }
  }, [showCodeGenerator]);

  const handleOpenModal = () => setIsModalOpen(true);
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', targetUrl: '', message: '', time: '12:00', selectedDays: [] });
    setMessageQueue([]);
  };

  const handleToggleDay = (dayValue) => {
    setFormData(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(dayValue)
        ? prev.selectedDays.filter(d => d !== dayValue)
        : [...prev.selectedDays, dayValue]
    }));
  };

  // Convert local time and day to UTC Cron
  const convertLocalTimeToUTCCron = (timeString, localDays) => {
    if (!timeString || localDays.length === 0) return '';
    
    const [hours, minutes] = timeString.split(':').map(Number);
    
    const utcDays = new Set();
    let utcHours = 0;
    let utcMinutes = 0;

    localDays.forEach(localDayOfWeek => {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      
      const currentLocalDay = date.getDay();
      const dayDifference = localDayOfWeek - currentLocalDay;
      
      date.setDate(date.getDate() + dayDifference);
      
      utcMinutes = date.getUTCMinutes();
      utcHours = date.getUTCHours();
      utcDays.add(date.getUTCDay());
    });
    
    const sortedUtcDays = Array.from(utcDays).sort().join(',');
    return `${utcMinutes} ${utcHours} * * ${sortedUtcDays}`;
  };

  // Convert UTC Cron back to human-readable Local time
  const parseUTCCronToLocalString = (cronString) => {
    if (!cronString) return 'Invalid Schedule';
    const parts = cronString.split(' ');
    if (parts.length !== 5) return cronString;
    
    const [minutes, hours, , , daysOfWeekStr] = parts;
    const utcHours = parseInt(hours, 10);
    const utcMinutes = parseInt(minutes, 10);
    
    if (isNaN(utcHours) || isNaN(utcMinutes)) return cronString;
    
    const utcDays = daysOfWeekStr.split(',').map(Number);
    const localDaysSet = new Set();
    
    let localTimeStr = '';
    
    utcDays.forEach(utcDay => {
      // Jan 1, 2023 was a Sunday (0). So Jan 1 + utcDay gives us the correct day of week in UTC.
      const date = new Date(Date.UTC(2023, 0, 1 + utcDay, utcHours, utcMinutes));
      localDaysSet.add(date.getDay());
      // The local time is the same for all days
      if (!localTimeStr) {
        localTimeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      }
    });
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const localDaysArray = Array.from(localDaysSet).sort();
    
    // Format the days string
    let daysStr;
    if (localDaysArray.length === 7) {
      daysStr = 'Day';
    } else if (localDaysArray.length === 2 && localDaysArray.includes(0) && localDaysArray.includes(6)) {
      daysStr = 'Weekend';
    } else if (localDaysArray.length === 5 && !localDaysArray.includes(0) && !localDaysArray.includes(6)) {
      daysStr = 'Weekday';
    } else {
      daysStr = localDaysArray.map(d => dayNames[d]).join(', ');
    }
    
    return `Every ${daysStr} at ${localTimeStr}`;
  };

  const getTimeUntilNextRun = (cronString) => {
    try {
      const parts = cronString.split(' ');
      if (parts.length !== 5) return '';
      const utcMinutes = parseInt(parts[0]);
      const utcHours = parseInt(parts[1]);
      const utcDays = parts[4].split(',').map(Number);
      
      const now = new Date();
      let nextDate = null;
      
      for (let offset = 0; offset <= 7; offset++) {
        const testDate = new Date();
        testDate.setUTCDate(testDate.getUTCDate() + offset);
        testDate.setUTCHours(utcHours, utcMinutes, 0, 0);
        
        if (utcDays.includes(testDate.getUTCDay()) && testDate > now) {
          nextDate = testDate;
          break;
        }
      }
      
      if (!nextDate) return '';
      
      const diffMs = nextDate - now;
      if (diffMs < 0) return 'Running soon...';
      
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffDays > 0) return `Next in: ${diffDays}d ${diffHrs}h`;
      if (diffHrs > 0) return `Next in: ${diffHrs}h ${diffMins}m`;
      return `Next in: ${diffMins}m`;
    } catch {
      return '';
    }
  };

  const parseUTCCronToFormValues = (cronString) => {
    const parts = cronString.split(' ');
    if (parts.length !== 5) return { time: '12:00', selectedDays: [] };
    
    const [minutes, hours, , , daysOfWeekStr] = parts;
    const utcHours = parseInt(hours, 10);
    const utcMinutes = parseInt(minutes, 10);
    
    const utcDays = daysOfWeekStr.split(',').map(Number);
    const localDaysSet = new Set();
    
    let localHoursStr = '';
    let localMinutesStr = '';
    
    utcDays.forEach(utcDay => {
      const date = new Date(Date.UTC(2023, 0, 1 + utcDay, utcHours, utcMinutes));
      localDaysSet.add(date.getDay());
      if (!localHoursStr) {
        localHoursStr = date.getHours().toString().padStart(2, '0');
        localMinutesStr = date.getMinutes().toString().padStart(2, '0');
      }
    });
    
    return {
      time: `${localHoursStr}:${localMinutesStr}`,
      selectedDays: Array.from(localDaysSet)
    };
  };

  const handleEdit = (schedule) => {
    const { time, selectedDays } = parseUTCCronToFormValues(schedule.cronTime);
    setEditingId(schedule._id);
    setFormData({
      name: schedule.scheduleName,
      targetUrl: schedule.chatUrl,
      message: schedule.message,
      time,
      selectedDays
    });
    setMessageQueue(schedule.messageQueue || []);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.selectedDays.length === 0) {
      if (showAlert) showAlert('Validation Error', 'Please select at least one day for the schedule.');
      return;
    }

    const cronString = convertLocalTimeToUTCCron(formData.time, formData.selectedDays);
    
    const payload = {
      scheduleName: formData.name,
      cronTime: cronString,
      chatUrl: formData.targetUrl,
      message: formData.message,
      messageQueue: messageQueue
    };

    try {
      if (editingId) {
        const response = await automation.updateSchedule(editingId, payload);
        const updatedSchedule = response.data;
        const currentSchedules = Array.isArray(schedules) ? schedules : [];
        setSchedules(currentSchedules.map(s => s._id === editingId ? updatedSchedule : s));
      } else {
        const response = await automation.createSchedule(payload);
        const newSchedule = response.data;
        setSchedules([newSchedule, ...(Array.isArray(schedules) ? schedules : [])]);
      }
      
      handleCloseModal();
      
    } catch (error) {
      const errDetails = error.response?.data?.msg || error.response?.data?.error || error.message;
      console.error('Failed to create automation:', error.response?.data || error.message);
      if (showAlert) showAlert('Error', `Error scheduling reminder: ${errDetails}`);
    }
  };

  const handleDelete = (id) => {
    if (!showConfirm) return;
    
    showConfirm(
      'Delete Schedule',
      'Are you sure you want to delete this scheduled reminder? It will be removed from the database and GitHub.',
      async () => {
        try {
          await automation.deleteSchedule(id);
          setSchedules(schedules.filter(s => s._id !== id));
        } catch (error) {
          console.error('Failed to delete schedule', error);
          if (showAlert) showAlert('Error', 'Failed to delete schedule.');
        }
      }
    );
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <div className="ma-header">
        <div>
          <h2 className="text-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Calendar size={28} className="text-primary" />
            Messenger Automation
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Schedule automated Messenger group chat reminders.</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={18} />
          Add Reminder
        </button>
      </div>

      {schedules.length === 0 ? (
        <div className="ma-empty-state card">
          <Calendar size={48} style={{ color: 'var(--border-color)' }} />
          <h3>No reminders scheduled</h3>
          <p>Create your first automated reminder to keep the community engaged.</p>
          <button className="btn btn-secondary mt-4" onClick={handleOpenModal}>
             Create Reminder
          </button>
        </div>
      ) : (
        <div className="ma-grid">
          {(Array.isArray(schedules) ? schedules : []).map(schedule => (
            <div key={schedule._id} className="card ma-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--border-color)', borderRadius: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-main)' }}>{schedule.scheduleName}</h3>
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--primary-glow)', color: 'var(--primary)', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700' }}>
                      <Clock size={12} />
                      {parseUTCCronToLocalString(schedule.cronTime)}
                    </div>
                    {getTimeUntilNextRun(schedule.cronTime) && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-muted)', padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '700' }}>
                        <Timer size={12} />
                        {getTimeUntilNextRun(schedule.cronTime)}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="ma-card-actions" style={{ background: 'var(--bg-secondary)', padding: '0.2rem', borderRadius: '0.5rem', display: 'flex', gap: '0.1rem' }}>
                  <button className="ma-icon-btn" onClick={() => {
                    setQueueToView(schedule.messageQueue || []);
                    setQueueEditingId(schedule._id);
                    setShowQueueModal(true);
                  }} title="View Queue" style={{ padding: '0.4rem', borderRadius: '0.4rem' }}>
                    <List size={16} />
                  </button>
                  <button className="ma-icon-btn" onClick={() => handleEdit(schedule)} title="Edit" style={{ padding: '0.4rem', borderRadius: '0.4rem' }}>
                    <Edit2 size={16} />
                  </button>
                  <button className="ma-icon-btn text-danger" onClick={() => handleDelete(schedule._id)} title="Delete" style={{ padding: '0.4rem', borderRadius: '0.4rem' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              
              <div style={{ padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <a href={schedule.chatUrl || '#'} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <LinkIcon size={12} style={{ flexShrink: 0 }} />
                  {schedule.chatUrl ? schedule.chatUrl.replace('https://', '') : 'Invalid URL'}
                </a>
              </div>
              
              <div style={{ position: 'relative', padding: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--primary)', borderRadius: '0.75rem', fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: '3', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                <MessageSquare size={14} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--border-color)' }} />
                <span style={{ paddingRight: '1.5rem', display: 'block' }}>{schedule.message}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && createPortal(
        <div className="ma-modal-overlay">
          <div className="card ma-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3>{editingId ? 'Edit Scheduled Reminder' : 'Create Scheduled Reminder'}</h3>
              <button onClick={handleCloseModal} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Schedule Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Friday Youth Gathering"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Chat URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  placeholder="https://m.me/j/..."
                  value={formData.targetUrl}
                  onChange={(e) => setFormData({...formData, targetUrl: e.target.value})}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Time (Local)</label>
                <input 
                  type="time" 
                  className="form-input" 
                  style={{ width: '100%', maxWidth: '150px' }}
                  value={formData.time}
                  onChange={(e) => setFormData({...formData, time: e.target.value})}
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Calendar size={16} /> Repeat on
                </label>
                <div className="ma-days-selector">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      className={`ma-day-btn ${formData.selectedDays.includes(day.value) ? 'selected' : ''}`}
                      onClick={() => handleToggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Message Content</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Write your automated message here. Use {Role} to dynamically replace names if you upload an Excel sheet (e.g., {Presider})"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required 
                />
              </div>

              <div className="form-group" style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                  <Upload size={16} /> Advanced: Dynamic Excel Mapping
                </label>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  Upload a <b>DFCCI Serving Schedule</b> Excel file to automatically generate a queue of dynamic messages for the entire year!
                </p>
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (!formData.message) {
                      if (showAlert) showAlert('Notice', 'Please write your message template first before uploading the Excel file, so we know how to format the names!');
                      e.target.value = null;
                      return;
                    }
                    setIsParsingExcel(true);
                    try {
                      const assignments = await parseExcelSchedule(file);
                      const queue = generateQueueFromAssignments(assignments, formData.message);
                      setMessageQueue(queue);
                      if (showAlert) showAlert('Success', `Successfully parsed Excel and generated ${queue.length} dynamic messages!`);
                    } catch (err) {
                      console.error('Excel parse error', err);
                      if (showAlert) showAlert('Error', 'Failed to parse the Excel file. Please ensure it matches the Serving Schedule format.');
                    } finally {
                      setIsParsingExcel(false);
                      e.target.value = null; // reset
                    }
                  }}
                  className="form-input" 
                />
                {isParsingExcel && <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', marginTop: '0.5rem' }}>Parsing...</p>}
                {messageQueue.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>✅ {messageQueue.length} Messages in Queue</span>
                  </div>
                )}
              </div>

              <div className="ma-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Schedule</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Queue Viewer Modal */}
      {showQueueModal && createPortal(
        <div className="ma-modal-overlay">
          <div className="card ma-modal-content" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3>Upcoming Message Queue</h3>
              <button onClick={() => setShowQueueModal(false)} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 0' }}>
              {queueToView.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No messages in queue. Edit schedule and upload Excel file to generate.</p>
              ) : (
                <>
                  <QueueList 
                    title="Upcoming Messages"
                    items={queueToView.filter(q => new Date(q.targetDate) >= new Date(new Date().setHours(0,0,0,0)))}
                    queueEditingId={queueEditingId}
                    setQueueToView={setQueueToView}
                    queueToView={queueToView}
                    showAlert={showAlert}
                    setSchedules={setSchedules}
                  />
                  <QueueList 
                    title="Archived (Past Dates)"
                    items={queueToView.filter(q => new Date(q.targetDate) < new Date(new Date().setHours(0,0,0,0))).reverse()}
                    queueEditingId={queueEditingId}
                    setQueueToView={setQueueToView}
                    queueToView={queueToView}
                    showAlert={showAlert}
                    setSchedules={setSchedules}
                  />
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Action Button for Weekly Code Generator */}
      <button 
        onClick={() => setShowCodeGenerator(true)}
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          width: '56px', 
          height: '56px', 
          borderRadius: '50%', 
          background: 'var(--accent-color, #10b981)', 
          color: '#fff', 
          border: 'none', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          cursor: 'pointer', 
          zIndex: 90,
          transition: 'transform 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        title="Weekly Code Generator"
      >
        <Key size={24} />
      </button>

      {/* Code Generator Modal */}
      {showCodeGenerator && createPortal(
        <div className="ma-modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowCodeGenerator(false)}>
          <div className="card ma-modal-content" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Key size={22} className="text-primary" />
                Weekly Code Generator
              </h3>
              <button onClick={() => setShowCodeGenerator(false)} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            <div className="ma-modal-body">
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--primary-color)' }}>Current Active Code</h4>
                {weeklyCodeConfig ? (
                  <div style={{ padding: '0.8rem', background: 'var(--bg-secondary)', borderRadius: '6px', textAlign: 'center' }}>
                    <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Automatically updates every Sunday at 12:00 PM. Use <strong>{'{WeeklyCode}'}</strong> in your messages to inject this.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, color: 'var(--text-color)' }}>{weeklyCodeConfig.currentCode}</h3>
                      <button 
                        className="ma-icon-btn" 
                        title="Copy to clipboard"
                        onClick={() => {
                          navigator.clipboard.writeText(weeklyCodeConfig.currentCode);
                          if (showAlert) showAlert('Copied', 'Active code copied to clipboard!');
                        }}
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading active code...</p>
                )}
              </div>

              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <h4 style={{ margin: '0 0 1rem 0', color: 'var(--primary-color)' }}>Dispatch Configuration</h4>
                
                <div className="form-group" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    type="checkbox" 
                    id="enableDispatch"
                    checked={enableDispatch}
                    onChange={(e) => setEnableDispatch(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="enableDispatch" style={{ margin: 0, cursor: 'pointer', fontWeight: 500 }}>
                    Enable Auto-Dispatch
                  </label>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                  <label style={{ margin: 0, fontWeight: 500 }}>Target Chat URL</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="https://www.messenger.com/t/..."
                    value={dispatchUrl}
                    onChange={(e) => setDispatchUrl(e.target.value)}
                    disabled={!enableDispatch}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                    <label style={{ margin: 0, fontWeight: 500 }}>Dispatch Day</label>
                    <select 
                      className="form-control"
                      value={dispatchDay}
                      onChange={(e) => setDispatchDay(e.target.value)}
                      disabled={!enableDispatch}
                    >
                      <option value="0">Sunday</option>
                      <option value="1">Monday</option>
                      <option value="2">Tuesday</option>
                      <option value="3">Wednesday</option>
                      <option value="4">Thursday</option>
                      <option value="5">Friday</option>
                      <option value="6">Saturday</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                    <label style={{ margin: 0, fontWeight: 500 }}>Dispatch Time</label>
                    <input 
                      type="time" 
                      className="form-control"
                      value={dispatchTime}
                      onChange={(e) => setDispatchTime(e.target.value)}
                      disabled={!enableDispatch}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                  <label style={{ margin: 0, fontWeight: 500 }}>Message Content</label>
                  <textarea 
                    className="form-control"
                    rows="3"
                    value={dispatchMessage}
                    onChange={(e) => setDispatchMessage(e.target.value)}
                    placeholder="Here is the code: {WeeklyCode}"
                    disabled={!enableDispatch}
                  />
                  <small className="text-muted">Use <code>{"{WeeklyCode}"}</code> to inject the code.</small>
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  onClick={handleSaveDispatchConfig}
                  disabled={isSavingDispatch}
                >
                  {isSavingDispatch ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function QueueList({ items, title, queueEditingId, setQueueToView, queueToView, showAlert, setSchedules }) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h4 style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>{title} ({items.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map((q, idx) => {
          const mainIdx = queueToView.findIndex(item => item.targetDate === q.targetDate);
          return (
            <div key={idx} style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', opacity: q.isSent ? 0.7 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  Target Date: {q.targetDate}
                </span>
                {q.isSent ? (
                  <span style={{ fontSize: '0.75rem', background: 'var(--success-color)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Sent</span>
                ) : new Date(q.targetDate) < new Date(new Date().setHours(0,0,0,0)) ? (
                  <span style={{ fontSize: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>Archived</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: 'var(--warning-color)', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>Pending</span>
                )}
              </div>
              
              <textarea
                style={{ width: '100%', minHeight: '100px', padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', fontSize: '0.85rem' }}
                value={q.messageText}
                onChange={(e) => {
                  const newQueue = [...queueToView];
                  newQueue[mainIdx].messageText = e.target.value;
                  setQueueToView(newQueue);
                }}
              />
              
              {!q.isSent && (
                <button 
                  className="btn btn-secondary" 
                  style={{ marginTop: '0.5rem', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
                  onClick={async () => {
                    try {
                      await automation.editQueueItem(queueEditingId, {
                        targetDate: q.targetDate,
                        messageText: q.messageText
                      });
                      if (showAlert) showAlert('Success', 'Queue item updated successfully!');
                      setSchedules(prev => prev.map(s => {
                        if (s._id === queueEditingId) {
                          const updatedQueue = [...(s.messageQueue || [])];
                          if (mainIdx > -1) updatedQueue[mainIdx].messageText = q.messageText;
                          return { ...s, messageQueue: updatedQueue };
                        }
                        return s;
                      }));
                    } catch {
                      if (showAlert) showAlert('Error', 'Failed to update queue item.');
                    }
                  }}
                >
                  Save Override
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
