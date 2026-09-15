import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as resourcesApi from '../services/resources';
import { Search, Trash2, Library, Plus, Pencil, BookOpen, Users, Music, Compass, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ResourceUploadModal from '../components/ResourceUploadModal';
import PageHeader from '../components/PageHeader';

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

// Helper to get category icons
const getCategoryIcon = (category) => {
  if (!category) return Library;
  const lower = category.toLowerCase();
  if (lower.includes('theology') || lower.includes('faith') || lower.includes('bible') || lower.includes('doctrine')) return BookOpen;
  if (lower.includes('leader') || lower.includes('admin') || lower.includes('management')) return Users;
  if (lower.includes('music') || lower.includes('worship') || lower.includes('song')) return Music;
  if (lower.includes('general') || lower.includes('other')) return Library;
  return Compass;
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
    const load = async () => {
      try {
        const data = await resourcesApi.listResources();
        setResources(data);
      } catch (error) {
        console.error('Failed to fetch resources:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
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

  const confirmDelete = async () => {
    if (!resourceToDelete) return;
    try {
      await resourcesApi.deleteResource(resourceToDelete._id);
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

  const getCategoryCount = (category) => {
    return resources.filter(r => r.category === category).length;
  };

  return (
    <div className="container resource-center-container">
      
      {/* ── BREATHTAKING HERO BANNER ── */}
      <div className="resource-hero-banner">
        <div className="resource-hero-banner-inner">
          <PageHeader
            className="page-header--flush"
            icon={Library}
            title={t('resource_center') || 'Resource Center'}
            subtitle={t('resource_center_desc') || 'Access shared guides, leadership templates, liturgy documents and studies.'}
            actions={
              user?.role === 'ADMIN' && (
                <button
                  onClick={() => { setEditingResource(null); setIsModalOpen(true); }}
                  className="btn btn-primary page-header-btn"
                >
                  <Plus size={18} />
                  {t('upload_resource') || 'Upload Resource'}
                </button>
              )
            }
          />
        </div>
      </div>

      {/* ── SEARCH INPUT WITH FOCUS GLOW ── */}
      <div className="resource-controls" style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <input 
            type="text" 
            placeholder={t('search_resources') || 'Search titles, authors, tags...'} 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ 
              paddingLeft: '2.5rem', 
              paddingRight: '2.5rem',
              width: '100%', 
              boxSizing: 'border-box',
              borderRadius: '9999px',
              border: '1px solid var(--border-color)',
              background: 'var(--bg-color)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
              height: '42px'
            }}
          />
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1, pointerEvents: 'none' }} />
          {search && (
            <button 
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── DYNAMIC CATEGORY PILL TRACK ── */}
      <div className="resource-category-track">
        <button 
          onClick={() => setSelectedCategory('')}
          className={`resource-category-pill ${selectedCategory === '' ? 'active' : ''}`}
        >
          <Library size={15} />
          {t('all_categories') || 'All Volumes'}
          <span style={{ fontSize: '0.72rem', opacity: 0.8, marginLeft: '0.25rem', fontWeight: 'bold' }}>
            ({resources.length})
          </span>
        </button>
        {categories.map(c => {
          const Icon = getCategoryIcon(c);
          const count = getCategoryCount(c);
          return (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              className={`resource-category-pill ${selectedCategory === c ? 'active' : ''}`}
            >
              <Icon size={15} />
              {c}
              <span style={{ fontSize: '0.72rem', opacity: 0.8, marginLeft: '0.25rem', fontWeight: 'bold' }}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>{t('loading') || 'Loading Library...'}</div>
      ) : (
        <div className="resource-grid">
          {filteredResources.map(resource => (
            <div key={resource._id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div 
                className="book-card" 
                onClick={() => navigate(`/resources/${resource._id}`)}
                style={{ background: getCategoryGradient(resource.category) }}
              >
                {/* Float Category Tag on Top Left */}
                <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', zIndex: 10 }}>
                  <span className="book-card-category" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    {resource.category}
                  </span>
                </div>

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
                  <div style={{ marginBottom: '0.5rem', zIndex: 10, marginTop: 'auto' }}>
                    <h3 className="book-card-title" title={resource.title}>
                      {truncateText(resource.title, 100)}
                    </h3>
                  </div>
                  
                  {resource.author && (
                    <p className="book-card-author">
                      {t('resource_author') || 'By'} {resource.author}
                    </p>
                  )}
                  
                  <div className="book-card-meta" style={{ marginTop: '0.75rem' }}>
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
                <div className="resource-admin-actions">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setEditingResource(resource); setIsModalOpen(true); }} 
                    className="resource-admin-btn resource-admin-btn-edit"
                  >
                    <Pencil size={13} /> {t('edit') || 'Edit'}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setResourceToDelete(resource); }} 
                    className="resource-admin-btn resource-admin-btn-delete"
                  >
                    <Trash2 size={13} /> {t('delete') || 'Delete'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {filteredResources.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
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
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', background: 'var(--surface)', borderRadius: '1.25rem', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', backdropFilter: 'blur(16px)' }}>
            
            {/* Colored top accent bar */}
            <div style={{ height: '4px', background: `linear-gradient(90deg, var(--secondary), var(--primary))` }} />

            <div style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
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
                style={{ padding: '0.6rem 1.25rem', fontWeight: '600', borderRadius: '9999px' }}
              >
                {t('cancel') || 'Cancel'}
              </button>
              <button 
                onClick={confirmDelete} 
                className="btn btn-primary" 
                style={{ padding: '0.6rem 1.5rem', fontWeight: '700', borderRadius: '9999px', background: '#ef4444', border: 'none', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
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
