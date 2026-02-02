import React from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Github } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const LandingView = ({ onFinish }) => {
  const { t, setLang, lang } = useTranslation();

  return (
    <Background>
      {/* Layout geändert: justify-center und gap-8 für mittige, engere Anordnung */}
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center max-w-md mx-auto gap-8 py-12">
        
        {/* --- LOGO & TEXT BLOCK --- */}
        <div className="flex flex-col items-center shrink-0">
            {/* RIESIGES LOGO (w-72 h-72) */}
            <div className="relative mb-4">
               <img src="/logo.png" alt="Logo" className="w-72 h-72 object-contain drop-shadow-2xl" />
            </div>
            {/* RIESIGER TEXT (text-5xl) */}
            <h1 className="text-5xl font-black text-white italic tracking-tighter uppercase drop-shadow-md leading-none">
              SATOSHI<span className="text-orange-500">DUELL</span>
            </h1>
        </div>

        {/* --- INHALT BLOCK (Flaggen, Box, Button) --- */}
        <div className="w-full flex flex-col items-center gap-6 shrink-0">
          {/* --- SPRACHWAHL --- */}
          <div className="flex gap-4">
            <button 
              onClick={() => setLang('de')} 
              className={`w-12 h-8 rounded border border-white/10 overflow-hidden transition-all shadow-lg ${lang === 'de' ? 'scale-125 ring-2 ring-orange-500' : 'opacity-50 hover:scale-110 hover:opacity-100'}`} 
              title="Deutsch"
            >
              <img src="https://flagcdn.com/de.svg" alt="DE" className="w-full h-full object-cover" />
            </button>
            <button 
              onClick={() => setLang('en')} 
              className={`w-12 h-8 rounded border border-white/10 overflow-hidden transition-all shadow-lg ${lang === 'en' ? 'scale-125 ring-2 ring-orange-500' : 'opacity-50 hover:scale-110 hover:opacity-100'}`} 
              title="English"
            >
              <img src="https://flagcdn.com/gb.svg" alt="EN" className="w-full h-full object-cover" />
            </button>
            <button 
              onClick={() => setLang('es')} 
              className={`w-12 h-8 rounded border border-white/10 overflow-hidden transition-all shadow-lg ${lang === 'es' ? 'scale-125 ring-2 ring-orange-500' : 'opacity-50 hover:scale-110 hover:opacity-100'}`} 
              title="Español"
            >
              <img src="https://flagcdn.com/es.svg" alt="ES" className="w-full h-full object-cover" />
            </button>
          </div>

          {/* --- DISCLAIMER BOX --- */}
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl backdrop-blur-md w-full mx-4">
            <h3 className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-4">
              {t('welcome_disclaimer')}
            </h3>
            <p className="text-neutral-400 text-xs leading-relaxed font-medium">
              {t('welcome_text')}
            </p>
          </div>

          {/* --- ACTION BUTTON --- */}
          <Button 
            variant="primary" 
            onClick={onFinish} 
            fullWidth 
            className="py-4 text-lg font-black italic tracking-wider shadow-orange-500/20 shadow-xl mx-4"
          >
            {t('btn_understood').toUpperCase()}
          </Button>
        </div>

        {/* --- FOOTER --- */}
        <div className="opacity-50 flex items-center gap-2 text-[10px] font-bold tracking-widest text-neutral-500 uppercase mt-auto pb-4 shrink-0">
          <Github size={12} />
          OPEN SOURCE EVERYTHING
        </div>

      </div>
    </Background>
  );
};

export default LandingView;