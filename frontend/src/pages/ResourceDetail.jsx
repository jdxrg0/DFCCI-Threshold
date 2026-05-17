import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, Download, BookOpen } from 'lucide-react';
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
        const { data } = await api.get(`/resources/${id}`);
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
    <div style={{ maxWidth: '100%', overflowX: 'hidden' }}>

      {/* ── HERO HEADER ── */}
      <div className="resource-hero">
        <div className="resource-hero-inner">
          {/* Top Navigation Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
            <button
              onClick={() => navigate('/resources')}
              className="resource-back-btn"
              style={{ marginBottom: 0 }}
            >
              <ArrowLeft size={16} />
              Resource Center
            </button>

            {/* Compact Download CTA */}
            {resource.fileUrl ? (
              <a
                href={getDownloadUrl(resource.fileUrl)}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.5rem 1rem', borderRadius: '0' }}
              >
                <Download size={16} />
                Download File
              </a>
            ) : (
              <span style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }}>
                {t('no_file_attached') || 'No file attached'}
              </span>
            )}
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <span className="resource-tag resource-tag-primary">{resource.category}</span>
            {resource.tags?.map(tag => (
              <span key={tag} className="resource-tag resource-tag-muted">{tag}</span>
            ))}
          </div>

          {/* Title */}
          <h1 className="resource-hero-title">{resource.title}</h1>

          {/* Meta row */}
          <div className="resource-hero-meta">
            {resource.author && (
              <span className="resource-meta-item">
                <BookOpen size={15} />
                {resource.author}
              </span>
            )}
          </div>


        </div>
      </div>

      {/* ── READING BODY ── */}
      <div className="resource-body-container">
        {resource.description ? (
          <div
            className="quill-content resource-reading-content"
            dangerouslySetInnerHTML={{ __html: resource.description.replace(/&nbsp;|\u00A0/g, ' ') }}
          />
        ) : (
          <p style={{ fontStyle: 'italic', color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
            {t('no_description') || 'No abstract or description provided for this resource.'}
          </p>
        )}
      </div>

    </div>
  );
};

export default ResourceDetail;
