// hooks/usePayment.js

import { useState, useEffect, useRef } from 'react';
import { 
  createInvoice, 
  checkInvoiceStatus, 
  createWithdrawLink,
  checkWithdrawStatus 
} from '../services/lnbits';
import { validateSatoshiAmount } from '../utils/validators';

/**
 * Custom Hook für Payment-Logik
 */
export const usePayment = () => {
  const [invoice, setInvoice] = useState({ req: '', hash: '', amount: 0 });
  const [withdrawLink, setWithdrawLink] = useState('');
  const [withdrawId, setWithdrawId] = useState('');
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isCreatingWithdraw, setIsCreatingWithdraw] = useState(false);
  const [error, setError] = useState('');

  const checkIntervalRef = useRef(null);

  /**
   * Erstellt eine Lightning Invoice
   */
  const generateInvoice = async (amount, memo = 'SatoshiDuell Deposit') => {
    setIsCreatingInvoice(true);
    setError('');

    try {
      // Validierung
      const validation = validateSatoshiAmount(amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const result = await createInvoice(amount, memo);

      setInvoice({
        req: result.payment_request,
        hash: result.payment_hash,
        amount: amount,
      });

      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  /**
   * Startet automatisches Prüfen der Invoice
   */
  const startPaymentCheck = (paymentHash, onPaid) => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
    }

    setIsCheckingPayment(true);

    checkIntervalRef.current = setInterval(async () => {
      try {
        const result = await checkInvoiceStatus(paymentHash);
        
        if (result.paid) {
          clearInterval(checkIntervalRef.current);
          setIsCheckingPayment(false);
          
          if (onPaid) {
            onPaid();
          }
        }
      } catch (e) {
        console.error('Payment check error:', e);
      }
    }, 2000); // Alle 2 Sekunden prüfen
  };

  /**
   * Stoppt automatisches Prüfen
   */
  const stopPaymentCheck = () => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    setIsCheckingPayment(false);
  };

  /**
   * Manuelle Prüfung der Invoice
   */
  const checkPaymentManually = async (paymentHash) => {
    try {
      const result = await checkInvoiceStatus(paymentHash);
      return result.paid;
    } catch (e) {
      console.error('Manual payment check error:', e);
      return false;
    }
  };

  /**
   * Erstellt einen Withdraw Link
   */
  const generateWithdrawLink = async (amount, duelId) => {
    setIsCreatingWithdraw(true);
    setError('');

    try {
      const result = await createWithdrawLink(
        amount, 
        duelId
      );

      setWithdrawLink(result.lnurl);
      setWithdrawId(result.id);

      return result;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsCreatingWithdraw(false);
    }
  };

  /**
   * Prüft ob Withdraw eingelöst wurde
   */
  const checkWithdrawClaimed = async (withdrawId) => {
    try {
      const result = await checkWithdrawStatus(withdrawId);
      return result.used;
    } catch (e) {
      console.error('Withdraw check error:', e);
      return false;
    }
  };

  /**
   * Reset aller Payment States
   */
  const resetPayment = () => {
    stopPaymentCheck();
    setInvoice({ req: '', hash: '', amount: 0 });
    setWithdrawLink('');
    setWithdrawId('');
    setError('');
  };

  // Cleanup beim Unmount
  useEffect(() => {
    return () => {
      stopPaymentCheck();
    };
  }, []);

  return {
    // State
    invoice,
    withdrawLink,
    withdrawId,
    isCheckingPayment,
    isCreatingInvoice,
    isCreatingWithdraw,
    error,

    // Methods
    generateInvoice,
    startPaymentCheck,
    stopPaymentCheck,
    checkPaymentManually,
    generateWithdrawLink,
    checkWithdrawClaimed,
    resetPayment,
  };
};

/**
 * Hook für Copy-to-Clipboard mit Feedback
 */
export const useCopyToClipboard = (resetDelay = 2000) => {
  const [copied, setCopied] = useState(false);

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, resetDelay);

      return true;
    } catch (e) {
      console.error('Copy failed:', e);
      return false;
    }
  };

  return { copied, copy };
};
