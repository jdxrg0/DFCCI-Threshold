import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { Send, ArrowLeft, Wrench } from 'lucide-react';
import api from '../api';
import PageHeader from '../components/PageHeader';

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
      <div style={{ padding: 0 }} className="ticket-form-container">
        <PageHeader
          icon={Wrench}
          title={t('create_request')}
          subtitle={t('system_requests_desc')}
        />

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.9rem', fontWeight: '600' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title input */}
          <div className="ff-field" style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              id="title"
              name="title"
              className="ticket-input-glass"
              value={formData.title}
              onChange={handleChange}
              placeholder="E.g., Cannot upload profile picture"
              required
            />
            <label className="ticket-field-label" htmlFor="title">{t('request_title_label')}</label>
          </div>

          {/* Type dropdown */}
          <div className="ff-field" style={{ marginBottom: '1.5rem' }}>
            <select
              id="type"
              name="type"
              className={`ticket-input-glass ${formData.type ? 'has-value' : ''}`}
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="bug">{t('type_bug')}</option>
              <option value="feature">{t('type_feature')}</option>
              <option value="modification">{t('type_modification')}</option>
            </select>
            <label className="ticket-field-label" htmlFor="type">{t('request_type_label')}</label>
          </div>

          {/* Description textarea */}
          <div className="ff-field ff-textarea" style={{ marginBottom: '2rem' }}>
            <textarea
              id="description"
              name="description"
              className="ticket-input-glass ff-textarea-el"
              value={formData.description}
              onChange={handleChange}
              placeholder="Provide details about your request..."
              rows="6"
              required
            />
            <label className="ticket-field-label" htmlFor="description">{t('request_desc_label')}</label>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={isSubmitting}
            style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', padding: '0.85rem', borderRadius: '9999px', fontWeight: '700' }}
          >
            {isSubmitting ? t('sending') : <><Send size={16} /> {t('submit_request')}</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateTicket;
