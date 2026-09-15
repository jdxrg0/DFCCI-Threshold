import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Upload, Plus, X, Save, UserCheck, BookOpen, Trash2, MessageCircle, Download } from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays 
} from 'date-fns';
import { Link } from 'react-router-dom';
import * as calendar from '../services/calendar';
import * as users from '../services/users';
import { parseExcelSchedule, downloadExcelTemplate } from '../utils/excelParser';
import PopupModal from '../components/PopupModal';
import MemberDirectory from '../components/MemberDirectory'; // Reusing MemberDirectory
import { createPortal } from 'react-dom';
import PageHeader from '../components/PageHeader';

export default function ServingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState({}); // { 'YYYY-MM-DD': { 'RoleName': 'MemberName' } }
  const [membersMap, setMembersMap] = useState({}); // { 'MemberName': 'facebookChatUrl' }
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // Date selection for modal
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [editingRoles, setEditingRoles] = useState({});
  const [newRoleName, setNewRoleName] = useState('');
  
  // Member picking
  const [pickingRole, setPickingRole] = useState(null);
  
  // Excel Import selection
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [parsedExcelData, setParsedExcelData] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [selectedRolesToImport, setSelectedRolesToImport] = useState({});
  
  
  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', isAlert: false });
  const [confirmPopup, setConfirmPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const showAlert = useCallback((title, message) => setPopup({ isOpen: true, title, message, isAlert: true }), []);
  
  const [holdProgress, setHoldProgress] = useState(0);
  const holdIntervalRef = React.useRef(null);

  const startHold = () => {
    setHoldProgress(0);
    const totalTime = 1200; // 1.2 seconds hold
    const intervalTime = 50;
    let currentProgress = 0;

    holdIntervalRef.current = setInterval(() => {
      currentProgress += (intervalTime / totalTime) * 100;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(holdIntervalRef.current);
        // Using a ref to get latest confirmPopup.onConfirm would be better, but we can just use setConfirmPopup callback form or rely on closure. Wait, closure has old confirmPopup.
        // Actually, we can use the state since it's just one modal at a time.
        // To be safe, we'll invoke it.
        setConfirmPopup(prev => {
          if (prev.onConfirm) prev.onConfirm();
          return prev;
        });
      }
      setHoldProgress(currentProgress);
    }, intervalTime);
  };

  const cancelHold = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  useEffect(() => {
    if (!confirmPopup.isOpen) {
      const timer = setTimeout(() => {
        if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
        setHoldProgress(0);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [confirmPopup.isOpen]);


  const fetchData = useCallback(async () => {
    try {
      const [calData, memData] = await Promise.all([
        calendar.getCalendar(),
        users.listMembers()
      ]);
      
      const formatted = {};
      calData.forEach(item => {
        formatted[item.targetDate] = item.roles || {};
      });
      
      const mMap = {};
      memData.forEach(m => {
        mMap[m.name.toLowerCase()] = m.facebookChatUrl;
      });

      setMembersMap(mMap);
      setAssignments(formatted);
      setLoading(false);
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to fetch calendar data.');
      setLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    const t = setTimeout(() => fetchData(), 0);
    return () => clearTimeout(t);
  }, [fetchData]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleDayClick = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    setSelectedDate(day);
    setEditingRoles(assignments[dateKey] ? { ...assignments[dateKey] } : {});
    setIsDayModalOpen(true);
    setPickingRole(null);
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) return;
    setEditingRoles(prev => ({ ...prev, [newRoleName.trim()]: '' }));
    setNewRoleName('');
  };

  const handleRemoveRole = (role) => {
    const updated = { ...editingRoles };
    delete updated[role];
    setEditingRoles(updated);
  };

  const handleSaveDay = async () => {
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    try {
      await calendar.saveDateRoles(dateKey, { roles: editingRoles });
      setAssignments(prev => ({ ...prev, [dateKey]: editingRoles }));
      setIsDayModalOpen(false);
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to save assignments for this date.');
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const parsed = await parseExcelSchedule(file);
      
      const rolesSet = new Set();
      Object.values(parsed).forEach(dayRoles => {
        Object.keys(dayRoles).forEach(role => rolesSet.add(role));
      });
      
      const rolesArray = Array.from(rolesSet).sort();
      
      if (rolesArray.length === 0) {
        showAlert('Notice', 'No roles found in the Excel file.');
        setIsUploading(false);
        e.target.value = null;
        return;
      }
      
      const initialSelection = {};
      rolesArray.forEach(r => initialSelection[r] = true);
      
      setAvailableRoles(rolesArray);
      setSelectedRolesToImport(initialSelection);
      setParsedExcelData(parsed);
      setImportModalOpen(true);
      
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to parse Excel file.');
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const handleConfirmImport = async () => {
    setImportModalOpen(false);
    setIsUploading(true);
    try {
      const filteredAssignments = {};
      Object.keys(parsedExcelData).forEach(date => {
        const dayRoles = parsedExcelData[date];
        const filteredRoles = {};
        Object.keys(dayRoles).forEach(role => {
          if (selectedRolesToImport[role]) {
            filteredRoles[role] = dayRoles[role];
          }
        });
        if (Object.keys(filteredRoles).length > 0) {
          filteredAssignments[date] = filteredRoles;
        }
      });

      await calendar.populateCalendar({ assignments: filteredAssignments });
      showAlert('Success', 'Selected roles successfully imported to the calendar!');
      fetchData();
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Failed to upload filtered Excel data.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearCalendar = async () => {
    setConfirmPopup({
      isOpen: true,
      title: 'Clear Calendar',
      message: 'Are you sure you want to clear the entire Serving Calendar? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmPopup({ ...confirmPopup, isOpen: false });
        try {
          setLoading(true);
          await calendar.clearCalendar();
          showAlert('Success', 'Calendar cleared successfully.');
          setAssignments({});
        } catch (err) {
          console.error(err);
          showAlert('Error', 'Failed to clear calendar.');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const renderHeader = () => {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <button className="ma-icon-btn" onClick={handlePrevMonth}><ChevronLeft /></button>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-main)' }}>
          {format(currentDate, 'MMMM yyyy')}
        </h2>
        <button className="ma-icon-btn" onClick={handleNextMonth}><ChevronRight /></button>
      </div>
    );
  };

  const renderDays = () => {
    const days = [];
    const startDate = startOfWeek(currentDate);
    for (let i = 0; i < 7; i++) {
      days.push(
        <div key={i} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {format(addDays(startDate, i), 'EEEEEE')}
        </div>
      );
    }
    return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>{days}</div>;
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, 'd');
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayRoles = assignments[dateKey] || {};
        const roleCount = Object.keys(dayRoles).length;
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, new Date());
        
        const cloneDay = day;
        
        days.push(
          <div 
            key={day}
            onClick={() => handleDayClick(cloneDay)}
            style={{
              padding: '0.5rem',
              minHeight: '100px',
              border: '1px solid var(--border-color)',
              background: isToday ? 'var(--primary-glow)' : (isCurrentMonth ? 'var(--bg-main)' : 'var(--bg-secondary)'),
              opacity: isCurrentMonth ? 1 : 0.5,
              cursor: 'pointer',
              transition: 'background 0.2s',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem'
            }}
            className="ma-calendar-cell"
          >
            <div style={{ textAlign: 'right', fontWeight: isToday ? 'bold' : 'normal', color: isToday ? 'var(--primary)' : 'var(--text-main)' }}>
              {formattedDate}
            </div>
            {roleCount > 0 && (
              <div style={{ fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', marginTop: '0.2rem' }}>
                {Object.entries(dayRoles).slice(0, 3).map(([role, person]) => {
                  const chatUrl = person ? membersMap[person.toLowerCase()] : null;
                  return (
                    <div key={role} style={{ background: 'var(--surface)', padding: '0.15rem 0.3rem', borderRadius: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '0.25rem' }} title={`${role}: ${person}`}>
                      <strong>{role}</strong>: {person || 'Unassigned'}
                      {chatUrl && (
                        <a href={chatUrl} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
                          <MessageCircle size={10} />
                        </a>
                      )}
                    </div>
                  );
                })}
                {roleCount > 3 && (
                  <div style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.65rem' }}>
                    +{roleCount - 3} more
                  </div>
                )}
              </div>
            )}
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(<div key={day} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>{days}</div>);
      days = [];
    }
    return <div>{rows}</div>;
  };

  return (
    <div className="container" style={{ maxWidth: '1100px', padding: '1rem 0.5rem 5rem' }}>
      <PageHeader
        icon={CalendarIcon}
        title="Serving Calendar"
        subtitle="Manage your schedule and assign members to roles for dynamic automation."
        actions={
          <Link to="/docs/automation-hub" className="btn btn-secondary page-header-btn-icon" title="Help & Documentation">
            <BookOpen size={18} />
          </Link>
        }
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
        <button className="btn btn-secondary" onClick={downloadExcelTemplate} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Download size={18} />
          Download Template
        </button>
        <button className="btn btn-secondary text-danger" onClick={handleClearCalendar} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Trash2 size={18} />
          Clear Calendar
        </button>
        <label className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
          <Upload size={18} />
          {isUploading ? 'Uploading...' : 'Upload Excel Schedule'}
          <input 
            type="file" 
            accept=".xlsx, .xls"
            onChange={handleExcelUpload}
            style={{ display: 'none' }}
            disabled={isUploading}
          />
        </label>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading Calendar...</div>
      ) : (
        <div className="card" style={{ padding: '1rem' }}>
          {renderHeader()}
          {renderDays()}
          {renderCells()}
        </div>
      )}

      {/* Day Edit Modal */}
      {isDayModalOpen && createPortal(
        <div className="ma-modal-overlay">
          <div className="card ma-modal-content" style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={20} className="text-primary" />
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
              <button onClick={() => setIsDayModalOpen(false)} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            
            <div style={{ padding: '1.25rem', flex: 1, overflowY: 'auto' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                Assign members from your directory to specific roles for this date.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {Object.keys(editingRoles).length === 0 && (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                    No roles assigned for this date yet.
                  </div>
                )}
                {Object.keys(editingRoles).map(role => {
                  const person = editingRoles[role];
                  const chatUrl = person ? membersMap[person.toLowerCase()] : null;
                  return (
                  <div key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ width: '120px', fontWeight: 'bold', fontSize: '0.9rem', color: 'var(--text-main)' }}>{role}</div>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem', background: 'var(--bg-main)', paddingRight: chatUrl ? '30px' : '0.4rem' }}
                        value={person}
                        onChange={(e) => setEditingRoles({...editingRoles, [role]: e.target.value})}
                        placeholder="Type name or select from directory ->"
                      />
                      {chatUrl && (
                        <a href={chatUrl} target="_blank" rel="noreferrer" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', display: 'flex' }} title="Open Messenger">
                          <MessageCircle size={16} />
                        </a>
                      )}
                    </div>
                    <button 
                      className="btn btn-secondary" 
                      style={{ padding: '0.4rem', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      title="Select Member from Directory"
                      onClick={() => setPickingRole(role)}
                    >
                      <UserCheck size={16} />
                    </button>
                    <button 
                      className="ma-icon-btn text-danger" 
                      style={{ padding: '0.4rem' }}
                      onClick={() => handleRemoveRole(role)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )})}
              </div>

              {/* Add New Role */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="New Role (e.g. Speaker)"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddRole()}
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAddRole}>
                  <Plus size={18} /> Add Role
                </button>
              </div>
            </div>

            <div className="ma-modal-actions" style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsDayModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveDay} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Save size={16} /> Save Assignments
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Member Picker Overlay */}
      {pickingRole && createPortal(
        <div className="ma-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="card ma-modal-content" style={{ maxWidth: '800px', height: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3>Select Member for '{pickingRole}'</h3>
              <button onClick={() => setPickingRole(null)} className="ma-icon-btn"><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                Click a member's name below to automatically assign them to this role.
              </p>
              <MemberDirectory 
                showAlert={showAlert} 
                showConfirm={() => {}} 
                onSelectMember={(member) => {
                  setEditingRoles(prev => ({ ...prev, [pickingRole]: member.name }));
                  setPickingRole(null);
                }}
              />
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
        isAlert={popup.isAlert}
      />

      {confirmPopup.isOpen && createPortal(
        <div className="ma-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="card ma-modal-content" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color, #ef4444)' }}>
                {confirmPopup.title}
              </h3>
              <button onClick={() => setConfirmPopup({ ...confirmPopup, isOpen: false })} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.25rem', flex: 1 }}>
              <p style={{ color: 'var(--text-main)', fontSize: '0.95rem', margin: 0 }}>
                {confirmPopup.message}
              </p>
            </div>
            <div className="ma-modal-actions" style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmPopup({ ...confirmPopup, isOpen: false })}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                style={{ 
                  background: 'var(--danger-color, #ef4444)', 
                  borderColor: 'var(--danger-color, #ef4444)',
                  position: 'relative',
                  overflow: 'hidden',
                  userSelect: 'none'
                }} 
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
              >
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, height: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  width: `${holdProgress}%`,
                  transition: 'width 0.05s linear'
                }} />
                <span style={{ position: 'relative', zIndex: 1 }}>Hold to Confirm</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {importModalOpen && createPortal(
        <div className="ma-modal-overlay" style={{ zIndex: 10000 }}>
          <div className="card ma-modal-content" style={{ maxWidth: '500px', display: 'flex', flexDirection: 'column', padding: 0 }} onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header" style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
              <h3>Select Roles to Import</h3>
              <button onClick={() => setImportModalOpen(false)} className="ma-icon-btn">
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.25rem', flex: 1, maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                We found the following roles in your Excel file. Uncheck any roles you do NOT want to import into the Serving Calendar.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => {
                    const allTrue = {}; availableRoles.forEach(r => allTrue[r] = true); setSelectedRolesToImport(allTrue);
                  }}>Select All</button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }} onClick={() => {
                    const allFalse = {}; availableRoles.forEach(r => allFalse[r] = false); setSelectedRolesToImport(allFalse);
                  }}>Deselect All</button>
                </div>
                {availableRoles.map(role => (
                  <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', cursor: 'pointer', border: '1px solid var(--border-color)' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedRolesToImport[role] || false}
                      onChange={(e) => setSelectedRolesToImport({ ...selectedRolesToImport, [role]: e.target.checked })}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '500' }}>{role}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="ma-modal-actions" style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setImportModalOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmImport} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Upload size={16} /> Import Selected
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .ma-calendar-cell:hover {
          filter: brightness(1.05);
        }
      `}} />
    </div>
  );
}
