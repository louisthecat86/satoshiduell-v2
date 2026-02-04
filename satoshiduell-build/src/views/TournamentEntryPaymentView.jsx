import React, { useEffect, useRef, useState } from 'react';
import Background from '../components/ui/Background';
import { CheckCircle2, Copy, Loader2, Wallet } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useTranslation } from '../hooks/useTranslation';
import { createInvoice, checkPaymentStatus } from '../services/lnbits';
import { addTournamentParticipant } from '../services/supabase';

const TournamentEntryPaymentView = ({ tournamentId, amount, participantName, onPaymentSuccess, onCancel }) => {
  const { t } = useTranslation();
  const [paymentRequest, setPaymentRequest] = useState(null);
  const [paymentHash, setPaymentHash] = useState(null);
  const [status, setStatus] = useState('loading'); // loading, waiting, success
  const [finalizing, setFinalizing] = useState(false);

  const invoiceRequested = useRef(false);

  useEffect(() => {
    if (invoiceRequested.current) return;

    const fetchInvoice = async () => {
      invoiceRequested.current = true;
      const data = await createInvoice(amount, 'SatoshiDuell Tournament Entry Fee');

      if (data && data.payment_request) {
        setPaymentRequest(data.payment_request);
        setPaymentHash(data.payment_hash);
        setStatus('waiting');
      } else {
        alert(t('donate_error_create'));
      }
    };

    fetchInvoice();
  }, [amount, t]);

  useEffect(() => {
    let interval;
    if (status === 'waiting' && paymentHash) {
      interval = setInterval(async () => {
        const isPaid = await checkPaymentStatus(paymentHash);
        if (isPaid) {
          clearInterval(interval);
          setStatus('success');
          setFinalizing(true);

          const { error } = await addTournamentParticipant(tournamentId, participantName);
          if (error) {
            console.error('Fehler bei Turnier-Registrierung:', error);
            alert(t('donate_error_create'));
          }

          setFinalizing(false);
          setTimeout(() => {
            if (onPaymentSuccess) onPaymentSuccess();
          }, 1200);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [status, paymentHash, tournamentId, participantName, onPaymentSuccess, t]);

  const copyToClipboard = () => {
    if (paymentRequest) {
      navigator.clipboard.writeText(paymentRequest);
      const msg = t('nostr_copied') || 'Kopiert!';
      alert(msg);
    }
  };

  return (
    <Background>
      <div className="flex flex-col h-full items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-black uppercase italic text-white mb-2">
          {status === 'success' ? t('tournament_entry_payment_success') : t('tournament_entry_payment_title')}
        </h2>
        <p className="text-neutral-400 mb-8 max-w-xs mx-auto">
          {status === 'success' ? t('tournament_entry_payment_redirect') : t('tournament_entry_payment_subtitle')}
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
              {finalizing && (
                <p className="text-xs text-neutral-500">{t('tournament_entry_payment_finalize')}</p>
              )}
            </div>
          )}
        </div>

        {status === 'waiting' && paymentRequest && (
          <div className="w-full max-w-xs flex flex-col gap-3 mb-6">
            <a
              href={`lightning:${paymentRequest}`}
              className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:scale-[1.02] transition-transform py-4 rounded-xl flex items-center justify-center gap-2 text-black font-black uppercase text-sm shadow-lg"
            >
              <Wallet size={20} className="text-black" /> {t('btn_wallet')}
            </a>
          </div>
        )}

        <div className="bg-[#222] px-6 py-3 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
          <span className="text-orange-500 font-black text-xl">
            {t('tournament_entry_payment_amount')}: {amount} SATS
          </span>
          {status === 'waiting' && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
        </div>

        {status === 'waiting' && (
          <p className="mt-8 text-xs text-neutral-500 uppercase tracking-widest animate-pulse">
            {t('tournament_entry_payment_waiting')}
          </p>
        )}

        {status === 'waiting' && onCancel && (
          <button
            onClick={onCancel}
            className="mt-6 text-xs font-bold uppercase text-neutral-500 hover:text-white"
          >
            {t('btn_cancel')}
          </button>
        )}
      </div>
    </Background>
  );
};

export default TournamentEntryPaymentView;
