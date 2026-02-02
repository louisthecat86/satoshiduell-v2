import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import Button from '../components/ui/Button';
import Background from '../components/ui/Background';
import { Fingerprint, Smartphone, Loader2 } from 'lucide-react';

const LoginView = () => {
  const { login, loading, error: authError } = useAuth();
  const { t, lang, setLang } = useTranslation();
  
  const [loginInput, setLoginInput] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [viewError, setViewError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setViewError('');

    if (loginPin.length < 4) {
      setViewError(t('login_error_pin'));
      return;
    }
    if (loginInput.length < 3) {
      setViewError(t('login_error_name'));
      return;
    }

    await login(loginInput, loginPin);
  };

  return (
    <Background>
      {/* --- SPRACHWAHL --- */}
      <div className="absolute top-6 right-6 z-50 flex gap-4">
        <button onClick={() => setLang('de')} className={`text-3xl transition-all duration-300 ${lang === 'de' ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'opacity-30 grayscale hover:opacity-100'}`}>🇩🇪</button>
        <button onClick={() => setLang('en')} className={`text-3xl transition-all duration-300 ${lang === 'en' ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'opacity-30 grayscale hover:opacity-100'}`}>🇬🇧</button>
        <button onClick={() => setLang('es')} className={`text-3xl transition-all duration-300 ${lang === 'es' ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'opacity-30 grayscale hover:opacity-100'}`}>🇪🇸</button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm flex flex-col gap-6 text-center">
          
          {/* --- LOGO --- */}
          <div className="flex flex-col items-center justify-center">
             <div className="relative mb-4">
               <div className="absolute inset-0 bg-orange-500 blur-[50px] opacity-20 rounded-full"></div>
               <img src="/logo.png" alt="Satoshi Duell" className="relative w-72 h-72 object-contain drop-shadow-2xl mx-auto" />
             </div>
             <h1 className="text-5xl font-black text-white tracking-tighter italic uppercase drop-shadow-md">
               SATOSHI<span className="text-orange-500">DUELL</span>
             </h1>
          </div>
          
          {/* --- FORM --- */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4 mt-2">
            {/* NAME INPUT - 'uppercase' wurde hier entfernt! */}
            <input 
              type="text" 
              placeholder={t('login_placeholder')} 
              value={loginInput} 
              onChange={(e) => setLoginInput(e.target.value)} 
              className="w-full p-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white outline-none focus:border-orange-500 focus:bg-black transition-all font-bold text-center shadow-lg"
            />
            {/* PIN INPUT */}
            <input 
              type="password" 
              placeholder={t('pin_placeholder')} 
              value={loginPin} 
              onChange={(e) => setLoginPin(e.target.value)} 
              className="w-full p-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white outline-none focus:border-orange-500 focus:bg-black transition-all font-bold text-center shadow-lg"
            />
         
            {(viewError || authError) && (
              <p className="text-red-500 text-xs font-bold bg-red-900/20 p-2 rounded">{viewError || authError}</p>
            )}
 
            <Button type="submit" variant="primary" disabled={loading} fullWidth className="py-4 text-lg font-black italic tracking-wider">
              {loading ? <Loader2 className="animate-spin mx-auto"/> : t('login_btn')}
            </Button>
          </form>
          
          {/* --- EXTENSIONS --- */}
          <div className="relative py-2 text-center mt-4">
            <span className="relative bg-[#1a1a1a] px-3 text-[10px] uppercase font-bold text-neutral-600 rounded">Optionen</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => alert("Bald!")} className="text-[10px] py-3 flex items-center justify-center gap-2">
              <Fingerprint size={16}/> Extension
            </Button>
            <Button variant="secondary" onClick={() => alert("Bald!")} className="text-[10px] py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center gap-2">
              <Smartphone size={16}/> Amber App
            </Button>
          </div>
        </div>
      </div>
    </Background>
  );
};

export default LoginView;