import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, User, MessageCircle } from 'lucide-react';
import api from '../api';

export default function MemberDirectory({ showAlert, showConfirm, onSelectMember }) {
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    facebookChatUrl: ''
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await api.get('/members');
      setMembers(response.data);
    } catch (error) {
      console.error('Failed to load members', error);
      if (showAlert) showAlert('Error', 'Failed to load member directory.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/members/${editingId}`, formData);
        if (showAlert) showAlert('Success', 'Member updated.');
      } else {
        await api.post('/members', formData);
        if (showAlert) showAlert('Success', 'Member added.');
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', facebookChatUrl: '' });
      fetchMembers();
    } catch (error) {
      const msg = error.response?.data?.msg || error.message;
      if (showAlert) showAlert('Error', msg);
    }
  };

  const handleDelete = (id) => {
    if (showConfirm) {
      showConfirm('Delete Member', 'Are you sure you want to remove this member?', async () => {
        try {
          await api.delete(`/members/${id}`);
          fetchMembers();
        } catch (error) {
          if (showAlert) showAlert('Error', 'Failed to delete member.');
        }
      });
    }
  };

  const handleEdit = (member) => {
    setEditingId(member._id);
    setFormData({ name: member.name, facebookChatUrl: member.facebookChatUrl });
    setIsModalOpen(true);
  };

  const filteredMembers = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 250px', minWidth: 0 }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search by exact name..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.5rem', width: '100%' }}
          />
        </div>
        <button className="btn btn-primary" style={{ flex: '0 0 auto' }} onClick={() => { setEditingId(null); setFormData({ name: '', facebookChatUrl: '' }); setIsModalOpen(true); }}>
          <Plus size={18} /> Add Member
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
        {filteredMembers.map(member => (
          <div key={member._id} className="card" style={{ 
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
            overflow: 'hidden',
            cursor: onSelectMember ? 'pointer' : 'default'
          }}
          onClick={() => onSelectMember && onSelectMember(member)}
          >
            <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--primary)' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ background: 'var(--primary-glow)', padding: '0.6rem', borderRadius: '50%', color: 'var(--primary)' }}>
                  <User size={20} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-main)' }}>
                    {member.name}
                  </h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Excel Schedule Name</p>
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageCircle size={16} style={{ color: 'var(--text-muted)' }} />
              <a href={member.facebookChatUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none', fontWeight: '600' }}>
                {member.facebookChatUrl.replace('https://', '')}
              </a>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
              {!onSelectMember && (
                <>
                  <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0.4rem' }} onClick={(e) => { e.stopPropagation(); handleEdit(member); }}>
                    <Edit2 size={16} style={{ marginRight: '0.4rem' }} /> Edit
                  </button>
                  <button className="btn btn-secondary text-danger" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0.4rem', borderColor: 'transparent', background: 'rgba(239, 68, 68, 0.05)' }} onClick={(e) => { e.stopPropagation(); handleDelete(member._id); }}>
                    <Trash2 size={16} /> 
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        {filteredMembers.length === 0 && (
          <div className="card" style={{ gridColumn: '1 / -1', padding: '3rem 2rem', textAlign: 'center', background: 'var(--surface)', border: '1px dashed var(--border-color)' }}>
            <User size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
            <h4 style={{ color: 'var(--text-main)', margin: '0 0 0.5rem 0' }}>No members found</h4>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add members to map their names to Facebook Chat URLs.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="ma-modal-overlay">
          <div className="card ma-modal-content" onClick={e => e.stopPropagation()}>
            <div className="ma-modal-header">
              <h3>{editingId ? 'Edit Member' : 'Add Member'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="ma-icon-btn">✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Exact Excel Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. David Garcia"
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Facebook Chat URL</label>
                <input 
                  type="url" 
                  className="form-input" 
                  value={formData.facebookChatUrl}
                  onChange={(e) => setFormData({...formData, facebookChatUrl: e.target.value})}
                  placeholder="https://m.me/..."
                  required 
                />
              </div>
              <div className="ma-modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Member</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
