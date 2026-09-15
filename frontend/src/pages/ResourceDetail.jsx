import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as resources from '../services/resources';
import { Download, BookOpen } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

const getDownloadUrl = (url) => {
  if (!url) return '';
  // Raw files (.docx, .zip) don't support fl_attachment and already download automatically
  if (url.includes('/raw/upload/')) {
    return url;
  }
  // Insert fl_attachment/ after upload/ to force browser to download images/PDFs
  if (url.includes('/upload/')) {
    return url.replace('/upload/', '/upload/fl_attachment/');
  }
  return url;
};

const ResourceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchResource = async () => {
      try {
        const data = await resources.getResource(id);
        setResource(data);
      } catch (err) {
        console.error('Failed to fetch resource:', err);
        setError('Failed to load resource. It may have been deleted or you do not have permission.');
      } finally {
        setLoading(false);
      }
    };
    fetchResource();
  }, [id]);

  // Restore and save scroll position
  useEffect(() => {
    if (!loading && resource) {
      const storageKey = `resource_scroll_${id}`;
      
      // Restore previous position
      const savedPosition = localStorage.getItem(storageKey);
      if (savedPosition) {
        // Use setTimeout to ensure DOM is fully rendered before scrolling
        setTimeout(() => {
          window.scrollTo({ top: parseInt(savedPosition, 10), behavior: 'instant' });
        }, 100);
      }

      // Save position on scroll
      let timeoutId;
      const handleScroll = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          localStorage.setItem(storageKey, window.scrollY);
        }, 150); // Debounce to save performance
      };

      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
        clearTimeout(timeoutId);
      };
    }
  }, [loading, resource, id]);

  if (loading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>{t('loading') || 'Loading...'}</p>
      </div>
    );
  }

  if (error || !resource) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <p style={{ color: 'var(--danger)' }}>{error || 'Resource not found'}</p>
        <button onClick={() => navigate('/resources')} className="btn btn-secondary">
          Back to Resource Center
        </button>
      </div>
    );
  }

  return (
    <div className="resource-detail-view">

      {/* Premium Reader Card Container */}
      <div className="resource-reading-card">
        
        {/* Header Block inside Card */}
        <div className="resource-reading-header">
          {/* Categories and tags floating inside Card */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span className="resource-tag resource-tag-primary" style={{ background: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {resource.category}
            </span>
            {resource.tags?.map(tag => (
              <span key={tag} className="resource-tag resource-tag-muted" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="resource-reading-title">{resource.title}</h1>

          {/* Metadata Row inside Card */}
          <div className="resource-reading-meta">
            <div className="resource-reading-author">
              <BookOpen size={16} style={{ color: 'var(--primary)' }} />
              <span>{resource.author || 'Unknown Author'}</span>
            </div>

            {/* Slick compact Download Link */}
            {resource.fileUrl ? (
              <a
                href={getDownloadUrl(resource.fileUrl)}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '0.4rem', 
                  fontSize: '0.78rem', 
                  padding: '0.45rem 1.15rem', 
                  borderRadius: '9999px', 
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <Download size={14} />
                Download File
              </a>
            ) : (
              <span style={{ fontSize: '0.75rem', padding: '0.4rem 1rem', borderRadius: '9999px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid var(--border-color)', display: 'inline-block' }}>
                {t('no_file_attached') || 'No Attached File'}
              </span>
            )}
          </div>
        </div>

        {/* ── READING BODY ── */}
        <div className="resource-reading-content">
          {resource.description ? (
            <div
              className="quill-content"
              dangerouslySetInnerHTML={{ __html: resource.description.replace(/&nbsp;|\u00A0/g, ' ') }}
            />
          ) : (
            <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 0' }}>
              {t('no_description') || 'No abstract or description provided for this resource.'}
            </p>
          )}
        </div>

      </div>
    </div>
  );
};

export default ResourceDetail;
