import { useState, useEffect } from 'react';
import * as resources from '../services/resources';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { useLanguage } from '../context/LanguageContext';
import { X, UploadCloud, Save, FileText } from 'lucide-react';

const ResourceUploadModal = ({ onClose, onSuccess, resourceToEdit }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: resourceToEdit ? resourceToEdit.title : '',
    author: resourceToEdit?.author || '',
    category: resourceToEdit?.category || '',
    tags: resourceToEdit?.tags ? resourceToEdit.tags.join(', ') : '',
    description: resourceToEdit?.description || ''
  });
  const [file, setFile] = useState(null);
  const [coverImage, setCoverImage] = useState(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleQuillChange = (value) => {
    setFormData({ ...formData, description: value });
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleCoverImageChange = (e) => {
    if (e.target.files[0]) {
      setCoverImage(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!resourceToEdit && !file && !formData.title) {
      alert('Title is required.');
      return;
    }

    setLoading(true);
    
    try {
      const data = new FormData();
      data.append('title', formData.title);
      data.append('author', formData.author);
      data.append('category', formData.category);
      data.append('tags', formData.tags);
      data.append('description', formData.description);
      if (file) data.append('file', file);
      if (coverImage) data.append('coverImage', coverImage);

      let response;
      if (resourceToEdit) {
        response = await resources.updateResource(resourceToEdit._id, data);
      } else {
        response = await resources.createResource(data);
      }
      
      onSuccess(response, !!resourceToEdit);
    } catch (error) {
      console.error('Failed to upload/update resource:', error);
      alert('Failed to save resource. Ensure you are an admin and the data is valid.');
    } finally {
      setLoading(false);
    }
  };

  const accentColor = 'var(--primary)';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '650px', background: 'var(--surface)', borderRadius: '1.25rem', boxShadow: '0 24px 60px rgba(0,0,0,0.4)', overflow: 'hidden', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', maxHeight: '90vh', backdropFilter: 'blur(16px)' }}>
        
        {/* Colored top accent bar */}
        <div style={{ height: '4px', background: `linear-gradient(90deg, ${accentColor}, var(--primary))`, transition: 'background 0.3s' }} />

        {/* Header */}
        <div style={{ padding: '1.5rem 1.5rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {resourceToEdit ? <><Save size={20} color={accentColor} /> {t('edit_resource') || 'Edit Resource'}</> : <><UploadCloud size={20} color={accentColor} /> {t('upload_resource') || 'Upload Resource'}</>}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                {resourceToEdit ? 'Update the details for this resource.' : 'Add a new document or link to the resource center.'}
              </p>
            </div>
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: '0.1rem 0.3rem', marginTop: '-0.1rem' }}>
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Form Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
          <form id="resource-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label className="form-label">{t('resource_title')} *</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} required className="form-input" style={{ fontWeight: '600' }} />
              </div>

              <div>
                <label className="form-label">{t('resource_author')}</label>
                <input type="text" name="author" value={formData.author} onChange={handleChange} className="form-input" placeholder="e.g. John Doe" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div>
                <label className="form-label">{t('category') || 'Category'}</label>
                <input type="text" name="category" value={formData.category} onChange={handleChange} placeholder="e.g. Theology, Leadership, Music" className="form-input" />
              </div>

              <div>
                <label className="form-label">{t('resource_tags')}</label>
                <input type="text" name="tags" value={formData.tags} onChange={handleChange} placeholder="e.g. youth, faith, study" className="form-input" />
              </div>
            </div>

            <div>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <FileText size={16} />
                {t('abstract') || 'Description / Abstract'}
              </label>
              <div className="quill-custom" style={{ border: '1px solid var(--border-color)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                <ReactQuill 
                  theme="snow" 
                  value={formData.description} 
                  onChange={handleQuillChange}
                  style={{ background: 'var(--bg-color)', color: 'var(--text-main)' }}
                />
              </div>
            </div>

            <div className="upload-file-grid">
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UploadCloud size={16} />
                    Document File
                  </div>
                  {resourceToEdit?.fileUrl && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>✓ Saved</span>}
                </label>
                <div style={{ position: 'relative', border: '1px dashed var(--border-color)', padding: '1rem', background: 'var(--surface-border)', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <input 
                    type="file" 
                    onChange={handleFileChange} 
                    className="form-input" 
                    style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%' }} 
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {resourceToEdit ? 'Leave empty to keep current file.' : 'Optional'}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <UploadCloud size={16} />
                    Cover Image
                  </div>
                  {resourceToEdit?.coverImageUrl && <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: '600', backgroundColor: 'rgba(34, 197, 94, 0.1)', padding: '0.15rem 0.5rem', borderRadius: '12px' }}>✓ Saved</span>}
                </label>
                <div style={{ position: 'relative', border: '1px dashed var(--border-color)', padding: '1rem', background: 'var(--surface-border)', textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleCoverImageChange} 
                    className="form-input" 
                    style={{ padding: '0.4rem 0.5rem', cursor: 'pointer', background: 'transparent', border: 'none', width: '100%' }} 
                  />
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {resourceToEdit ? 'Leave empty to keep current image.' : 'Optional'}
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-color)', flexShrink: 0 }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={loading} style={{ padding: '0.6rem 1.5rem', borderRadius: '9999px', fontWeight: '600' }}>
            {t('cancel') || 'Cancel'}
          </button>
          <button type="submit" form="resource-form" className="btn btn-primary" disabled={loading} style={{ padding: '0.6rem 1.75rem', borderRadius: '9999px', background: accentColor, border: 'none', fontWeight: '700', boxShadow: `0 4px 14px ${accentColor}44` }}>
            {loading ? (t('loading') || 'Saving...') : (resourceToEdit ? (t('save') || 'Save Changes') : t('upload_resource') || 'Upload Resource')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceUploadModal;

