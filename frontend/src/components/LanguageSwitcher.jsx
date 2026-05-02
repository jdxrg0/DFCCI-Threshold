import React from 'react';
import { useLanguage, LANGUAGES } from '../context/LanguageContext';

const LanguageSwitcher = ({ compact = false }) => {
  const { lang, setLang } = useLanguage();

  return (
    <div className="lang-switcher" role="group" aria-label="Language">
      {LANGUAGES.map(({ key, label }) => (
        <button
          key={key}
          className={`lang-btn${lang === key ? ' active' : ''}`}
          onClick={() => setLang(key)}
          title={label}
          aria-pressed={lang === key}
        >
          <span className="lang-label">{key.toUpperCase()}</span>
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
