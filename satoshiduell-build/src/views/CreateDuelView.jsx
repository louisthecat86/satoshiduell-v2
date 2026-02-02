import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowRight, X } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';

const CreateDuelView = ({ onCancel, onConfirm }) => {
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
    onConfirm(parseInt(amount));
  };

  return (
    <Background>
      {/* ÄNDERUNG: h-[100vh] erzwingt die volle Bildschirmhöhe.
        Damit funktioniert 'justify-center' garantiert.
      */}
      <div className="flex flex-col h-[100vh] w-full max-w-md mx-auto relative overflow-hidden">
        
        {/* Close Button: Bleibt oben links kleben */}
        <div className="absolute top-6 left-4 z-50">
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white transition-colors bg-black/20 rounded-full backdrop-blur-sm">
            <X size={24} />
          </button>
        </div>

        {/* ZENTRALER INHALT */}
        {/* flex-1 nimmt allen Platz, justify-center schiebt den Inhalt vertikal in die Mitte */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full">
          
          <form onSubmit={handleConfirm} className="w-full flex flex-col items-center">
            
            {/* Titel */}
            <h2 className="text-4xl font-black text-white italic uppercase text-center mb-12 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] leading-tight">
              {t('create_title')}
            </h2>
            
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
              {t('btn_start')} <ArrowRight size={20} />
            </Button>

          </form>

        </div>
      </div>
    </Background>
  );
};

export default CreateDuelView;