import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { TRANSLATIONS } from '../utils/translations';

const TranslationContext = createContext(null);

export const TranslationProvider = ({ children }) => {
  const [lang, setLang] = useState('de');

  useEffect(() => {
    const savedLang = localStorage.getItem('satoshi_lang');
    if (savedLang && TRANSLATIONS[savedLang]) {
      setLang(savedLang);
    }
  }, []);

  const changeLanguage = (newLang) => {
    if (TRANSLATIONS[newLang]) {
      setLang(newLang);
      localStorage.setItem('satoshi_lang', newLang);
    }
  };

  const t = (key, params = {}) => {
    let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['de']?.[key] || key;

    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });

    return text;
  };

  const value = useMemo(() => ({ t, lang, setLang: changeLanguage }), [lang]);

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const ctx = useContext(TranslationContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within TranslationProvider');
  }
  return ctx;
};