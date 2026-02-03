import React, { useState, useEffect, useRef } from 'react';
import Background from '../components/ui/Background';
import { Loader2, CheckCircle2, Copy, Wallet, PlayCircle } from 'lucide-react'; 
import { QRCodeCanvas } from 'qrcode.react';
import { useTranslation } from '../hooks/useTranslation';
import { createInvoice, checkPaymentStatus } from '../services/lnbits';

const PaymentView = ({ amount, onPaymentSuccess }) => {
  const { t } = useTranslation();
  
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [paymentHash, setPaymentHash] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, waiting, success, ready_to_start
  
  const invoiceRequested = useRef(false);

  // 1. Invoice erstellen
  useEffect(() => {
    if (invoiceRequested.current === true) return;
    
    const fetchInvoice = async () => {
      invoiceRequested.current = true;
      const data = await createInvoice(amount, "SatoshiDuell Einsatz");
      
      if (data && data.payment_request) {
        setPaymentRequest(data.payment_request);
        setPaymentHash(data.payment_hash);
        setStatus('waiting');
      } else {
        console.error("Fehler beim Erstellen der Invoice");
      }
    };

    fetchInvoice();
  }, [amount]); 

  // 2. Status prüfen (Polling)
  useEffect(() => {
    let interval;
    if (status === 'waiting' && paymentHash) {
      interval = setInterval(async () => {
        const isPaid = await checkPaymentStatus(paymentHash);
        if (isPaid) {
          clearInterval(interval);
          setStatus('success'); // Zeigt den grünen Haken
          
          // Nach kurzer Animation (1.5s) wechseln wir zum "Bereit"-Screen
          setTimeout(() => {
            setStatus('ready_to_start'); 
          }, 1500);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status, paymentHash]);

  // Copy Funktion
  const copyToClipboard = () => {
    if (paymentRequest) {
      navigator.clipboard.writeText(paymentRequest);
      // Fallback falls nostr_copied nicht da ist, nutzen wir eine generische Meldung
      const msg = t('nostr_copied') || "Kopiert!"; 
      alert(msg);
    }
  };

  return (
    <Background>
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        
        {/* --- SCREEN 1: WARTEN / BEZAHLT --- */}
        {status !== 'ready_to_start' && (
          <>
            <h2 className="text-2xl font-black uppercase italic text-white mb-2">
              {status === 'success' ? t('pay_success_title') : t('pay_title')}
            </h2>
            
            <p className="text-neutral-400 mb-8 max-w-xs mx-auto">
              {status === 'success' ? t('pay_success_sub') : t('pay_subtitle')}
            </p>

            <div className="relative bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-6 group transition-all duration-500">
              
              {status === 'loading' && (
                <div className="w-64 h-64 flex items-center justify-center">
                  <Loader2 className="animate-spin text-neutral-400 w-12 h-12" />
                </div>
              )}

              {status === 'waiting' && paymentRequest && (
                <div className="flex flex-col gap-4">
                     <div className="flex justify-center">
                        <QRCodeCanvas value={`lightning:${paymentRequest}`} size={220} />
                     </div>
                     <button 
                        onClick={copyToClipboard}
                        className="absolute top-4 right-4 bg-black/5 hover:bg-black/10 p-2 rounded-lg transition-colors"
                     >
                        <Copy size={16} className="text-black/50" />
                     </button>
                </div>
              )}

              {status === 'success' && (
                 <div className="w-64 h-64 flex flex-col items-center justify-center animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                       <CheckCircle2 size={40} className="text-black" />
                    </div>
                 </div>
              )}
            </div>

            {status === 'waiting' && paymentRequest && (
                <div className="w-full max-w-xs flex flex-col gap-3 mb-6">
                    <a 
                        href={`lightning:${paymentRequest}`}
                        className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:scale-[1.02] transition-transform py-4 rounded-xl flex items-center justify-center gap-2 text-black font-black uppercase text-sm shadow-lg"
                    >
                        <Wallet size={20} className="text-black"/> {t('btn_wallet')}
                    </a>
                </div>
            )}

            <div className="bg-[#222] px-6 py-3 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
               <span className="text-orange-500 font-black text-xl">{amount} SATS</span>
               {status === 'waiting' && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"/>}
            </div>

            {status === 'waiting' && (
               <p className="mt-8 text-xs text-neutral-500 uppercase tracking-widest animate-pulse">
                 {t('pay_wait')}
               </p>
            )}
          </>
        )}

        {/* --- SCREEN 2: BEREIT ZUM START (Manueller Klick) --- */}
        {status === 'ready_to_start' && (
            <div className="animate-in slide-in-from-bottom-8 duration-500 flex flex-col items-center">
                
                <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500 mb-6 shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                    <CheckCircle2 size={48} className="text-green-500"/>
                </div>

                <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
                    {t('pre_game_title')}
                </h2>
                
                <p className="text-neutral-300 max-w-xs mb-10 leading-relaxed text-sm">
                    {t('pre_game_text')}
                </p>

                <button 
                    onClick={onPaymentSuccess} // Startet erst jetzt das Spiel
                    className="w-full min-w-[200px] bg-gradient-to-r from-green-500 to-emerald-600 hover:scale-105 transition-all py-5 rounded-2xl shadow-xl flex items-center justify-center gap-3 group"
                >
                    <PlayCircle size={28} className="text-white fill-white/20 group-hover:scale-110 transition-transform"/>
                    <span className="text-white font-black uppercase text-xl tracking-widest">
                        {t('btn_ready')}
                    </span>
                </button>
            </div>
        )}

      </div>
    </Background>
  );
};

export default PaymentView;