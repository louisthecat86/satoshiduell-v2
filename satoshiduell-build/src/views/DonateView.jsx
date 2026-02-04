import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Heart, Loader2, CheckCircle2, Wallet, ArrowRight, Zap } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { QRCodeCanvas } from 'qrcode.react'; 
import { fetchInvoiceFromLnAddress } from '../services/lnurl'; 
import confetti from 'canvas-confetti';

// Adresse aus .env
const DONATION_ADDRESS = import.meta.env.VITE_DONATION_LN_ADDRESS || "fehlt@adresse.com";

const DonateView = ({ onBack }) => {
  const { t } = useTranslation();
  
  const [amount, setAmount] = useState(''); 
  const [invoice, setInvoice] = useState(null); 
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleAmountChange = (e) => {
    const val = e.target.value;
    // Nur Zahlen erlauben
    if (val === '' || /^\d+$/.test(val)) {
        setAmount(val);
    }
  };

  const handleGenerate = async () => {
      const satAmount = parseInt(amount, 10);
      if (!satAmount || satAmount <= 0) {
          setError(t('donate_error_amount'));
          return;
      }

      setLoading(true);
      setError('');
      setInvoice(null);

      const pr = await fetchInvoiceFromLnAddress(DONATION_ADDRESS, satAmount, "Spende SatoshiDuell");
      
      if (pr) {
          setInvoice(pr);
      } else {
          setError(t('donate_error_create'));
      }
      setLoading(false);
  };

  const handleManualConfirm = () => {
      setSuccess(true);
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 }, colors: ['#FFA500', '#FF0000', '#FFFFFF'] });
      setTimeout(onBack, 3500);
  };

  if (success) {
      return (
          <Background>
              <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-in zoom-in duration-500">
                  <div className="relative mb-8">
                      <div className="absolute inset-0 bg-red-500 blur-[60px] opacity-20 rounded-full animate-pulse"></div>
                      <Heart size={100} className="text-red-500 fill-red-500 animate-bounce relative z-10" />
                  </div>
                  <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-2">
                    {t('donate_thanks_title')}
                  </h2>
                  <p className="text-neutral-400 font-medium">
                    {t('donate_thanks_text')}
                  </p>
              </div>
          </Background>
      );
  }

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto p-4 relative overflow-y-auto scrollbar-hide">
        
        {/* HEADER (Herz entfernt) */}
        <div className="flex items-center gap-4 mb-6 z-10">
            <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="text-white" size={20}/>
            </button>
            {/* Hier stand vorher das Herz-Icon */}
            <h2 className="text-xl font-black text-white uppercase tracking-widest">
               {t('dashboard_donate')}
            </h2>
        </div>

        <div className="flex-1 flex flex-col relative z-10 justify-center">
            
            {!invoice ? (
                // --- VIEW 1: EINGABE ---
                <div className="flex flex-col w-full animate-in fade-in slide-in-from-bottom-4 items-center">
                    
                    {/* TEXT / ERKLÄRUNG */}
                    <div className="text-center mb-8 px-2">
                        <div className="inline-block p-3 rounded-full bg-orange-500/10 mb-4 border border-orange-500/20">
                            <Zap size={32} className="text-orange-500 fill-orange-500/20" />
                        </div>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-wider mb-2">
                            {t('donate_intro_title')}
                        </h2>
                        <p className="text-neutral-400 text-sm font-medium leading-relaxed">
                            {t('donate_intro_text')}
                        </p>
                    </div>

                    {/* INPUT CONTAINER */}
                    <div className="relative w-full mb-2 group">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600 to-orange-400 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
                        <div className="relative flex items-center bg-[#0a0a0a] rounded-2xl border border-orange-500/50 p-1 shadow-2xl">
                            
                            <input 
                                type="text" 
                                inputMode="numeric"
                                value={amount}
                                onChange={handleAmountChange}
                                placeholder="0"
                                // WICHTIG: pr-36 (Padding Right) vergrößert, damit Zahl nicht in "SATS" läuft
                                className="w-full bg-transparent text-right pr-36 py-6 text-5xl font-black text-white placeholder-neutral-700 outline-none z-10 font-mono tracking-tighter"
                            />
                            
                            {/* VERTICAL SEPARATOR & SATS LABEL */}
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center h-10 pointer-events-none z-20">
                                <div className="w-[2px] h-full bg-neutral-700 mr-3"></div>
                                <span className="text-orange-500 font-bold text-lg tracking-widest">SATS</span>
                            </div>
                        </div>
                    </div>

                    {/* ERROR MESSAGE */}
                    {error && (
                        <p className="text-red-500 text-xs font-bold uppercase mt-4 bg-red-500/10 px-3 py-1 rounded-lg border border-red-500/20">
                            {error}
                        </p>
                    )}

                    {/* SUBMIT BUTTON */}
                    <button 
                        onClick={handleGenerate}
                        disabled={loading || !amount}
                        className="w-full mt-10 bg-[#8B4513] hover:bg-[#A0522D] text-white/90 font-black italic uppercase text-lg py-4 rounded-2xl shadow-lg border border-white/5 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" />
                        ) : (
                            <>
                                <Heart className="text-red-200 fill-red-200/20 group-hover:scale-110 transition-transform" size={20} /> 
                                {t('donate_btn')}
                                <ArrowRight className="group-hover:translate-x-1 transition-transform opacity-70" size={20} />
                            </>
                        )}
                    </button>

                </div>
            ) : (
                // --- VIEW 2: QR CODE ---
                <div className="flex-1 flex flex-col items-center animate-in zoom-in duration-300 pt-4 w-full">
                    
                    {/* INFO CARD */}
                    <div className="w-full bg-[#161616] border border-white/10 p-6 rounded-3xl flex flex-col items-center gap-6 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-red-500"></div>
                        
                        <div className="text-center">
                            <span className="block text-4xl font-black text-white mb-1">{amount}</span>
                            <span className="text-xs font-bold text-orange-500 uppercase tracking-widest">{t('donate_invoice_sub')}</span>
                        </div>

                        <div className="bg-white p-3 rounded-2xl shadow-lg">
                            <QRCodeCanvas value={`lightning:${invoice}`} size={200} />
                        </div>

                        <p className="text-[10px] text-neutral-500 text-center max-w-[200px]">
                            {t('donate_scan_hint')}
                        </p>
                    </div>

                    {/* ACTIONS */}
                    <div className="w-full mt-auto pb-4 flex flex-col gap-3">
                        <a 
                            href={`lightning:${invoice}`}
                            className="w-full bg-orange-500 hover:bg-orange-400 text-white font-black uppercase text-center py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                        >
                            <Wallet size={20}/> {t('btn_wallet')}
                        </a>
                        
                        <button 
                            onClick={handleManualConfirm} 
                            className="w-full bg-green-500/10 border border-green-500/30 hover:bg-green-500/20 text-green-400 font-black uppercase text-center py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 size={20}/> {t('btn_paid')}
                        </button>

                        <button onClick={() => setInvoice(null)} className="text-neutral-500 text-xs font-bold uppercase mt-2 hover:text-white">
                            {t('btn_cancel')}
                        </button>
                    </div>
                </div>
            )}

        </div>
      </div>
    </Background>
  );
};

export default DonateView;