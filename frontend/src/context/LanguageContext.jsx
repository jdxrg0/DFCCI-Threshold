import React, { createContext, useContext, useState } from 'react';
import { translations } from '../data/i18n';

const LanguageContext = createContext();

export const LANGUAGES = [
  { key: 'en',    label: 'English' },
  { key: 'fil',   label: 'Filipino' },
  { key: 'conyo', label: 'Conyo'   },
];

export const LanguageProvider = ({ children }) => {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('app-language') || 'en'
  );

  const setLang = (key) => {
    setLangState(key);
    localStorage.setItem('app-language', key);
  };

  const t = (key) => translations[lang]?.[key] ?? translations['en']?.[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
