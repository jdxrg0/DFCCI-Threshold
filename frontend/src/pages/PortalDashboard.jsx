import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Compass, BookOpen, Wrench, Sun, Wallet, Library } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const PortalDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const modules = [
    {
      id: 'gentle_mirror',
      title: 'Gentle Mirror',
      desc: t('gentle_mirror_desc'),
      Icon: MessageCircle,
      docsPath: '/docs/gentle-mirror',
      openPath: '/mirror/dashboard',
      OpenIcon: Compass,
      docsTitle: t('read_docs'),
      openTitle: t('open_module')
    },
    {
      id: 'shining_light',
      title: t('shining_light'),
      desc: t('shining_light_desc'),
      Icon: Sun,
      docsPath: '/docs/shining-light',
      openPath: '/affirm/dashboard',
      OpenIcon: Sun,
      docsTitle: t('sl_read_docs'),
      openTitle: t('sl_open_module')
    },
    {
      id: 'fund_tracker',
      title: t('fund_tracker'),
      desc: t('fund_desc'),
      Icon: Wallet,
      docsPath: '/docs/fund-tracker',
      openPath: '/funds',
      OpenIcon: Wallet,
      docsTitle: t('read_docs'),
      openTitle: t('open_module')
    },
    {
      id: 'resource_center',
      title: t('resource_center'),
      desc: t('resource_center_desc'),
      Icon: Library,
      docsPath: '/docs/resource-center',
      openPath: '/resources',
      OpenIcon: Library,
      docsTitle: t('read_docs'),
      openTitle: t('open_module')
    },
    {
      id: 'system_requests',
      title: t('system_requests'),
      desc: t('system_requests_desc'),
      Icon: Wrench,
      docsPath: '/docs/system-requests',
      openPath: '/tickets/dashboard',
      OpenIcon: Wrench,
      docsTitle: t('read_docs'),
      openTitle: t('open_module')
    }
  ];

  // Sort modules: Ensure 'system_requests' is always the last item
  const sortedModules = [...modules].sort((a, b) => {
    if (a.id === 'system_requests') return 1;
    if (b.id === 'system_requests') return -1;
    return 0;
  });

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t('welcome_back_name')} <span style={{ color: 'var(--primary)' }}>{user?.displayName || user?.email || 'User'}</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          {t('select_module')}
        </p>
      </div>

      <div className="dashboard-modules-grid">
        {sortedModules.map(({ id, title, desc, Icon, docsPath, openPath, OpenIcon, docsTitle, openTitle }) => (
          <div key={id} style={{ textDecoration: 'none' }}>
            <div className="card module-card">
              <div className="module-card-header">
                <div className="module-card-icon" style={{ backgroundColor: 'rgba(var(--primary-rgb, 2, 132, 199), 0.15)' }}>
                  <Icon className="module-card-icon-svg" style={{ color: 'var(--primary)' }} />
                </div>
                <h2 className="module-card-title">{title}</h2>
              </div>
              <p className="module-card-desc" style={{ marginBottom: '1rem' }}>
                {desc}
              </p>
              <div className="module-card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <Link to={docsPath} className="btn btn-secondary" title={docsTitle} style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={20} />
                </Link>
                <Link to={openPath} className="btn btn-primary" title={openTitle} style={{ flex: 1, padding: '0.5rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <OpenIcon size={20} />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortalDashboard;
