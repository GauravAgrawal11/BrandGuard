import React, { createContext, useContext, useState, useEffect } from 'react';
import { TRANSLATIONS } from '../i18n/translations';

const LanguageContext = createContext(null);

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
];

export function LanguageProvider({ children }) {
  const [currentLang, setCurrentLang] = useState(() => {
    return localStorage.getItem('brandguard_lang') || 'en';
  });

  useEffect(() => {
    localStorage.setItem('brandguard_lang', currentLang);
    document.documentElement.setAttribute('lang', currentLang);
  }, [currentLang]);

  const t = (key, fallback = '') => {
    const langDict = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];
    if (langDict && langDict[key] !== undefined) {
      return langDict[key];
    }
    const defaultDict = TRANSLATIONS['en'];
    if (defaultDict && defaultDict[key] !== undefined) {
      return defaultDict[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language: currentLang,
        setLanguage: setCurrentLang,
        languages: SUPPORTED_LANGUAGES,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
