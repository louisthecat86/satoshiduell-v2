import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import Button from '../components/ui/Button';
import Background from '../components/ui/Background';
import { Fingerprint, Smartphone, Loader2 } from 'lucide-react';
import { connectNostrExtension, createAmberLoginUrl, hexToNpub } from '../services/nostr';
import { validateNostrPubkey } from '../utils/validators';

const LoginView = () => {
  const { login, loginWithNpub, loading, error: authError } = useAuth();
  const { t, lang, setLang } = useTranslation();
  
  const [loginInput, setLoginInput] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [viewError, setViewError] = useState('');
  const [amberUrl, setAmberUrl] = useState('');
  const [amberCopied, setAmberCopied] = useState(false);
  const [lastNpub, setLastNpub] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('satoshi_last_npub');
    if (stored) setLastNpub(stored);

    const getParam = (params) => (
      params.get('npub') ||
      params.get('pubkey') ||
      params.get('hex') ||
      params.get('publicKey') ||
      params.get('key')
    );

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const amberParam = searchParams.get('amber');
    const rawNpub = getParam(searchParams) || getParam(hashParams) || amberParam;
    if (rawNpub) {
      try {
        const isHex64 = /^[0-9a-f]{64}$/i.test(rawNpub);
        const isHex66 = /^[0-9a-f]{66}$/i.test(rawNpub) && /^(02|03)/i.test(rawNpub);
        const isHex65 = /^[0-9a-f]{65}$/i.test(rawNpub) && /^[0-9a-f]{64}$/i.test(rawNpub.slice(1));
        const hexKey = isHex66 ? rawNpub.slice(2) : (isHex65 ? rawNpub.slice(1) : rawNpub);
        const normalized = rawNpub.startsWith('npub1') ? rawNpub : (isHex64 || isHex66 || isHex65 ? hexToNpub(hexKey) : null);
        if (!normalized) throw new Error('Ungültiger Nostr Key');
        loginWithNpub(normalized);
        window.history.replaceState({}, '', window.location.pathname);
      } catch (err) {
        setViewError(err.message || 'Ungültiger Nostr Key');
      }
    } else if (amberParam === '1') {
      const lastNpub = localStorage.getItem('satoshi_last_npub');
      if (lastNpub) {
        loginWithNpub(lastNpub);
      } else {
        setViewError(t('amber_no_key'));
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (localStorage.getItem('satoshi_amber_pending') === '1') {
      const lastNpub = localStorage.getItem('satoshi_last_npub');
      if (lastNpub) {
        loginWithNpub(lastNpub);
      } else {
        setViewError(t('amber_no_key'));
      }
      localStorage.removeItem('satoshi_amber_pending');
    }
  }, [loginWithNpub]);

  const handleLastNpubLogin = async () => {
    if (!lastNpub) return;
    setViewError('');
    await loginWithNpub(lastNpub);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setViewError('');

    const nostrCheck = validateNostrPubkey(loginInput.trim());
    if (nostrCheck.valid) {
      await loginWithNpub(loginInput.trim());
      return;
    }

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

  const handleExtensionLogin = async () => {
    setViewError('');
    try {
      const pubkeyHex = await connectNostrExtension();
      const npub = hexToNpub(pubkeyHex);
      await loginWithNpub(npub);
    } catch (err) {
      setViewError(err.message || 'Nostr Login fehlgeschlagen');
    }
  };

  const handleAmberLogin = () => {
    setViewError('');
    const callbackUrl = `${window.location.origin}${window.location.pathname}?amber=1`;
    const url = createAmberLoginUrl(callbackUrl);
    setAmberUrl(url);
    setAmberCopied(false);
    localStorage.setItem('satoshi_amber_pending', '1');
    window.location.href = url;
  };

  const handleCopyAmber = async () => {
    if (!amberUrl) return;
    try {
      await navigator.clipboard.writeText(amberUrl);
      setAmberCopied(true);
    } catch (err) {
      setViewError(err.message || 'Konnte Link nicht kopieren');
    }
  };

  return (
    <Background allowScroll>
      {/* --- SPRACHWAHL --- */}
      <div className="absolute top-6 right-6 z-50 flex gap-4">
        <button onClick={() => setLang('de')} className={`text-3xl transition-all duration-300 ${lang === 'de' ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'opacity-30 grayscale hover:opacity-100'}`}>🇩🇪</button>
        <button onClick={() => setLang('en')} className={`text-3xl transition-all duration-300 ${lang === 'en' ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'opacity-30 grayscale hover:opacity-100'}`}>🇬🇧</button>
        <button onClick={() => setLang('es')} className={`text-3xl transition-all duration-300 ${lang === 'es' ? 'scale-125 drop-shadow-[0_0_15px_rgba(255,255,255,0.6)]' : 'opacity-30 grayscale hover:opacity-100'}`}>🇪🇸</button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-screen p-4 overflow-y-auto">
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
            <Button variant="secondary" onClick={handleExtensionLogin} className="text-[10px] py-3 flex items-center justify-center gap-2">
              <Fingerprint size={16}/> {t('btn_nostr_ext')}
            </Button>
            <Button variant="secondary" onClick={handleAmberLogin} className="text-[10px] py-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center gap-2">
              <Smartphone size={16}/> {t('btn_amber_app')}
            </Button>
          </div>

          {lastNpub && (
            <Button variant="secondary" onClick={handleLastNpubLogin} className="text-[10px] py-3 mt-2">
              {t('btn_last_npub')}
            </Button>
          )}

          {amberUrl && (
            <div className="mt-3 text-xs text-neutral-400 bg-black/30 border border-white/10 rounded-xl p-3">
              <p className="mb-2">{t('amber_hint')}</p>
              <div className="flex gap-2">
                <a href={amberUrl} className="flex-1">
                  <Button variant="secondary" fullWidth className="py-2 text-[10px]">
                    {t('amber_open')}
                  </Button>
                </a>
                <Button variant="secondary" onClick={handleCopyAmber} className="py-2 text-[10px]">
                  {amberCopied ? t('nostr_copied') : t('amber_copy')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Background>
  );
};

export default LoginView;