import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { Search, Download, Trash2, Library, Plus, Pencil } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ResourceUploadModal from '../components/ResourceUploadModal';

// Helper to generate dynamic book cover backgrounds
const getCategoryGradient = (category) => {
  const gradients = {
    'Theology': 'linear-gradient(135deg, #7f1d1d 0%, #450a0a 100%)',
    'Leadership': 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
    'Music': 'linear-gradient(135deg, #5b21b6 0%, #2e1065 100%)',
    'General': 'linear-gradient(135deg, #0f766e 0%, #042f2e 100%)'
  };
  return gradients[category] || 'linear-gradient(135deg, #374151 0%, #111827 100%)';
};

// Helper to limit string length
const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

const ResourceCenter = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [resourceToDelete, setResourceToDelete] = useState(null);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchResources();
  }, []);

  // Lock body scroll when the delete modal is open
  useEffect(() => {
    if (resourceToDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [resourceToDelete]);

  const fetchResources = async () => {
    try {
      const { data } = await api.get('/resources');
      setResources(data);
    } catch (error) {
      console.error('Failed to fetch resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!resourceToDelete) return;
    try {
      await api.delete(`/resources/${resourceToDelete._id}`);
      setResources(resources.filter(r => r._id !== resourceToDelete._id));
      setResourceToDelete(null);
    } catch (error) {
      console.error('Failed to delete resource:', error);
      alert('Error deleting resource');
    }
  };

  const filteredResources = resources.filter(res => {
    const matchesSearch = res.title.toLowerCase().includes(search.toLowerCase()) || 
                          (res.author && res.author.toLowerCase().includes(search.toLowerCase())) ||
                          (res.tags && res.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase())));
    const matchesCategory = selectedCategory ? res.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  const categories = [...new Set(resources.map(r => r.category))].filter(Boolean);

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '2rem 1rem' }}>
      <div className="resource-header-container">
        <div>
          <h1 className="resource-header-title">
            <Library size={36} color="var(--primary)" />
            {t('resource_center')}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('resource_center_desc')}</p>
        </div>
        
        {user?.role === 'ADMIN' && (
          <button onClick={() => { setEditingResource(null); setIsModalOpen(true); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={20} />
            {t('upload_resource')}
          </button>
        )}
      </div>

      <div className="card resource-controls">
        <div style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder={t('search_resources')} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.5rem', width: '100%', boxSizing: 'border-box' }}
          />
          <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1, pointerEvents: 'none' }} />
        </div>
        <select 
          className="form-input" 
          value={selectedCategory} 
          onChange={(e) => setSelectedCategory(e.target.value)}
          style={{ width: '100%' }}
        >
          <option value="">{t('all_categories')}</option>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>{t('loading') || 'Loading...'}</div>
      ) : (
        <div className="resource-grid">
          {filteredResources.map(resource => (
            <div key={resource._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                className="book-card" 
                onClick={() => navigate(`/resources/${resource._id}`)}
                style={{ background: getCategoryGradient(resource.category) }}
              >
                {/* Optional uploaded cover image */}
              {resource.coverImageUrl ? (
                <>
                  <img src={resource.coverImageUrl} alt={resource.title} className="book-card-image" />
                  <div className="book-card-overlay"></div>
                </>
              ) : (
                <div className="book-card-texture"></div>
              )}
              
              {/* Book spine effect */}
              <div className="book-card-spine"></div>

              {/* Content overlay */}
              <div className="book-card-content">
                <div style={{ marginBottom: '0.5rem', zIndex: 10 }}>
                  <h3 className="book-card-title" title={resource.title}>
                    {truncateText(resource.title, 100)}
                  </h3>
                </div>
                
                {resource.author && (
                  <p className="book-card-author">
                    {t('resource_author') || 'By'} {resource.author}
                  </p>
                )}
                
                <div className="book-card-meta">
                  <span className="book-card-category">
                    {resource.category}
                  </span>
                  {resource.tags?.slice(0, 2).map(tag => (
                    <span key={tag} className="book-card-tag">
                      {tag}
                    </span>
                  ))}
                  {resource.tags?.length > 2 && (
                    <span className="book-card-tag">+{resource.tags.length - 2}</span>
                  )}
                </div>
              </div>
              </div>
              
              {/* Admin Controls External to Card */}
              {user?.role === 'ADMIN' && (
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <button onClick={(e) => { e.stopPropagation(); setEditingResource(resource); setIsModalOpen(true); }} className="btn btn-secondary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '0' }}>
                    <Pencil size={14} /> Edit
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setResourceToDelete(resource); }} className="btn btn-primary" style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', background: 'var(--danger)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: '0' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredResources.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No resources found matching your search.
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <ResourceUploadModal 
          onClose={() => {
            setIsModalOpen(false);
            setEditingResource(null);
          }} 
          onSuccess={(savedResource, isEdit) => {
            if (isEdit) {
              setResources(resources.map(r => r._id === savedResource._id ? savedResource : r));
            } else {
              setResources([savedResource, ...resources]);
            }
            setIsModalOpen(false);
            setEditingResource(null);
          }} 
          resourceToEdit={editingResource}
        />
      )}

      {/* Delete Confirmation Modal */}
      {resourceToDelete && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={() => setResourceToDelete(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', background: 'var(--surface)', borderRadius: '0', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            
            {/* Colored top accent bar */}
            <div style={{ height: '4px', background: `linear-gradient(90deg, var(--danger), var(--primary))`, transition: 'background 0.3s' }} />

            <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Trash2 size={24} />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 0.5rem' }}>
                {t('delete') || 'Delete Resource'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
                {t('are_you_sure_prefix') === 'are_you_sure_prefix' ? 'Are you sure you want to delete ' : t('are_you_sure_prefix')}
                <strong style={{ color: 'var(--text-main)' }}>"{resourceToDelete.title}"</strong>?
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-color)' }}>
              <button 
                onClick={() => setResourceToDelete(null)} 
                className="btn btn-secondary" 
                style={{ padding: '0.6rem 1.25rem', fontWeight: '600', borderRadius: '0' }}
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete} 
                className="btn btn-primary" 
                style={{ padding: '0.6rem 1.5rem', fontWeight: '700', borderRadius: '0', background: 'var(--danger)', border: 'none', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}
              >
                {t('delete') || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceCenter;
