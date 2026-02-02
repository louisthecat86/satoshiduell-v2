// components/payment/WithdrawDisplay.jsx

import React, { useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, ExternalLink, Trophy } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useCopyToClipboard } from '../../hooks/usePayment';
import Button from '../ui/Button';
import Card from '../ui/Card';

/**
 * Withdraw Display Komponente
 * Zeigt LNURL-Withdraw mit QR-Code für Gewinner
 */
const WithdrawDisplay = ({
  lnurl,
  amount,
  autoConfetti = true,
}) => {
  const { copied, copy } = useCopyToClipboard();

  useEffect(() => {
    if (autoConfetti) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [autoConfetti]);

  const handleCopy = () => {
    copy(lnurl);
  };

  const openInWallet = () => {
    window.location.href = `lightning:${lnurl}`;
  };

  return (
    <Card className="w-full max-w-md border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-yellow-500/5">
      <div className="flex flex-col items-center gap-6">
        {/* Trophy Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 mb-4">
            <Trophy size={40} className="text-white" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">
            Gewonnen! 🎉
          </h2>
          <p className="text-orange-500 font-bold text-xl">
            {amount.toLocaleString()} Sats
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl shadow-2xl">
          <QRCodeCanvas
            value={lnurl.toUpperCase()}
            size={256}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* LNURL String */}
        <div className="w-full">
          <label className="text-xs text-neutral-400 mb-2 block uppercase tracking-wider">
            LNURL-Withdraw
          </label>
          <div className="bg-black/40 p-3 rounded-xl border border-orange-500/20 break-all text-xs font-mono text-orange-400">
            {lnurl}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={openInWallet}
            className="w-full bg-gradient-to-r from-orange-500 to-yellow-500"
          >
            <ExternalLink size={16} />
            In Wallet abholen
          </Button>

          <Button
            variant="secondary"
            onClick={handleCopy}
            className="w-full"
          >
            {copied ? (
              <>
                <Check size={16} />
                Kopiert!
              </>
            ) : (
              <>
                <Copy size={16} />
                LNURL kopieren
              </>
            )}
          </Button>
        </div>

        {/* Info */}
        <p className="text-xs text-neutral-500 text-center">
          Scanne den QR-Code mit deiner Lightning Wallet oder kopiere den LNURL-Withdraw Link
        </p>
      </div>
    </Card>
  );
};

export default WithdrawDisplay;
