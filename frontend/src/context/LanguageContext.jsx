/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react';
import { translations } from '../data/i18n';

const LanguageContext = createContext();

// English is the only supported language.
export const LANG = 'en';

// Earlier builds let users pick Filipino or Conyo and persisted the choice.
// Clear the stale key so nothing carries a dead language forward.
try {
  localStorage.removeItem('app-language');
} catch {
  /* storage unavailable — nothing to clean up */
}

export const LanguageProvider = ({ children }) => {
  const t = (key) => translations[LANG]?.[key] ?? key;

  return (
    <LanguageContext.Provider value={{ lang: LANG, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
