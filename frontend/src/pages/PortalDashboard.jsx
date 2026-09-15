import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Compass, BookOpen, Wrench, Sun, Wallet, Library, Gamepad2, BookHeart, Flame, Clock, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as users from '../services/users';
import { renderAvatarHelper } from '../utils/avatarHelper';


const dailyVerses = [
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you.", ref: "Jeremiah 29:11" },
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged.", ref: "Joshua 1:9" },
  { text: "Cast all your anxiety on Him because He cares for you.", ref: "1 Peter 5:7" },
  { text: "The joy of the Lord is your strength.", ref: "Nehemiah 8:10" },
  { text: "But those who hope in the Lord will renew their strength.", ref: "Isaiah 40:31" },
  { text: "And we know that in all things God works for the good of those who love Him.", ref: "Romans 8:28" },
  { text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.", ref: "Psalm 34:18" },
  { text: "Do not be anxious about anything, but in every situation, by prayer and petition, present your requests to God.", ref: "Philippians 4:6" },
  { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "For God so loved the world that He gave His one and only Son.", ref: "John 3:16" },
  { text: "The Lord is my light and my salvation — whom shall I fear?", ref: "Psalm 27:1" },
  { text: "His mercies are new every morning; great is Your faithfulness.", ref: "Lamentations 3:23" },
  { text: "Delight yourself in the Lord, and He will give you the desires of your heart.", ref: "Psalm 37:4" },
  { text: "Be still, and know that I am God.", ref: "Psalm 46:10" },
  { text: "God is our refuge and strength, an ever-present help in trouble.", ref: "Psalm 46:1" },
  { text: "The Lord your God is with you, the Mighty Warrior who saves.", ref: "Zephaniah 3:17" },
  { text: "He has made everything beautiful in its time.", ref: "Ecclesiastes 3:11" },
  { text: "Let us not become weary in doing good, for at the proper time we will reap a harvest.", ref: "Galatians 6:9" },
  { text: "If God is for us, who can be against us?", ref: "Romans 8:31" },
  { text: "The name of the Lord is a fortified tower; the righteous run to it and are safe.", ref: "Proverbs 18:10" },
  { text: "Wait for the Lord; be strong and take heart and wait for the Lord.", ref: "Psalm 27:14" },
  { text: "You are the light of the world. A town built on a hill cannot be hidden.", ref: "Matthew 5:14" },
  { text: "Create in me a pure heart, O God, and renew a steadfast spirit within me.", ref: "Psalm 51:10" },
  { text: "For where two or three gather in my name, there am I with them.", ref: "Matthew 18:20" },
  { text: "Every good and perfect gift is from above, coming down from the Father of lights.", ref: "James 1:17" },
  { text: "Love is patient, love is kind. It does not envy, it does not boast.", ref: "1 Corinthians 13:4" },
  { text: "This is the day the Lord has made; let us rejoice and be glad in it.", ref: "Psalm 118:24" },
  { text: "Draw near to God, and He will draw near to you.", ref: "James 4:8" },
];

function getDailyVerse() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  return dailyVerses[dayOfYear % dailyVerses.length];
}

const PortalDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const verse = getDailyVerse();

  const getFirstName = () => {
    const name = user?.displayName || user?.email || '';
    if (!name) return 'User';
    if (name.includes('@')) {
      return name.split('@')[0];
    }
    return name.trim().split(/\s+/)[0];
  };


  useEffect(() => {
    users.getDashboardStats()
      .then(setStats)
      .catch(err => console.error('Failed to load dashboard stats:', err));
  }, []);

  const modules = [
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
      id: 'devotional_tracker',
      title: t('devo_title'),
      desc: t('devo_desc'),
      Icon: BookHeart,
      docsPath: '/docs/devotional-tracker',
      openPath: '/devotionals',
      OpenIcon: BookHeart,
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
      id: 'games',
      title: t('games'),
      desc: t('games_desc'),
      Icon: Gamepad2,
      docsPath: '/docs/games',
      openPath: '/games',
      OpenIcon: Gamepad2,
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

  if (user?.role === 'ADMIN') {
    // Insert Automation Hub after Devotional Tracker (index 1 -> so insert at index 2)
    const devoIndex = modules.findIndex(m => m.id === 'devotional_tracker');
    const insertIndex = devoIndex !== -1 ? devoIndex + 1 : modules.length;
    
    modules.splice(insertIndex, 0, {
      id: 'automation_hub',
      title: 'Automation Hub',
      desc: 'Manage scheduled group messages and personalized role reminders.',
      Icon: Clock,
      docsPath: '/docs/automation-hub',
      openPath: '/admin/automation',
      OpenIcon: Clock,
      docsTitle: t('read_docs') || 'Read Docs',
      openTitle: t('open_module') || 'Open Module'
    });
  }

  const statPills = [
    { icon: Wallet, value: stats ? `₱${stats.fundBalance.toLocaleString()}` : '—', label: 'Fund' },
    { icon: Flame, value: stats?.devotionStreak ?? '—', label: 'Devotion Streak' },
  ];

  return (
    <div className="portal-shell">
      {/* ── Hero band: Welcome + Verse ── */}
      <div className="dashboard-hero-row animate-stagger" style={{ animationDelay: '0s' }}>
        <div className="dashboard-hero-card">
          <div className="dashboard-hero-welcome-wrapper">
            <Link to="/settings" className="dashboard-hero-avatar-glow" title={t('profile_settings')}>
              {renderAvatarHelper(user, 64, {
                width: 'var(--hero-avatar-size, 64px)',
                height: 'var(--hero-avatar-size, 64px)',
                fontSize: 'calc(var(--hero-avatar-size, 64px) * 0.45)'
              })}
            </Link>
            <div className="dashboard-hero-welcome-text">
              <h1 className="dashboard-hero-title">
                {t('welcome_back_name')} <span className="text-gradient">{getFirstName()}</span>
              </h1>
              <p className="dashboard-hero-subtitle">
                {t('select_module')}
              </p>
            </div>
          </div>
        </div>
        <div className="dashboard-verse-card">
          <p className="verse-text">"{verse.text}"</p>
          <span className="verse-ref">— {verse.ref}</span>
        </div>
      </div>

      {/* ── Quick Stats Pills ── */}
      <div className="quick-stats-grid animate-stagger" style={{ animationDelay: '0.1s' }}>
        {statPills.map(({ icon: StatIcon, value, label }) => (
          <div key={label} className="stat-pill">
            <StatIcon size={14} className="stat-pill-icon" />
            <span className="stat-pill-value">{value}</span>
            <span className="stat-pill-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ── Modules Grid ── */}
      <h2 className="dashboard-section-title animate-stagger" style={{ animationDelay: '0.2s' }}>
        <Compass size={24} style={{ color: 'var(--primary)' }} />
        Explore Modules
      </h2>
      
      <div className="dashboard-modules-grid">
        {modules.map(({ id, title, desc, Icon, docsPath, openPath, docsTitle, openTitle }, index) => (
          <div key={id} className="module-card animate-stagger" style={{ animationDelay: `${0.25 + (index * 0.05)}s` }}>
            <div className="module-card-header">
              <div className="module-card-icon">
                <Icon className="module-card-icon-svg" />
              </div>
              <h2 className="module-card-title">{title}</h2>
            </div>
            <p className="module-card-desc">
              {desc}
            </p>
            <div className="module-card-actions">
              <Link to={docsPath} className="module-action-btn action-docs" title={docsTitle} aria-label={docsTitle}>
                <BookOpen size={18} />
              </Link>
              <Link to={openPath} className="module-action-btn action-open" title={openTitle}>
                <span className="module-action-label">{openTitle}</span>
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PortalDashboard;
