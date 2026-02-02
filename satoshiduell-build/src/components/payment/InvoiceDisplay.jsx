// components/payment/InvoiceDisplay.jsx

import React from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { useCopyToClipboard } from '../../hooks/usePayment';
import Button from '../ui/Button';
import Card from '../ui/Card';

/**
 * Invoice Display Komponente
 * Zeigt Lightning Invoice mit QR-Code
 */
const InvoiceDisplay = ({
  invoice,
  amount,
  isChecking = false,
  onManualCheck,
  onCancel,
}) => {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = () => {
    copy(invoice);
  };

  const openInWallet = () => {
    window.location.href = `lightning:${invoice}`;
  };

  return (
    <Card className="w-full max-w-md">
      <div className="flex flex-col items-center gap-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">
            Lightning Invoice
          </h2>
          <p className="text-neutral-400 text-sm">
            Zahle {amount.toLocaleString()} Sats
          </p>
        </div>

        {/* QR Code */}
        <div className="bg-white p-4 rounded-xl">
          <QRCodeCanvas
            value={invoice}
            size={256}
            level="M"
            includeMargin={false}
          />
        </div>

        {/* Invoice String */}
        <div className="w-full">
          <div className="bg-black/40 p-3 rounded-xl border border-white/10 break-all text-xs font-mono text-neutral-400">
            {invoice}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3">
          <Button
            variant="primary"
            onClick={openInWallet}
            className="w-full"
          >
            <ExternalLink size={16} />
            In Wallet öffnen
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
                Invoice kopieren
              </>
            )}
          </Button>

          {onManualCheck && (
            <Button
              variant="secondary"
              onClick={onManualCheck}
              disabled={isChecking}
              className="w-full"
            >
              {isChecking ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Prüfe...
                </>
              ) : (
                'Zahlung manuell prüfen'
              )}
            </Button>
          )}

          {onCancel && (
            <Button
              variant="ghost"
              onClick={onCancel}
              className="w-full text-neutral-500 hover:text-white"
            >
              Abbrechen
            </Button>
          )}
        </div>

        {/* Status */}
        {isChecking && (
          <div className="flex items-center gap-2 text-orange-500 text-sm">
            <Loader2 className="animate-spin" size={16} />
            <span>Warte auf Zahlung...</span>
          </div>
        )}
      </div>
    </Card>
  );
};

export default InvoiceDisplay;
