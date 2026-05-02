import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Send, ArrowLeft } from 'lucide-react';
import api from '../api';

const CreateTicket = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    type: 'bug',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      setError('Please fill in all fields.');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    try {
      await api.post('/tickets', formData);
      navigate('/tickets/dashboard');
    } catch (err) {
      console.error('Failed to create request:', err);
      setError(err.response?.data?.msg || 'An error occurred while submitting the request.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '600px', padding: '2rem 1rem' }}>
      <button 
        onClick={() => navigate('/tickets/dashboard')} 
        className="btn btn-secondary"
        style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>

      <div className="card">
        <h1 style={{ fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t('create_request')}
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          {t('system_requests_desc')}
        </p>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" htmlFor="title">{t('request_title_label')}</label>
            <input
              type="text"
              id="title"
              name="title"
              className="form-input"
              value={formData.title}
              onChange={handleChange}
              placeholder="E.g., Cannot upload profile picture"
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" htmlFor="type">{t('request_type_label')}</label>
            <select
              id="type"
              name="type"
              className="form-input"
              value={formData.type}
              onChange={handleChange}
              style={{ appearance: 'none' }}
              required
            >
              <option value="bug">{t('type_bug')}</option>
              <option value="feature">{t('type_feature')}</option>
              <option value="modification">{t('type_modification')}</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label className="form-label" htmlFor="description">{t('request_desc_label')}</label>
            <textarea
              id="description"
              name="description"
              className="form-input"
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide details about your request..."
              rows="6"
              required
              style={{ resize: 'vertical' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isSubmitting}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.75rem' }}
          >
            {isSubmitting ? t('sending') : <><Send size={18} /> {t('submit_request')}</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;
