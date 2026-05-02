import React, { useState, useEffect } from 'react';
import api from '../api';
import { useLanguage } from '../context/LanguageContext';

const fruitsList = [
  { key: 'Love', i18n: 'fruit_love', color: '#EF4444' }, // Red
  { key: 'Joy', i18n: 'fruit_joy', color: '#F59E0B' }, // Amber
  { key: 'Peace', i18n: 'fruit_peace', color: '#3B82F6' }, // Blue
  { key: 'Patience', i18n: 'fruit_patience', color: '#10B981' }, // Emerald
  { key: 'Kindness', i18n: 'fruit_kindness', color: '#8B5CF6' }, // Violet
  { key: 'Goodness', i18n: 'fruit_goodness', color: '#EC4899' }, // Pink
  { key: 'Faithfulness', i18n: 'fruit_faithfulness', color: '#06B6D4' }, // Cyan
  { key: 'Gentleness', i18n: 'fruit_gentleness', color: '#14B8A6' }, // Teal
  { key: 'Self-control', i18n: 'fruit_self_control', color: '#6366F1' }, // Indigo
];

const MyFruits = () => {
  const [fruitCounts, setFruitCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    let isMounted = true;

    const fetchMyFruits = async (isBackground = false) => {
      try {
        const res = await api.get(`/fruits/me?t=${Date.now()}`);
        if (isMounted) setFruitCounts(res.data);
      } catch (err) {
        if (!isBackground && isMounted) setError('Failed to fetch fruits');
      } finally {
        if (!isBackground && isMounted) setLoading(false);
      }
    };
    
    fetchMyFruits();

    // Poll every 15 seconds to keep the numbers updated in real-time
    const intervalId = setInterval(() => {
      fetchMyFruits(true);
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t('loading')}</div>;
  if (error) return <div className="ff-alert ff-alert-error">{error}</div>;

  const totalFruits = Object.values(fruitCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="fun-card" style={{ borderTop: '4px solid var(--primary)', padding: '1.5rem' }}>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {t('my_fruits_desc')}
      </p>

      {totalFruits === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          {t('no_fruits_yet')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
          {fruitsList.map(({ key, i18n, color }) => (
            <div 
              key={key} 
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                padding: '1rem', 
                backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
                borderRadius: '8px',
                border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                opacity: fruitCounts[key] > 0 ? 1 : 0.4
              }}
            >
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: color, marginBottom: '0.25rem' }}>
                {fruitCounts[key] || 0}
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)', textAlign: 'center' }}>
                {t(i18n)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyFruits;
