import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowRight, X, Swords } from 'lucide-react'; // Swords Icon dazu
import { useTranslation } from '../hooks/useTranslation';

// NEU: targetPlayer Prop hinzugefügt
const CreateDuelView = ({ onCancel, onConfirm, targetPlayer }) => {
  const { t } = useTranslation();
  const [amount, setAmount] = useState(''); 

  const handleInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 1 && val.startsWith('0')) val = val.substring(1);
    if (Number(val) > 9999) val = '9999';
    setAmount(val);
  };

  const handleConfirm = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) === 0) return;
    
    // Wir übergeben hier den Betrag UND den targetPlayer (falls vorhanden)
    // Damit die App.jsx weiß, dass es eine Challenge ist.
    onConfirm(parseInt(amount), targetPlayer);
  };

  // Hilfsfunktion zum Kürzen langer Namen
  const formatName = (name) => {
    if (!name) return '';
    if (name.length > 16) return `${name.substring(0, 6)}...${name.slice(-4)}`;
    return name;
  };

  return (
    <Background>
      <div className="flex flex-col h-[100vh] w-full max-w-md mx-auto relative overflow-hidden">
        
        {/* Close Button */}
        <div className="absolute top-6 left-4 z-50">
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white transition-colors bg-black/20 rounded-full backdrop-blur-sm">
            <X size={24} />
          </button>
        </div>

        {/* ZENTRALER INHALT */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full">
          
          <form onSubmit={handleConfirm} className="w-full flex flex-col items-center">
            
            {/* Titel */}
            <h2 className="text-4xl font-black text-white italic uppercase text-center mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] leading-tight">
              {targetPlayer ? 'CHALLENGE' : t('create_title')}
            </h2>

            {/* NEU: Anzeige des Gegners, falls vorhanden */}
            {targetPlayer && (
              <div className="mb-8 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mb-2">GEGEN</div>
                  <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden border border-white/20">
                          <img 
                             src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${targetPlayer}`} 
                             alt={targetPlayer} 
                             className="w-full h-full object-cover" 
                          />
                      </div>
                      <span className="text-white font-black text-lg uppercase tracking-wider">
                          {formatName(targetPlayer)}
                      </span>
                  </div>
              </div>
            )}
            
            {/* Input Feld Container */}
            <div className="relative w-full max-w-[320px] group mb-2">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600 to-orange-400 rounded-2xl opacity-40 blur transition duration-200 group-focus-within:opacity-80"></div>
              
              <div className="relative flex items-center bg-[#0a0a0a] rounded-xl px-4 py-5 border border-orange-500/30 group-focus-within:border-orange-500 transition-colors">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={handleInputChange}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-transparent text-5xl font-black text-white outline-none placeholder-neutral-800 text-right pr-3 tracking-wider"
                />
                <span className="text-xl font-bold text-orange-500 pt-2 w-16">SATS</span>
              </div>
            </div>

            {/* Hinweis Text */}
            <div className="w-full max-w-[320px] text-right mb-10 pr-2">
              <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                {t('create_max_hint')}
              </span>
            </div>

            {/* Button */}
            <Button 
              type="submit"
              variant="primary" 
              disabled={!amount || Number(amount) === 0}
              className="w-full max-w-[320px] py-4 text-lg font-black italic tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-all transform active:scale-95"
            >
              {targetPlayer ? (
                 <> <Swords size={20} className="mr-1"/> HERAUSFORDERN </> 
              ) : (
                 <> {t('btn_start')} <ArrowRight size={20} /> </>
              )}
            </Button>

          </form>

        </div>
      </div>
    </Background>
  );
};

export default CreateDuelView;