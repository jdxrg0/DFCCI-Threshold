import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Plus, Trash2, X, MessageSquare, Clock, Link as LinkIcon, Edit2, Upload, List, Timer, ChevronRight, ChevronLeft, BookOpen, Key, Copy } from 'lucide-react';
import api from '../api';
import { parseExcelSchedule, generateQueueFromAssignments } from '../utils/excelParser';
import '../components/MessengerAutomation.css';
import MemberDirectory from '../components/MemberDirectory';



const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

import PopupModal from '../components/PopupModal';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AutomationDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isAlert: false, isPrompt: false, promptValue: '' });
  const showAlert = (title, message) => setPopup({ isOpen: true, title, message, onConfirm: null, isAlert: true, isPrompt: false, promptValue: '' });
  const showConfirm = (title, message, onConfirm) => setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: false, promptValue: '' });
  
  const [showMembersModal, setShowMembersModal] = useState(false);

  const [schedules, setSchedules] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    targetUrl: '',
    targetRole: '',
    message: '',
    time: '12:00',
    selectedDays: [],
    enableCodeBroadcast: false,
    codeTime: '08:00',
    codeSelectedDays: [],
    codeTemplate: 'DFCCI-S-LU-{DATE}'
  });
  const [messageQueue, setMessageQueue] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [members, setMembers] = useState([]);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [showQueueModal, setShowQueueModal] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [queueToView, setQueueToView] = useState([]);
  const [queueEditingId, setQueueEditingId] = useState(null); // Used to patch an item

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
      const res = await api.get('/settings/weekly-code');
      setWeeklyCodeConfig(res.data);
      if (res.data) {
        setEnableDispatch(res.data.enableDispatch || false);
        setDispatchUrl(res.data.dispatchUrl || '');
        const cronParts = (res.data.dispatchCron || '0 13 * * 0').split(' ');
        if (cronParts.length >= 5) {
          setDispatchTime(`${cronParts[1].padStart(2, '0')}:${cronParts[0].padStart(2, '0')}`);
          setDispatchDay(cronParts[4]);
        }
        setDispatchMessage(res.data.dispatchMessage || 'Here is the weekly code: {WeeklyCode}');
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
      
      const res = await api.put('/settings/weekly-code', {
        enableDispatch,
        dispatchUrl,
        dispatchCron: formattedCron,
        dispatchMessage
      });
      setWeeklyCodeConfig(res.data);
      showAlert('Success', 'Weekly Code Dispatch Configuration Saved!');
    } catch (err) {
      console.error('Failed to save config', err);
      showAlert('Error', 'Failed to save configuration');
    } finally {
      setIsSavingDispatch(false);
    }
  };

  useEffect(() => {
    if (showCodeGenerator) {
      fetchWeeklyCodeConfig();
    }
  }, [showCodeGenerator]);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await api.get('/automation/schedules');
        setSchedules(response.data);
      } catch (error) {
        console.error('Failed to load schedules', error);
      }
    };
    fetchSchedules();

    const fetchRoles = async () => {
      try {
        const res = await api.get('/calendar');
        const rolesSet = new Set();
        const assignmentsMap = {};
        res.data.forEach(item => {
          Object.keys(item.roles || {}).forEach(r => rolesSet.add(r));
          if (Object.keys(item.roles || {}).length > 0) {
            assignmentsMap[item.targetDate] = item.roles;
          }
        });
        setAvailableRoles(Array.from(rolesSet));
        setAssignments(assignmentsMap);
      } catch (err) {
        console.error('Failed to load roles', err);
      }
    };
    fetchRoles();

    const fetchMembers = async () => {
      try {
        const response = await api.get('/members');
        setMembers(response.data);
      } catch (error) {
        console.error('Failed to load members', error);
      }
    };
    fetchMembers();

    // Restore draft if page refreshed
    const savedDraft = localStorage.getItem('ma_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.isModalOpen) {
          setFormData(parsed.formData);
          setEditingId(parsed.editingId);
          setMessageQueue(parsed.messageQueue || []);
          setIsModalOpen(true);
        }
      } catch(e) {}
    }
  }, []);

  // Auto-save draft
  useEffect(() => {
    localStorage.setItem('ma_draft', JSON.stringify({
      isModalOpen, formData, editingId, messageQueue
    }));
  }, [isModalOpen, formData, editingId, messageQueue]);

  // Auto-generate queue for advanced mode
  useEffect(() => {
    if (showAdvanced && formData.message && Object.keys(assignments).length > 0) {
      const queue = generateQueueFromAssignments(assignments, formData.message, formData.codeTemplate);
      setMessageQueue(queue);
    } else if (showAdvanced && !formData.message) {
      setMessageQueue([]);
    }
  }, [showAdvanced, formData.message, formData.codeTemplate, assignments]);

  const handleOpenModal = (mode = 'simple') => {
    setIsModalOpen(true);
    setShowAdvanced(mode === 'dynamic');
    setEditingId(null);
    setFormData({ name: '', targetUrl: '', targetRole: '', message: '', time: '12:00', selectedDays: [], enableCodeBroadcast: false, codeTime: '08:00', codeSelectedDays: [], codeTemplate: 'DFCCI-S-LU-{DATE}' });
    setMessageQueue([]);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', targetUrl: '', targetRole: '', message: '', time: '12:00', selectedDays: [], enableCodeBroadcast: false, codeTime: '08:00', codeSelectedDays: [], codeTemplate: 'DFCCI-S-LU-{DATE}' });
    setMessageQueue([]);
  };

  const handleToggleDay = (dayValue, isCodeSchedule = false) => {
    setFormData(prev => {
      if (isCodeSchedule) {
        return {
          ...prev,
          codeSelectedDays: prev.codeSelectedDays.includes(dayValue)
            ? prev.codeSelectedDays.filter(d => d !== dayValue)
            : [...prev.codeSelectedDays, dayValue]
        };
      }
      return {
        ...prev,
        selectedDays: prev.selectedDays.includes(dayValue)
          ? prev.selectedDays.filter(d => d !== dayValue)
          : [...prev.selectedDays, dayValue]
      };
    });
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
    let daysStr = '';
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
        const testDate = new Date(Date.now());
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
    } catch (err) {
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
    const codeScheduleForm = schedule.codeCronTime ? parseUTCCronToFormValues(schedule.codeCronTime) : { time: '08:00', selectedDays: [] };
    
    setEditingId(schedule._id);
    setFormData({
      name: schedule.scheduleName,
      targetUrl: schedule.chatUrl || '',
      targetRole: schedule.targetRole || '',
      message: schedule.message,
      time,
      selectedDays,
      enableCodeBroadcast: schedule.enableCodeBroadcast || false,
      codeTime: codeScheduleForm.time,
      codeSelectedDays: codeScheduleForm.selectedDays,
      codeTemplate: schedule.codeTemplate || 'DFCCI-S-LU-{DATE}'
    });
    setMessageQueue(schedule.messageQueue || []);
    setShowAdvanced((schedule.messageQueue && schedule.messageQueue.length > 0));
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.selectedDays.length === 0) {
      if (showAlert) showAlert('Validation Error', 'Please select at least one day for the schedule.');
      return;
    }

    const cronString = convertLocalTimeToUTCCron(formData.time, formData.selectedDays);
    let codeCronString = '';
    
    if (formData.enableCodeBroadcast) {
      if (formData.codeSelectedDays.length === 0) {
        if (showAlert) showAlert('Validation Error', 'Please select at least one day for the Confirmation Code broadcast.');
        return;
      }
      codeCronString = convertLocalTimeToUTCCron(formData.codeTime, formData.codeSelectedDays);
    }
    
    const payload = {
      scheduleName: formData.name,
      cronTime: cronString,
      codeCronTime: codeCronString,
      enableCodeBroadcast: formData.enableCodeBroadcast,
      codeTemplate: formData.codeTemplate,
      chatUrl: formData.targetUrl,
      targetRole: showAdvanced ? formData.targetRole : '',
      message: formData.message,
      messageQueue: messageQueue
    };

    try {
      if (editingId) {
        const response = await api.put(`/automation/schedule/${editingId}`, payload);
        const updatedSchedule = response.data.data;
        const currentSchedules = Array.isArray(schedules) ? schedules : [];
        setSchedules(currentSchedules.map(s => s._id === editingId ? updatedSchedule : s));
      } else {
        const response = await api.post('/automation/schedule', payload);
        const newSchedule = response.data.data;
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
          await api.delete(`/automation/schedule/${id}`);
          setSchedules(schedules.filter(s => s._id !== id));
        } catch (error) {
          console.error('Failed to delete schedule', error);
          if (showAlert) showAlert('Error', 'Failed to delete schedule.');
        }
      }
    );
  };

  return (
    <div className="container" style={{ maxWidth: '1100px', padding: isMobile ? '0.5rem 0.35rem 5rem' : '1rem 0.5rem' }}>
      
      {/* ── Back Button & Help ── */}
      <div style={{ marginBottom: isMobile ? '0.4rem' : '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/dashboard')} className="back-btn" style={{ padding: isMobile ? '0.3rem 0.6rem' : '0.4rem 0.8rem', fontSize: isMobile ? '0.78rem' : '0.85rem' }}>
          <ChevronLeft size={isMobile ? 15 : 18} /> Back
        </button>
        <Link to="/docs/automation-hub" className="back-btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem', padding: isMobile ? '0.3rem 0.6rem' : '0.4rem 0.8rem', fontSize: isMobile ? '0.78rem' : '0.85rem' }} title="Help & Documentation">
          <BookOpen size={isMobile ? 14 : 16} /> Docs
        </Link>
      </div>

      {/* ── Header Row ── */}
      <div style={{ marginBottom: isMobile ? '0.85rem' : '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.15rem' }}>
        <h1 className="text-gradient text-hero" style={{ fontSize: isMobile ? '1.4rem' : '1.75rem', margin: 0, lineHeight: 1.1, textAlign: 'center' }}>
          Automation Hub
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: isMobile ? '0.75rem' : '0.85rem', margin: 0, textAlign: 'center' }}>
          Manage scheduled group messages and personalized role reminders.
        </p>
      </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => navigate('/automation-hub/calendar')}>
              <Calendar size={18} />
              Serving Calendar
            </button>
            <button className="btn btn-primary" onClick={() => handleOpenModal('simple')}>
              <Plus size={18} />
              Add Schedule
            </button>
          </div>

      {schedules.length === 0 ? (
        <div className="ma-empty-state card">
          <Calendar size={48} style={{ color: 'var(--border-color)' }} />
          <h3>No reminders scheduled</h3>
          <p>Create your first automated reminder to keep the community engaged.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => handleOpenModal('simple')}>
               <Plus size={18} /> Create Schedule
            </button>
          </div>
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
              <h3>{editingId ? 'Edit Schedule' : 'Create Schedule'}</h3>
              <button onClick={handleCloseModal} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
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
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Schedule Type</label>
                  <select
                    className="form-input"
                    value={showAdvanced ? 'dynamic' : 'simple'}
                    onChange={(e) => {
                      setShowAdvanced(e.target.value === 'dynamic');
                      setFormData(prev => ({...prev, targetUrl: '', targetRole: ''}));
                    }}
                    style={{ appearance: 'auto' }}
                  >
                    <option value="simple">Specific Contact</option>
                    <option value="dynamic">Specific Role</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {showAdvanced ? (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <LinkIcon size={16} /> Target Role
                  </label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="form-input"
                      value={formData.targetRole}
                      onChange={(e) => setFormData({...formData, targetRole: e.target.value})}
                      required
                      style={{ appearance: 'auto' }}
                    >
                      <option value="">Select Target Role</option>
                      {availableRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <LinkIcon size={16} /> Target Chat URL
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="url" 
                      className="form-input" 
                      placeholder="https://m.me/j/..."
                      value={formData.targetUrl}
                      onChange={(e) => setFormData({...formData, targetUrl: e.target.value})}
                      required 
                    />
                  </div>
                </div>
              )}          </div>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 2fr', gap: '1rem', alignItems: 'end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Time (Local)</label>
                  <input 
                    type="time" 
                    className="form-input" 
                    style={{ width: '100%' }}
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required 
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
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
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Message Content</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Write your automated message here. Use {Role} to dynamically replace names if you upload an Excel sheet (e.g., {Presider})"
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required 
                />
              </div>



              <div className="ma-modal-actions" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
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
                    currentSchedule={schedules.find(s => s._id === queueEditingId)}
                  />
                  <QueueList 
                    title="Archived (Past Dates)"
                    items={queueToView.filter(q => new Date(q.targetDate) < new Date(new Date().setHours(0,0,0,0))).reverse()}
                    queueEditingId={queueEditingId}
                    setQueueToView={setQueueToView}
                    queueToView={queueToView}
                    showAlert={showAlert}
                    setSchedules={setSchedules}
                    currentSchedule={schedules.find(s => s._id === queueEditingId)}
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
          bottom: '96px', 
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
                          showAlert('Copied', 'Active code copied to clipboard!');
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

      {/* Floating Action Button for Member Directory */}
      <button 
        onClick={() => setShowMembersModal(true)}
        style={{ 
          position: 'fixed', 
          bottom: '24px', 
          right: '24px', 
          width: '56px', 
          height: '56px', 
          borderRadius: '50%', 
          background: 'var(--primary-color, var(--primary))', 
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
        title="Member Directory"
      >
        <List size={24} />
      </button>

      {/* Member Directory Modal Overlay */}
      {showMembersModal && createPortal(
        <div className="ma-modal-overlay" style={{ zIndex: 1000 }} onClick={() => setShowMembersModal(false)}>
          <div className="card ma-modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <List size={22} className="text-primary" />
                Member Directory
              </h3>
              <button onClick={() => setShowMembersModal(false)} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '1rem 0' }}>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 1.5rem 0', fontSize: '0.9rem', padding: '0 1rem' }}>
                Map the exact names from your Excel schedules to their private Facebook Chat URLs.
              </p>
              <MemberDirectory showAlert={showAlert} showConfirm={showConfirm} />
            </div>
          </div>
        </div>,
        document.body
      )}
      
      <PopupModal 
        isOpen={popup.isOpen}
        onClose={() => setPopup({ ...popup, isOpen: false })}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        isAlert={popup.isAlert}
      />
    </div>
  );
}

function QueueList({ items, title, queueEditingId, setQueueToView, queueToView, showAlert, setSchedules, currentSchedule }) {
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
                  {currentSchedule?.targetRole && q.parsedRoles && q.parsedRoles[currentSchedule.targetRole] && (
                    <span style={{ marginLeft: '10px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
                      - To: <strong>{q.parsedRoles[currentSchedule.targetRole]}</strong> ({currentSchedule.targetRole})
                    </span>
                  )}
                </span>
                {q.isSent ? (
                  <span style={{ fontSize: '0.75rem', background: 'var(--success-color)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>Sent</span>
                ) : new Date(q.targetDate) < new Date(new Date().setHours(0,0,0,0)) ? (
                  <span style={{ fontSize: '0.75rem', background: 'var(--bg-secondary)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>Archived</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', background: 'var(--warning-color)', color: '#000', padding: '2px 6px', borderRadius: '4px' }}>Pending</span>
                )}
              </div>
              
              <div style={{ marginBottom: '0.5rem' }}>
                <input
                  type="url"
                  placeholder="Override Target Chat URL (Optional)"
                  style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-main)', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                  value={q.overrideChatUrl || ''}
                  onChange={(e) => {
                    const newQueue = [...queueToView];
                    newQueue[mainIdx].overrideChatUrl = e.target.value;
                    setQueueToView(newQueue);
                  }}
                />
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
                      await api.patch(`/automation/schedule/${queueEditingId}/queue`, {
                        targetDate: q.targetDate,
                        messageText: q.messageText,
                        overrideChatUrl: q.overrideChatUrl
                      });
                      if (showAlert) showAlert('Success', 'Queue item updated successfully!');
                      setSchedules(prev => prev.map(s => {
                        if (s._id === queueEditingId) {
                          const updatedQueue = [...(s.messageQueue || [])];
                          if (mainIdx > -1) {
                            updatedQueue[mainIdx].messageText = q.messageText;
                            updatedQueue[mainIdx].overrideChatUrl = q.overrideChatUrl;
                          }
                          return { ...s, messageQueue: updatedQueue };
                        }
                        return s;
                      }));
                    } catch (err) {
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
