import React, { useState, useEffect, useRef } from 'react';
import Background from '../components/ui/Background';
import { Loader2, CheckCircle2, Copy } from 'lucide-react';
// ZEILE GELÖSCHT: import QRCode from 'react-qr-code'; <--- Das war der Übeltäter
import { useTranslation } from '../hooks/useTranslation';
import { createInvoice, checkPaymentStatus } from '../services/lnbits';

const PaymentView = ({ amount, onPaymentSuccess }) => {
  const { t } = useTranslation();
  
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [paymentHash, setPaymentHash] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, waiting, success
  
  // WICHTIG: Dieser Ref verhindert den doppelten Aufruf!
  const invoiceRequested = useRef(false);

  // 1. Invoice erstellen (Nur einmal!)
  useEffect(() => {
    // Wenn wir schon eine Invoice angefordert haben -> Abbrechen!
    if (invoiceRequested.current === true) return;
    
    const fetchInvoice = async () => {
      invoiceRequested.current = true; // Markieren, dass wir dran sind
      console.log("⚡ Erstelle Invoice...");

      const data = await createInvoice(amount, "SatoshiDuell Einsatz");
      
      if (data && data.payment_request) {
        setPaymentRequest(data.payment_request);
        setPaymentHash(data.payment_hash);
        setStatus('waiting');
      } else {
        console.error("Fehler beim Erstellen der Invoice");
        // Falls Fehler, Ref zurücksetzen damit man es nochmal probieren könnte (optional)
        // invoiceRequested.current = false; 
      }
    };

    fetchInvoice();
  }, [amount]); // Nur ausführen, wenn sich der Betrag ändert (oder beim ersten Start)

  // 2. Status prüfen (Polling)
  useEffect(() => {
    let interval;
    if (status === 'waiting' && paymentHash) {
      interval = setInterval(async () => {
        const isPaid = await checkPaymentStatus(paymentHash);
        if (isPaid) {
          setStatus('success');
          clearInterval(interval);
          
          // Kurze Verzögerung für die Animation, dann weiter
          setTimeout(() => {
            onPaymentSuccess();
          }, 1500);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status, paymentHash, onPaymentSuccess]);

  // Copy Funktion
  const copyToClipboard = () => {
    if (paymentRequest) {
      navigator.clipboard.writeText(paymentRequest);
      alert(t('nostr_copied'));
    }
  };

  return (
    <Background>
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        
        {/* TITEL */}
        <h2 className="text-2xl font-black uppercase italic text-white mb-2">
          {status === 'success' ? t('pay_success_title') : t('pay_title')}
        </h2>
        
        <p className="text-neutral-400 mb-8 max-w-xs mx-auto">
          {status === 'success' ? t('pay_success_sub') : t('pay_subtitle')}
        </p>

        {/* CONTAINER */}
        <div className="relative bg-white p-4 rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.1)] mb-8 group transition-all duration-500">
          
          {status === 'loading' && (
            <div className="w-64 h-64 flex items-center justify-center">
              <Loader2 className="animate-spin text-neutral-400 w-12 h-12" />
            </div>
          )}

          {status === 'waiting' && paymentRequest && (
            <>
              {/* QR Code Generierung - hier nutzen wir eine API oder Library */}
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${paymentRequest}`} 
                alt="Invoice QR" 
                className="w-64 h-64 mix-blend-multiply"
              />
              
              {/* Copy Overlay */}
              <button 
                onClick={copyToClipboard}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl cursor-pointer"
              >
                <div className="bg-white text-black px-4 py-2 rounded-full font-bold flex items-center gap-2">
                   <Copy size={16} /> {t('btn_copy_invoice')}
                </div>
              </button>
            </>
          )}

          {status === 'success' && (
             <div className="w-64 h-64 flex flex-col items-center justify-center animate-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                   <CheckCircle2 size={40} className="text-black" />
                </div>
             </div>
          )}
        </div>

        {/* Amount Badge */}
        <div className="bg-[#222] px-6 py-3 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
           <span className="text-orange-500 font-black text-xl">{amount} SATS</span>
           {status === 'waiting' && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"/>}
        </div>

        {status === 'waiting' && (
           <p className="mt-8 text-xs text-neutral-500 uppercase tracking-widest animate-pulse">
             {t('pay_wait')}
           </p>
        )}

      </div>
    </Background>
  );
};

export default PaymentView;