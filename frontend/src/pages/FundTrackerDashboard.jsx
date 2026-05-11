import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import { BookOpen, Copy, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// Helper: Get all Sundays for a given month and year
function getSundays(year, month) {
  const d = new Date(year, month, 1);
  const sundays = [];
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // First Sunday
  while (d.getMonth() === month) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

// Helper: Format Date to local YYYY-MM-DD to avoid timezone shifts
function getLocalYMD(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const inputStyle = {
  width: '100%', background: 'var(--bg-color)', border: '1px solid var(--border-color)',
  color: 'var(--text-main)', borderRadius: 'var(--radius)', padding: '0.6rem 0.85rem', boxSizing: 'border-box', fontSize: '1rem',
};
const selectStyle = {
  background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-main)',
  borderRadius: 'var(--radius)', padding: '0.5rem 0.75rem', fontSize: '0.95rem',
};
const labelStyle = { display: 'block', fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-main)', marginBottom: '0.4rem' };
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function FundTrackerDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'YOUTH_TREASURER';

  const [activeTab, setActiveTab] = useState('overview');

  // ── Overview state ──
  const [summary, setSummary] = useState({ totalIncome: 0, totalExpense: 0, currentBalance: 0 });
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [customCategory, setCustomCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null); // { original, draft }
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [formData, setFormData] = useState({ amount: '', type: 'INCOME', category: '', description: '', date: new Date().toISOString().slice(0, 10) });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageCache = useRef({});
  const [showFellowshipForm, setShowFellowshipForm] = useState(false);
  const [fellowshipData, setFellowshipData] = useState({ eventName: '', fee: 30, date: new Date().toISOString().slice(0, 10), participants: [], customParticipants: '' });

  // ── Dues Ledger state ──
  const [ledgerYear, setLedgerYear] = useState(new Date().getFullYear());
  const [ledgerMonth, setLedgerMonth] = useState(new Date().getMonth());
  const [ledgerData, setLedgerData] = useState({ members: [], payments: [] });
  const [loadingDues, setLoadingDues] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [showRoster, setShowRoster] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { memberId, dateStr, value }

  // ── Link User Modal state ──
  const [linkModal, setLinkModal] = useState({ isOpen: false, member: null });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null); // memberId being emailed
  const userSearchTimer = useRef(null);

  // ── Custom Modal States ──
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '' });

  const showAlert = (title, message) => setAlertDialog({ isOpen: true, title, message });
  const showConfirm = (title, message, onConfirm) => setConfirmDialog({ isOpen: true, title, message, onConfirm });

  const fmt = (n) => `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // ── Fetchers ──
  // Builds URLSearchParams for the current month/year filter + a given page
  const buildTxParams = useCallback((page) => {
    const p = new URLSearchParams();
    if (month) p.append('month', month);
    if (year) p.append('year', year);
    p.append('page', page);
    p.append('limit', 10);
    return p.toString();
  }, [month, year]);

  const fetchOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      pageCache.current = {};   // Clear cache on fresh load / filter change
      setCurrentPage(1);

      const [sumRes, catRes, r1, r2, r3] = await Promise.all([
        api.get('/funds/summary'),
        api.get('/funds/categories'),
        api.get(`/funds?${buildTxParams(1)}`),
        api.get(`/funds?${buildTxParams(2)}`).catch(() => null),
        api.get(`/funds?${buildTxParams(3)}`).catch(() => null),
      ]);

      setSummary(sumRes.data);
      setCategories(catRes.data);

      const tp = r1.data.totalPages;
      setTotalPages(tp);
      setTransactions(r1.data.transactions);

      // Cache all 3 prefetched pages
      const ck = (p) => `${month}-${year}-${p}`;
      pageCache.current[ck(1)] = r1.data.transactions;
      if (r2?.data?.transactions?.length) pageCache.current[ck(2)] = r2.data.transactions;
      if (r3?.data?.transactions?.length) pageCache.current[ck(3)] = r3.data.transactions;
    } catch (err) { console.error(err); }
    finally { setLoadingOverview(false); }
  }, [month, year, buildTxParams]);

  const goToPage = useCallback(async (page) => {
    const key = `${month}-${year}-${page}`;
    if (pageCache.current[key]) {
      setTransactions(pageCache.current[key]);
      setCurrentPage(page);
      return;
    }
    setLoadingOverview(true);
    try {
      const res = await api.get(`/funds?${buildTxParams(page)}`);
      const { transactions: txs, totalPages: tp } = res.data;
      pageCache.current[key] = txs;
      setTotalPages(tp);
      setTransactions(txs);
      setCurrentPage(page);
    } catch (err) { console.error(err); }
    finally { setLoadingOverview(false); }
  }, [month, year, buildTxParams]);

  // Windowed pagination: always show first, last, current ± 1, fill gaps with ellipsis
  const getPaginationPages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, currentPage]);
    if (currentPage > 1) set.add(currentPage - 1);
    if (currentPage < totalPages) set.add(currentPage + 1);
    return [...set].sort((a, b) => a - b);
  };


  const fetchLedger = useCallback(async () => {
    try {
      setLoadingDues(true);
      const res = await api.get('/funds/dues/ledger');
      setLedgerData(res.data);
    } catch (err) { console.error(err); }
    finally { setLoadingDues(false); }
  }, [isPrivileged]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  // Lock body scroll when any modal is open
  useEffect(() => {
    const anyOpen = showForm || showFellowshipForm || alertDialog.isOpen || confirmDialog.isOpen;
    document.body.style.overflow = anyOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showForm, showFellowshipForm, alertDialog.isOpen, confirmDialog.isOpen]);

  // ── Overview handlers ──
  const handleInput = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      if (value === '__CUSTOM__') {
        setCustomCategory(true);
        setFormData(f => ({ ...f, category: '' }));
      } else {
        setCustomCategory(false);
        setFormData(f => ({ ...f, category: value }));
      }
    } else {
      setFormData(f => ({ ...f, [name]: value }));
    }
  };

  const openForm = (tx = null) => {
    setShowManageCategories(false);
    setEditingCategory(null);
    if (tx) {
      setEditingId(tx._id);
      setFormData({ amount: tx.amount, type: tx.type, category: tx.category, description: tx.description || '', date: new Date(tx.date).toISOString().slice(0, 10) });
      setCustomCategory(!categories.includes(tx.category));
    } else {
      setEditingId(null);
      setFormData({ amount: '', type: 'INCOME', category: categories[0] || '', description: '', date: new Date().toISOString().slice(0, 10) });
      setCustomCategory(categories.length === 0);
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) { await api.put(`/funds/${editingId}`, formData); }
      else { await api.post('/funds', formData); }
      setShowForm(false); fetchOverview();
    } catch (err) { showAlert('Error', 'Failed to save transaction.'); }
  };

  const handleRenameCategory = async () => {
    if (!editingCategory || !editingCategory.draft.trim()) return;
    if (editingCategory.draft.trim() === editingCategory.original) {
      setEditingCategory(null);
      return;
    }
    try {
      await api.patch('/funds/categories/rename', {
        oldName: editingCategory.original,
        newName: editingCategory.draft.trim(),
      });
      // If the form currently uses the renamed category, update it
      if (formData.category === editingCategory.original) {
        setFormData(f => ({ ...f, category: editingCategory.draft.trim() }));
      }
      setEditingCategory(null);
      await fetchOverview();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to rename category.');
    }
  };


  const handleDelete = (id) => {
    showConfirm(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      async () => {
        try { await api.delete(`/funds/${id}`); fetchOverview(); }
        catch (err) { console.error(err); }
      }
    );
  };

  // ── Dues Ledger handlers ──
  const handleCellClick = (memberId, dateStr, currentAmount) => {
    setEditingCell({ memberId, dateStr, value: currentAmount || '' });
  };

  const handleCellBlur = async () => {
    if (!editingCell) return;
    const { memberId, dateStr, value } = editingCell;
    setEditingCell(null); // Optimistic UI close

    try {
      await api.post('/funds/dues/ledger', {
        memberId,
        collectionDate: dateStr,
        amount: value
      });
      fetchLedger();
      fetchOverview(); // Update main balance
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to update payment');
      fetchLedger(); // Revert on failure
    }
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur();
    if (e.key === 'Escape') setEditingCell(null);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setAddError('');
    try {
      await api.post('/funds/dues/members', { name: newMemberName.trim() });
      setNewMemberName('');
      await fetchLedger();
    } catch (err) {
      console.error('Error adding member:', err);
      setAddError(err.response?.data?.message || 'Failed to add member. Please try again.');
    }
  };

  const handleRemoveMember = (id) => {
    showConfirm(
      'Remove Member',
      'Are you sure you want to remove this member from the roster?',
      async () => {
        try { await api.delete(`/funds/dues/members/${id}`); fetchLedger(); }
        catch (err) { console.error(err); }
      }
    );
  };

  // ── Link User handlers ──
  const openLinkModal = (member) => {
    setLinkModal({ isOpen: true, member });
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  const closeLinkModal = () => {
    setLinkModal({ isOpen: false, member: null });
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  useEffect(() => {
    if (!linkModal.isOpen) return;
    clearTimeout(userSearchTimer.current);
    if (!userSearchQuery.trim()) { setUserSearchResults([]); return; }
    userSearchTimer.current = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const res = await api.get(`/users/search?q=${encodeURIComponent(userSearchQuery)}`);
        setUserSearchResults(res.data);
      } catch (err) { console.error(err); }
      finally { setSearchingUsers(false); }
    }, 350);
    return () => clearTimeout(userSearchTimer.current);
  }, [userSearchQuery, linkModal.isOpen]);

  const handleConfirmLink = async (userId) => {
    try {
      await api.put(`/funds/dues/members/${linkModal.member._id}/link-user`, { userId });
      await fetchLedger();
      closeLinkModal();
      showAlert('Linked!', 'User successfully connected to this roster entry.');
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to link user.');
    }
  };

  const handleUnlinkUser = (member) => {
    showConfirm(
      'Unlink User',
      `Disconnect ${member.linkedUser?.displayName} from "${member.name}"?`,
      async () => {
        try {
          await api.put(`/funds/dues/members/${member._id}/link-user`, { userId: null });
          await fetchLedger();
        } catch (err) { console.error(err); }
      }
    );
  };

  const handleSendDuesEmail = async (member) => {
    if (!member.linkedUser) return;
    setSendingEmail(member._id);
    try {
      const res = await api.post(`/funds/dues/members/${member._id}/send-dues-email`);
      showAlert('Email Sent! 📧', res.data.message);
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to send email.');
    } finally {
      setSendingEmail(null);
    }
  };

  const sundays = getSundays(ledgerYear, ledgerMonth);
  const totalCount = ledgerData.members.length;

  const DUES_START_DATE = new Date(2026, 4, 1); // May 1, 2026

  const getSundayIndexSinceStart = (targetDate) => {
    const start = new Date(DUES_START_DATE);
    start.setDate(start.getDate() + ((7 - start.getDay()) % 7)); // First Sunday
    const diffTime = targetDate.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
  };

  const getExpectedDues = () => {
    let expected = 0;
    let current = new Date(DUES_START_DATE);
    const end = new Date(ledgerYear, ledgerMonth + 1, 0); // last day of viewed month
    // Cap the end date to today if we are viewing a future month, or just calculate up to end of month
    // It's better to calculate up to end of viewed month so Treasurer knows what's due
    while (current <= end) {
      if (current.getDay() === 0) expected += 10;
      current.setDate(current.getDate() + 1);
    }
    return expected;
  };

  const expectedDues = getExpectedDues();

  // Helper to get payment amount for a specific cell
  const getPaymentAmount = (memberId, dateStr) => {
    const payment = ledgerData.payments.find(p => {
      // Parse backend date and convert back to local YYYY-MM-DD
      const pDate = new Date(p.collectionDate);
      return p.member === memberId && getLocalYMD(pDate) === dateStr;
    });
    return payment ? payment.amount : 0;
  };

  // Helper to get all-time total for a member
  const handleFellowshipSubmit = async (e) => {
    e.preventDefault();
    
    const customList = fellowshipData.customParticipants
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const totalParticipantsCount = fellowshipData.participants.length + customList.length;

    if (!fellowshipData.eventName.trim() || totalParticipantsCount === 0 || fellowshipData.fee <= 0) {
      showAlert('Error', 'Please fill all fields and select/add at least one participant.');
      return;
    }

    const totalAmount = fellowshipData.fee * totalParticipantsCount;
    
    const rosterNames = fellowshipData.participants.map(id => {
      const m = ledgerData.members.find(mem => mem._id === id);
      return m ? `- ${m.name}` : '';
    }).filter(Boolean);

    const customNames = customList.map(name => `- ${name}`);
    
    const allNames = [...rosterNames, ...customNames].join('\n');
    
    const desc = `Registration fee (₱${fellowshipData.fee} each for ${totalParticipantsCount} participants)\n${allNames}`;

    try {
      const payload = {
        type: 'EXPENSE',
        amount: totalAmount,
        category: fellowshipData.eventName.trim(),
        description: desc,
        date: fellowshipData.date
      };
      await api.post('/funds', payload);
      setShowFellowshipForm(false);
      fetchLedger();
      fetchOverview();
      setFellowshipData({ eventName: '', fee: 30, date: new Date().toISOString().slice(0, 10), participants: [], customParticipants: '' });
      showAlert('Success', 'Youth Fellowship expense added!');
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Failed to add Youth Fellowship expense.');
    }
  };

  const toggleParticipant = (memberId) => {
    setFellowshipData(prev => ({
      ...prev,
      participants: prev.participants.includes(memberId) 
        ? prev.participants.filter(id => id !== memberId)
        : [...prev.participants, memberId]
    }));
  };

  const handleCopyAnnouncement = (tx) => {
    const isIncome = tx.type === 'INCOME';
    const typeLabelUpper = isIncome ? '𝗜𝗡𝗖𝗢𝗠𝗘' : '𝗘𝗫𝗣𝗘𝗡𝗦𝗘𝗦';
    const typeLabelLower = isIncome ? 'income' : 'expenses';
    const currentBal = summary.currentBalance;
    const prevBal = isIncome ? currentBal - tx.amount : currentBal + tx.amount;
    const dateStr = new Date(tx.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });

    const descLines = (tx.description || 'Miscellaneous').split('\n');
    const firstLine = descLines[0];
    const restLines = descLines.slice(1).join('\n');
    
    const formattedDesc = restLines 
      ? `1. ${firstLine}: ₱${tx.amount}\n${restLines}` 
      : `1. ${firstLine}: ₱${tx.amount}`;

    const text = `𝗘𝗩𝗘𝗡𝗧: ${tx.category}
𝗗𝗔𝗧𝗘: ${dateStr}

${typeLabelUpper}:
${formattedDesc}

𝗧𝗢𝗧𝗔𝗟 ${typeLabelUpper}: ₱${tx.amount}

𝗖𝗨𝗥𝗥𝗘𝗡𝗧 𝗬𝗢𝗨𝗧𝗛 𝗙𝗨𝗡𝗗 𝗕𝗔𝗟𝗔𝗡𝗖𝗘:
- Previous balance: ₱${prevBal}
- Total ${typeLabelLower}: ₱${tx.amount}
- Updated Balance: ₱${currentBal}`;

    const copyToClipboardFallback = (textToCopy) => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(textToCopy);
      } else {
        return new Promise((resolve, reject) => {
          const textArea = document.createElement('textarea');
          textArea.value = textToCopy;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          textArea.style.top = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          try {
            document.execCommand('copy');
            textArea.remove();
            resolve();
          } catch (error) {
            textArea.remove();
            reject(error);
          }
        });
      }
    };

    copyToClipboardFallback(text).then(() => {
      showAlert('Success', 'Announcement copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      showAlert('Error', 'Failed to copy announcement. Your browser may not support this feature.');
    });
  };

  const getMemberTotal = (memberId) => {
    return ledgerData.payments
      .filter(p => p.member === memberId)
      .reduce((sum, p) => sum + p.amount, 0);
  };

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '1rem 0.5rem' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{t('fund_dashboard')}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('fund_desc')}</p>
        </div>
        <Link to="/docs/fund-tracker" className="btn btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} title="Help & Documentation">
          <BookOpen size={20} />
        </Link>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        <div className="card" style={{ textAlign: 'center', padding: '0.75rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('current_balance')}</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: summary.currentBalance >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(summary.currentBalance)}</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '0.75rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('total_income')}</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#22c55e' }}>+{fmt(summary.totalIncome)}</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '0.75rem' }}>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('total_expense')}</p>
          <p style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ef4444' }}>-{fmt(summary.totalExpense)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '2px solid var(--border-color)' }}>
        {['overview', 'dues'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: 'none', border: 'none', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: activeTab === tab ? 'var(--primary)' : 'var(--text-muted)', borderBottom: activeTab === tab ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: '-2px', transition: 'color 0.2s' }}>
            {tab === 'overview' ? t('overview_tab') : t('weekly_dues_tab')}
          </button>
        ))}
      </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="card">
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>{t('recent_transactions')}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  <select value={month} onChange={e => setMonth(e.target.value)} style={selectStyle}>
                    <option value="">{t('all_months')}</option>
                    {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                  <select value={year} onChange={e => setYear(e.target.value)} style={selectStyle}>
                    <option value="">{t('all_years')}</option>
                    {[new Date().getFullYear(), new Date().getFullYear()-1].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  {isPrivileged && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => setShowFellowshipForm(true)} className="btn btn-secondary" style={{ fontSize: '0.85rem' }}>+ Fellowship Exp.</button>
                      <button onClick={() => openForm()} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>+ {t('add_transaction')}</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="hide-on-mobile" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {[t('date'), t('type'), t('category'), t('description'), t('amount'), 'Actions'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found.</td></tr>
                    ) : transactions.map(tx => (
                      <tr key={tx._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(tx.date).toLocaleDateString()}</td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <span style={{ padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600', background: tx.type === 'INCOME' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: tx.type === 'INCOME' ? '#22c55e' : '#ef4444' }}>
                            {tx.type === 'INCOME' ? t('income') : t('expense')}
                          </span>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-main)' }}>{tx.category}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{tx.description || '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '600', color: tx.type === 'INCOME' ? '#22c55e' : '#ef4444' }}>{tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.amount)}</td>
                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                          {tx.description?.startsWith('Registration fee') && isPrivileged && (
                            <button onClick={() => handleCopyAnnouncement(tx)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', marginRight: '0.75rem', fontSize: '0.8rem' }} title="Copy Announcement"><Copy size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }}/> Copy</button>
                          )}
                          {isPrivileged ? (
                            <>
                              <button onClick={() => openForm(tx)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', marginRight: '0.75rem', fontSize: '0.8rem' }}>{t('edit')}</button>
                              <button onClick={() => handleDelete(tx._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem' }}>{t('delete')}</button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="show-on-mobile" style={{ flexDirection: 'column', gap: '0.4rem' }}>
                {transactions.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transactions found.
                  </div>
                ) : transactions.map(tx => (
                  <div key={tx._id} style={{ padding: '0.5rem 0.6rem', background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.85rem', lineHeight: '1.2' }}>{tx.category}</span>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(tx.date).toLocaleDateString()}</span>
                          <span style={{ padding: '0.05rem 0.3rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 'bold', background: tx.type === 'INCOME' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: tx.type === 'INCOME' ? '#22c55e' : '#ef4444' }}>
                            {tx.type === 'INCOME' ? t('income') : t('expense')}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: tx.type === 'INCOME' ? '#22c55e' : '#ef4444', lineHeight: '1.2' }}>
                          {tx.type === 'INCOME' ? '+' : '-'}{fmt(tx.amount)}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {tx.description?.startsWith('Registration fee') && isPrivileged && (
                            <button onClick={() => handleCopyAnnouncement(tx)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }} title="Copy Announcement"><Copy size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '2px' }}/> Copy</button>
                          )}
                          {isPrivileged && (
                            <>
                              <button onClick={() => openForm(tx)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>{t('edit')}</button>
                              <button onClick={() => handleDelete(tx._id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: '600', cursor: 'pointer', fontSize: '0.7rem', padding: 0 }}>{t('delete')}</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {tx.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', padding: '0.25rem 0.4rem', background: 'var(--bg-color)', borderRadius: '2px', lineHeight: '1.3', whiteSpace: 'pre-wrap' }}>
                        {tx.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Shared Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem', paddingTop: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-main)', borderRadius: '6px', padding: '0.3rem 0.65rem', cursor: currentPage === 1 ? 'default' : 'pointer', fontSize: '0.9rem', opacity: currentPage === 1 ? 0.4 : 1 }}
                  >‹</button>

                  {getPaginationPages().map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0 0.1rem' }}>…</span>
                      )}
                      <button
                        onClick={() => goToPage(p)}
                        style={{
                          background: currentPage === p ? 'var(--primary)' : 'none',
                          color: currentPage === p ? 'white' : 'var(--text-muted)',
                          border: '1px solid ' + (currentPage === p ? 'var(--primary)' : 'var(--border-color)'),
                          borderRadius: '6px',
                          padding: '0.3rem 0.65rem',
                          cursor: 'pointer',
                          fontWeight: currentPage === p ? '700' : '400',
                          fontSize: '0.85rem',
                          minWidth: '2rem',
                        }}
                      >{p}</button>
                    </React.Fragment>
                  ))}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{ background: 'none', border: '1px solid var(--border-color)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-main)', borderRadius: '6px', padding: '0.3rem 0.65rem', cursor: currentPage === totalPages ? 'default' : 'pointer', fontSize: '0.9rem', opacity: currentPage === totalPages ? 0.4 : 1 }}
                  >›</button>

                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.25rem' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
              )}
            </div>
          )}


          {/* ── WEEKLY DUES LEDGER TAB ── */}
          {activeTab === 'dues' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* Ledger Matrix */}
              <div className="card" style={{ padding: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    <button 
                      onClick={() => {
                        let y = ledgerYear; let m = ledgerMonth - 1;
                        if (m < 0) { m = 11; y -= 1; }
                        setLedgerMonth(m); setLedgerYear(y);
                      }} 
                      className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}>‹
                    </button>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)', fontSize: '0.9rem', minWidth: '90px', textAlign: 'center' }}>
                      {MONTHS[ledgerMonth]} {ledgerYear}
                    </span>
                    <button 
                      onClick={() => {
                        let y = ledgerYear; let m = ledgerMonth + 1;
                        if (m > 11) { m = 0; y += 1; }
                        setLedgerMonth(m); setLedgerYear(y);
                      }} 
                      className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}>›
                    </button>
                  </div>
                  {isPrivileged && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any cell to edit amount</span>}
                </div>

                {loadingDues ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>{t('loading')}</p>
                ) : ledgerData.members.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>{t('no_roster')}</p>
                ) : (
                  <div style={{ overflowX: 'auto', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', WebkitOverflowScrolling: 'touch' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-color)', borderBottom: '2px solid var(--border-color)' }}>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'left', color: 'var(--text-main)', fontWeight: 'bold', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 2, boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>{t('member_name')}</th>
                          {sundays.map((date, i) => (
                            <th key={i} style={{ padding: '0.4rem 0.2rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.7rem', borderLeft: '1px solid var(--border-color)', minWidth: '35px' }}>
                              {date.getDate()}
                            </th>
                          ))}
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--text-main)', fontWeight: 'bold', borderLeft: '2px solid var(--border-color)' }}>TOTAL</th>
                          <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--text-main)', fontWeight: 'bold' }}>STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.members.map(m => {
                          const totalPaid = getMemberTotal(m._id);
                          const coveredSundays = Math.floor(totalPaid / 10);
                          
                          return (
                          <tr key={m._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.4rem 0.5rem', color: 'var(--text-main)', fontWeight: '500', position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1, boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>
                              {m.name}
                            </td>
                            {sundays.map((date, i) => {
                              const dateStr = getLocalYMD(date);
                              const isEditing = editingCell?.memberId === m._id && editingCell?.dateStr === dateStr;
                              const amt = getPaymentAmount(m._id, dateStr);
                              const sundayIndex = getSundayIndexSinceStart(date);
                              const isCovered = sundayIndex > 0 && sundayIndex <= coveredSundays;
                              
                              let bg = 'transparent';
                              if (isEditing) {
                                bg = 'var(--bg-color)';
                              } else if (isCovered) {
                                bg = amt > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.06)';
                              }

                              return (
                                <td 
                                  key={i} 
                                  onClick={() => isPrivileged && !isEditing && handleCellClick(m._id, dateStr, amt)}
                                  style={{ 
                                    padding: '0.1rem', 
                                    textAlign: 'center', 
                                    borderLeft: '1px solid var(--border-color)',
                                    cursor: (isPrivileged && !isEditing) ? 'pointer' : 'default',
                                    background: bg,
                                    minWidth: '40px'
                                  }}
                                >
                                  {isEditing ? (
                                    <input 
                                      autoFocus
                                      type="number"
                                      min="0"
                                      style={{ width: '100%', minWidth: '40px', background: 'var(--bg-color)', border: '1px solid var(--primary)', color: 'var(--text-main)', padding: '0.2rem', borderRadius: '2px', textAlign: 'center', fontSize: '16px' }}
                                      value={editingCell.value}
                                      onChange={(e) => setEditingCell({ ...editingCell, value: e.target.value })}
                                      onBlur={handleCellBlur}
                                      onKeyDown={handleCellKeyDown}
                                    />
                                  ) : (
                                    <div style={{ padding: '0.3rem', color: amt > 0 ? '#10b981' : isCovered ? 'rgba(16,185,129,0.5)' : 'transparent', fontWeight: 'bold' }}>
                                      {amt > 0 ? amt : isCovered ? '✓' : '-'}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)', borderLeft: '2px solid var(--border-color)' }}>
                              {totalPaid > 0 ? fmt(totalPaid) : '—'}
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                              {(() => {
                                const bal = totalPaid - expectedDues;
                                if (bal > 0) {
                                  return <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>+{bal}</span>;
                                } else if (bal === 0) {
                                  return <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.7rem', background: 'rgba(16,185,129,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>0</span>;
                                } else {
                                  return <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.7rem', background: 'rgba(239,68,68,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', whiteSpace: 'nowrap' }}>{bal}</span>;
                                }
                              })()}
                            </td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Roster management (Privileged only) */}
              {isPrivileged && (
                <div className="card">
                  <button type="button" onClick={() => setShowRoster(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: showRoster ? '1rem' : 0 }}>
                    <span style={{ fontSize: '0.8rem', transform: showRoster ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                    {t('dues_roster')} ({totalCount} {t('member_name').toLowerCase()}s)
                  </button>
                  {showRoster && (
                    <>
                      {ledgerData.members.map(m => (
                        <div key={m._id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{m.name}</span>
                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                              {m.linkedUser ? (
                                <>
                                  <button
                                    onClick={() => handleSendDuesEmail(m)}
                                    disabled={sendingEmail === m._id}
                                    title={`Email dues statement to ${m.linkedUser.email}`}
                                    style={{ background: 'none', border: '1px solid #0284c7', color: '#0284c7', cursor: 'pointer', fontSize: '0.72rem', borderRadius: '4px', padding: '0.15rem 0.45rem', opacity: sendingEmail === m._id ? 0.6 : 1 }}
                                  >
                                    {sendingEmail === m._id ? 'Sending…' : '📧 Send Email'}
                                  </button>
                                  <button
                                    onClick={() => openLinkModal(m)}
                                    style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', borderRadius: '4px', padding: '0.15rem 0.45rem' }}
                                  >
                                    🔗 Change
                                  </button>
                                  <button
                                    onClick={() => handleUnlinkUser(m)}
                                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.72rem' }}
                                  >
                                    Unlink
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => openLinkModal(m)}
                                  style={{ background: 'none', border: '1px dashed var(--border-color)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.72rem', borderRadius: '4px', padding: '0.15rem 0.45rem' }}
                                >
                                  🔗 Link User
                                </button>
                              )}
                              <button onClick={() => handleRemoveMember(m._id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.72rem' }}>{t('remove_from_roster')}</button>
                            </div>
                          </div>
                          {m.linkedUser && (
                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Linked to: <strong style={{ color: 'var(--text-main)' }}>{m.linkedUser.displayName}</strong> · <span style={{ fontFamily: 'monospace' }}>{m.linkedUser.email}</span>
                            </p>
                          )}
                        </div>
                      ))}
                      <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder={t('enter_name')} style={{ ...inputStyle, flex: 1 }} />
                          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>{t('add_member')}</button>
                        </div>
                        {addError && <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: 0 }}>{addError}</p>}
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

      {/* Transaction Modal */}
      {showForm && (() => {
        const isIncome = formData.type === 'INCOME';
        const accentColor = isIncome ? '#22c55e' : '#ef4444';
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div style={{ width: '100%', maxWidth: '520px', background: 'var(--surface)', borderRadius: '0', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>

              {/* Colored top accent bar */}
              <div style={{ height: '4px', background: `linear-gradient(90deg, ${accentColor}, ${isIncome ? '#16a34a' : '#dc2626'})`, transition: 'background 0.3s' }} />

              {/* Header */}
              <div style={{ padding: '1.5rem 1.5rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)', margin: 0 }}>
                      {editingId ? t('edit_transaction') : t('add_transaction')}
                    </h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>
                      {editingId ? 'Update the transaction details below.' : 'Fill in the details to record a new transaction.'}
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0.1rem 0.3rem', marginTop: '-0.1rem' }}>✕</button>
                </div>

                {/* Type toggle pills */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  {[{ val: 'INCOME', label: t('income'), icon: '↑', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' }, { val: 'EXPENSE', label: t('expense'), icon: '↓', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' }].map(({ val, label, icon, color, bg }) => {
                    const active = formData.type === val;
                    return (
                      <button key={val} type="button" onClick={() => handleInput({ target: { name: 'type', value: val } })} style={{ padding: '0.65rem', borderRadius: '0', border: `1.5px solid ${active ? color : 'var(--border-color)'}`, background: active ? bg : 'transparent', color: active ? color : 'var(--text-muted)', fontWeight: active ? '700' : '500', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        <span style={{ fontWeight: '700' }}>{icon}</span>{label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ padding: '0 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                  {/* Amount */}
                  <div>
                    <label style={labelStyle}>{t('amount')}</label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: accentColor, fontWeight: '700', fontSize: '1rem', pointerEvents: 'none', transition: 'color 0.3s' }}>₱</span>
                      <input type="number" name="amount" value={formData.amount} onChange={handleInput} required min="0.01" step="0.01" placeholder="0.00" style={{ ...inputStyle, paddingLeft: '2rem', fontWeight: '600', fontSize: '1.05rem' }} />
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <label style={labelStyle}>{t('category')}</label>
                      {categories.length > 0 && !customCategory && (
                        <button type="button" onClick={() => { setShowManageCategories(v => !v); setEditingCategory(null); }} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          {showManageCategories ? 'Done' : <><Pencil size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />Manage</>}
                        </button>
                      )}
                    </div>
                    {showManageCategories && !customCategory && (
                      <div style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '0', padding: '0.5rem', marginBottom: '0.6rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '160px', overflowY: 'auto' }}>
                        {categories.map(cat => (
                          <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {editingCategory?.original === cat ? (
                              <>
                                <input autoFocus type="text" value={editingCategory.draft} onChange={e => setEditingCategory(ec => ({ ...ec, draft: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(); } if (e.key === 'Escape') setEditingCategory(null); }} style={{ ...inputStyle, flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                                <button type="button" onClick={handleRenameCategory} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', whiteSpace: 'nowrap' }}>Save</button>
                                <button type="button" onClick={() => setEditingCategory(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.78rem' }}>✕</button>
                              </>
                            ) : (
                              <>
                                <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                                <button type="button" onClick={() => setEditingCategory({ original: cat, draft: cat })} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.2rem', flexShrink: 0 }} title={`Rename "${cat}"`}><Pencil size={13} /></button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!customCategory && categories.length > 0 ? (
                      <select name="category" value={formData.category} onChange={handleInput} required style={{ ...inputStyle }}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__CUSTOM__">+ Add New Category</option>
                      </select>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="text" name="category" value={formData.category} onChange={e => setFormData(f => ({ ...f, category: e.target.value }))} placeholder="e.g. Donations, Food" required style={{ ...inputStyle, flex: 1 }} />
                        {categories.length > 0 && <button type="button" onClick={() => setCustomCategory(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>}
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label style={labelStyle}>{t('description')} <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '0.8rem' }}>(Optional)</span></label>
                    <textarea name="description" value={formData.description} onChange={handleInput} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder={`E.g. Registration fee\n- John\n- Jane`} />
                  </div>

                  {/* Date */}
                  <div>
                    <label style={labelStyle}>{t('date')}</label>
                    <input type="date" name="date" value={formData.date} onChange={handleInput} required style={inputStyle} />
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
                  <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.6rem 1.25rem', borderRadius: '0', border: '1px solid var(--border-color)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem' }}>{t('cancel')}</button>
                  <button type="submit" style={{ padding: '0.6rem 1.5rem', borderRadius: '0', border: 'none', background: accentColor, color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem', transition: 'background 0.3s', boxShadow: `0 4px 14px ${accentColor}55` }}>{t('save')}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Fellowship Modal */}

      {showFellowshipForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '1.25rem' }}>Youth Fellowship Expense</h3>
            <form onSubmit={handleFellowshipSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto', overflowX: 'hidden' }}>
              <div>
                <label style={labelStyle}>Event Name</label>
                <input type="text" value={fellowshipData.eventName} onChange={e => setFellowshipData(f => ({...f, eventName: e.target.value}))} placeholder="E.g. Binhi #Pru-Task" required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fee per Participant (₱)</label>
                <input type="number" value={fellowshipData.fee} onChange={e => setFellowshipData(f => ({...f, fee: Number(e.target.value)}))} required min="1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>{t('date')}</label>
                <input type="date" value={fellowshipData.date} onChange={e => setFellowshipData(f => ({...f, date: e.target.value}))} required style={{ ...inputStyle, maxWidth: '100%' }} />
              </div>
              <div>
                <label style={labelStyle}>Select Participants from Roster ({fellowshipData.participants.length} selected)</label>
                <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0.5rem', background: 'var(--bg-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {ledgerData.members.map(m => (
                    <label key={m._id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', color: 'var(--text-main)' }}>
                      <input type="checkbox" checked={fellowshipData.participants.includes(m._id)} onChange={() => toggleParticipant(m._id)} />
                      {m.name}
                    </label>
                  ))}
                  {ledgerData.members.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No members in roster.</span>}
                </div>
              </div>
              <div>
                <label style={labelStyle}>Additional / Guest Participants (Comma separated)</label>
                <input type="text" value={fellowshipData.customParticipants} onChange={e => setFellowshipData(f => ({...f, customParticipants: e.target.value}))} placeholder="E.g. Guest 1, Mark, Anna's Friend" style={inputStyle} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
                <div style={{ fontWeight: 'bold', color: '#ef4444' }}>Total: ₱{fellowshipData.fee * (fellowshipData.participants.length + fellowshipData.customParticipants.split(',').map(s=>s.trim()).filter(Boolean).length)}</div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button type="button" onClick={() => setShowFellowshipForm(false)} className="btn btn-secondary">{t('cancel')}</button>
                  <button type="submit" className="btn btn-primary">Submit</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Link User Modal */}
      {linkModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.25rem' }}>🔗 Link User to Roster Entry</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Connecting a user ensures their exact arrears amount is emailed to their account.</p>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-main)' }}>
              Roster entry: <strong>{linkModal.member?.name}</strong>
              {linkModal.member?.linkedUser && <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>(currently linked to <strong>{linkModal.member.linkedUser.displayName}</strong>)</span>}
            </div>
            <input
              autoFocus
              type="text"
              placeholder="Search by name..."
              value={userSearchQuery}
              onChange={e => setUserSearchQuery(e.target.value)}
              style={{ ...inputStyle, marginBottom: '0.75rem' }}
            />
            <div style={{ minHeight: '80px', maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', background: 'var(--bg-color)' }}>
              {searchingUsers ? (
                <p style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>Searching…</p>
              ) : userSearchResults.length === 0 ? (
                <p style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>{userSearchQuery ? 'No users found.' : 'Start typing to search registered users.'}</p>
              ) : userSearchResults.map(u => (
                <button
                  key={u._id}
                  onClick={() => handleConfirmLink(u._id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ color: 'var(--text-main)', fontWeight: '500', fontSize: '0.9rem' }}>{u.displayName}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{u.role}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={closeLinkModal} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.75rem' }}>{alertDialog.title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>{alertDialog.message}</p>
            <button onClick={() => setAlertDialog({ ...alertDialog, isOpen: false })} className="btn btn-primary" style={{ width: '100%' }}>OK</button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmDialog.isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '0.75rem' }}>{confirmDialog.title}</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} className="btn btn-secondary" style={{ flex: 1 }}>Cancel</button>
              <button 
                onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog({ ...confirmDialog, isOpen: false });
                }} 
                className="btn btn-primary" 
                style={{ flex: 1, backgroundColor: '#ef4444' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
