import { useState, useEffect } from 'react';
import { TRANSLATIONS } from '../utils/translations';

export const useTranslation = () => {
  // Standard-Sprache Deutsch
  const [lang, setLang] = useState('de');

  // Beim Start: Schauen, ob Sprache schon gespeichert war
  useEffect(() => {
    const savedLang = localStorage.getItem('satoshi_lang');
    if (savedLang && TRANSLATIONS[savedLang]) {
      setLang(savedLang);
    }
  }, []);

  // Sprache ändern und speichern
  const changeLanguage = (newLang) => {
    if (TRANSLATIONS[newLang]) {
      setLang(newLang);
      localStorage.setItem('satoshi_lang', newLang);
    }
  };

  // Die Funktion zum Text holen: t('login_btn')
  const t = (key, params = {}) => {
    let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['de']?.[key] || key;
    
    // Ersetzt Platzhalter wie {amount} oder {url}
    Object.keys(params).forEach(param => {
      text = text.replace(`{${param}}`, params[param]);
    });

    return text;
  };

  return { t, lang, setLang: changeLanguage };
};