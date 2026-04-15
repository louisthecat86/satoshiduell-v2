import React, { useState, useEffect } from 'react';
import { 
  X, Loader2, RefreshCw, Copy, Check, Zap, Clock, 
  Trophy, AlertTriangle, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { getPaymentDetails } from '../../services/lnbits';

// ==========================================
// HELPERS
// ==========================================
const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

const formatMs = (ms) => {
  if (ms === null || ms === undefined) return '-';
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-1 rounded hover:bg-white/10 text-neutral-500 hover:text-white transition-all shrink-0">
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
    </button>
  );
};

const InfoRow = ({ label, value, mono, copyable, className = '' }) => (
  <div className={`flex items-start justify-between gap-2 py-1.5 ${className}`}>
    <span className="text-[11px] text-neutral-500 uppercase font-bold shrink-0">{label}</span>
    <div className="flex items-center gap-1 min-w-0">
      <span className={`text-[12px] text-neutral-200 text-right truncate ${mono ? 'font-mono' : ''}`}>
        {value || '-'}
      </span>
      {copyable && value && value !== '-' && <CopyButton text={value} />}
    </div>
  </div>
);

const StatusPill = ({ status }) => {
  const styles = {
    'open': 'bg-green-500/20 text-green-400 border-green-500/30',
    'active': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'finished': 'bg-neutral-700 text-neutral-300 border-neutral-600',
    'pending_payment': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'cancelled': 'bg-red-500/20 text-red-400 border-red-500/30'
  };
  const labels = {
    'open': 'Wartet auf Gegner',
    'active': 'Spiel läuft',
    'finished': 'Beendet',
    'pending_payment': 'Zahlung ausstehend',
    'cancelled': 'Abgebrochen'
  };
  return (
    <span className={`px-3 py-1 rounded-lg text-xs uppercase font-black border ${styles[status] || styles['finished']}`}>
      {labels[status] || status}
    </span>
  );
};

const PaymentStatusBadge = ({ status }) => {
  if (!status) return <span className="text-[10px] text-neutral-600">—</span>;
  if (status === 'loading') return <Loader2 size={12} className="animate-spin text-neutral-500" />;
  if (status === 'paid') return <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-bold border border-green-500/30">BEZAHLT</span>;
  if (status === 'pending') return <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/30">AUSSTEHEND</span>;
  if (status === 'expired') return <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">ABGELAUFEN</span>;
  return <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">FEHLER</span>;
};

// ==========================================
// PAYMENT DETAIL SECTION (collapsible)
// ==========================================
const PaymentDetailSection = ({ title, paymentHash, paidAt, icon }) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState(null);

  const fetchDetails = async () => {
    if (!paymentHash) return;
    setLoading(true);
    const result = await getPaymentDetails(paymentHash);
    setDetails(result);
    setLoading(false);
  };

  useEffect(() => {
    if (expanded && !details && paymentHash) {
      fetchDetails();
    }
  }, [expanded]);

  const getStatus = () => {
    if (!paymentHash) return null;
    if (loading) return 'loading';
    if (details?.paid) return 'paid';
    if (details?.pending) return 'pending';
    if (details && !details.paid) return 'expired';
    return paidAt ? 'paid' : 'pending';
  };

  return (
    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-white uppercase">{title}</span>
          <PaymentStatusBadge status={getStatus()} />
        </div>
        {expanded ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1 border-t border-white/5">
          <InfoRow label="Payment Hash" value={paymentHash} mono copyable />
          <InfoRow label="Bezahlt am" value={formatDateTime(paidAt)} />
          
          {loading && <div className="flex items-center gap-2 py-2 text-neutral-500 text-xs"><Loader2 size={12} className="animate-spin" /> LNbits wird abgefragt...</div>}
          
          {details && !details.error && (
            <>
              <div className="border-t border-white/5 mt-2 pt-2">
                <div className="text-[10px] font-bold text-orange-400 uppercase mb-1 flex items-center gap-1">
                  <Zap size={10} /> LNbits Details
                </div>
                <InfoRow label="Status" value={details.paid ? '✅ Bezahlt' : details.pending ? '⏳ Ausstehend' : '❌ Nicht bezahlt'} />
                <InfoRow label="Betrag" value={details.amount ? `${Math.abs(details.amount / 1000)} Sats` : '-'} />
                {details.fee !== undefined && details.fee !== null && <InfoRow label="Fee" value={`${Math.abs(details.fee / 1000)} Sats`} />}
                <InfoRow label="Memo" value={details.memo} />
                <InfoRow label="Preimage" value={details.preimage} mono copyable />
                {details.bolt11 && (
                  <div className="mt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-neutral-500 uppercase font-bold">Invoice (BOLT11)</span>
                      <CopyButton text={details.bolt11} />
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 break-all bg-black/40 p-2 rounded-lg mt-1 max-h-20 overflow-y-auto">
                      {details.bolt11}
                    </div>
                  </div>
                )}
                {details.time && <InfoRow label="Erstellt" value={formatDateTime(new Date(details.time * 1000).toISOString())} />}
                {details.expiry && <InfoRow label="Ablauf" value={formatDateTime(new Date(details.expiry * 1000).toISOString())} />}
              </div>
            </>
          )}

          {details?.error && (
            <div className="flex items-center gap-2 py-2 text-red-400 text-xs">
              <AlertTriangle size={12} /> Fehler: {details.error}
            </div>
          )}

          {paymentHash && (
            <button onClick={fetchDetails} disabled={loading} className="mt-2 flex items-center gap-1 text-[10px] text-orange-400 hover:text-orange-300 transition-colors">
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} /> Neu abfragen
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ==========================================
// PAYOUT SECTION
// ==========================================
const PayoutSection = ({ game }) => {
  const hasWithdraw = game.withdraw_link || game.withdraw_id;
  
  return (
    <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={14} className="text-yellow-400" />
        <span className="text-xs font-bold text-white uppercase">Auszahlung</span>
        {game.is_claimed ? (
          <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/20 text-green-400 font-bold border border-green-500/30">ABGEHOLT</span>
        ) : hasWithdraw ? (
          <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold border border-yellow-500/30">OFFEN</span>
        ) : (
          <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-700 text-neutral-400 font-bold border border-neutral-600">KEIN LINK</span>
        )}
      </div>
      
      <InfoRow label="Gewinner" value={game.winner || '-'} />
      <InfoRow label="Auszahlbetrag" value={game.payout_amount ? `${game.payout_amount} Sats` : `${(game.amount || 0) * 2} Sats (Pot)`} />
      <InfoRow label="Withdraw ID" value={game.withdraw_id} mono copyable />
      {game.withdraw_link && (
        <div className="mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-neutral-500 uppercase font-bold">LNURL Withdraw</span>
            <CopyButton text={game.withdraw_link} />
          </div>
          <div className="text-[10px] font-mono text-neutral-400 break-all bg-black/40 p-2 rounded-lg mt-1 max-h-16 overflow-y-auto">
            {game.withdraw_link}
          </div>
        </div>
      )}
      <InfoRow label="Abgeholt" value={game.is_claimed ? 'Ja ✅' : 'Nein ❌'} />
    </div>
  );
};

// ==========================================
// ARENA PARTICIPANTS SECTION
// ==========================================
const ArenaParticipantsSection = ({ game }) => {
  const participants = Array.isArray(game.participants) ? game.participants : [];
  const scores = game.participant_scores || {};
  const times = game.participant_times || {};
  const paidAt = game.participant_paid_at || {};
  const hashes = game.participant_payment_hashes || {};
  const refundClaimed = game.refund_claimed || {};

  if (participants.length === 0) return null;

  return (
    <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Zap size={14} className="text-purple-400" />
        <span className="text-xs font-bold text-white uppercase">Arena Teilnehmer ({participants.length}/{game.max_players || '∞'})</span>
      </div>
      
      {participants.map((player, idx) => (
        <div key={player} className="bg-black/30 border border-white/10 rounded-lg p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{idx + 1}. {player}</span>
            <div className="flex items-center gap-2">
              {scores[player] !== undefined && (
                <span className="text-xs text-orange-400 font-bold">{scores[player]}/10</span>
              )}
              {times[player] !== undefined && (
                <span className="text-[10px] text-neutral-400">{formatMs(times[player])}</span>
              )}
              {player === game.winner && (
                <Trophy size={12} className="text-yellow-400" />
              )}
            </div>
          </div>
          <PaymentDetailSection
            title={`Zahlung ${player}`}
            paymentHash={hashes[player]}
            paidAt={paidAt[player]}
            icon={<Zap size={12} className="text-yellow-400" />}
          />
          {refundClaimed[player] && (
            <div className="text-[10px] text-orange-400 font-bold px-2 py-1 bg-orange-500/10 rounded">
              ↩ Refund abgeholt
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ==========================================
// SCORE SECTION (Duel)
// ==========================================
const DuelScoreSection = ({ game }) => {
  const creatorWins = game.status === 'finished' && game.creator_score !== null && game.challenger_score !== null && (
    game.creator_score > game.challenger_score || 
    (game.creator_score === game.challenger_score && game.creator_time < game.challenger_time)
  );
  const challengerWins = game.status === 'finished' && game.creator_score !== null && game.challenger_score !== null && !creatorWins;
  const isDraw = game.status === 'finished' && game.creator_score === game.challenger_score && game.creator_time === game.challenger_time;

  return (
    <div className="bg-black/30 border border-white/5 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={14} className="text-orange-400" />
        <span className="text-xs font-bold text-white uppercase">Ergebnis</span>
      </div>
      
      <div className="grid grid-cols-3 gap-2 text-center">
        {/* Creator */}
        <div className={`p-3 rounded-xl border ${creatorWins && !isDraw ? 'border-green-500/30 bg-green-500/10' : 'border-white/5 bg-black/20'}`}>
          <div className="text-xs text-neutral-400 uppercase mb-1">Creator</div>
          <div className="text-sm font-bold text-white">{game.creator || '-'}</div>
          <div className="text-2xl font-black text-orange-400 mt-1">
            {game.creator_score !== null && game.creator_score !== undefined ? game.creator_score : '-'}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">{formatMs(game.creator_time)}</div>
          {creatorWins && !isDraw && <div className="text-[10px] text-green-400 font-bold mt-1">🏆 GEWINNER</div>}
        </div>
        
        {/* VS */}
        <div className="flex items-center justify-center">
          <span className="text-neutral-600 font-black text-lg">VS</span>
        </div>
        
        {/* Challenger */}
        <div className={`p-3 rounded-xl border ${challengerWins && !isDraw ? 'border-green-500/30 bg-green-500/10' : 'border-white/5 bg-black/20'}`}>
          <div className="text-xs text-neutral-400 uppercase mb-1">Challenger</div>
          <div className="text-sm font-bold text-white">{game.challenger || '-'}</div>
          <div className="text-2xl font-black text-orange-400 mt-1">
            {game.challenger_score !== null && game.challenger_score !== undefined ? game.challenger_score : '-'}
          </div>
          <div className="text-[10px] text-neutral-500 mt-1">{formatMs(game.challenger_time)}</div>
          {challengerWins && !isDraw && <div className="text-[10px] text-green-400 font-bold mt-1">🏆 GEWINNER</div>}
        </div>
      </div>
      
      {isDraw && <div className="text-center text-xs text-yellow-400 font-bold mt-2">🤝 UNENTSCHIEDEN</div>}
    </div>
  );
};

// ==========================================
// MAIN MODAL
// ==========================================
const GameDetailModal = ({ game, onClose }) => {
  if (!game) return null;

  const isArena = game.mode === 'arena';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#111] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/5 bg-[#161616]">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-black text-lg uppercase tracking-wider flex items-center gap-2">
              <Zap size={18} className="text-orange-500" />
              {isArena ? 'ARENA' : 'DUELL'} DETAILS
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        {/* BODY - scrollbar */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          
          {/* BASIC INFO */}
          <div className="bg-black/30 border border-white/5 rounded-xl p-3 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white uppercase">Spielinfo</span>
              <StatusPill status={game.status} />
            </div>
            <InfoRow label="Game ID" value={game.id} mono copyable />
            <InfoRow label="Modus" value={isArena ? `Arena (${game.max_players || '?'} Spieler)` : 'Duell (1v1)'} />
            <InfoRow label="Einsatz" value={`${game.amount} Sats pro Spieler`} />
            <InfoRow label="Pot" value={`${game.current_pot || (game.amount * (isArena ? (game.participants?.length || 0) : 2))} Sats`} />
            {game.target_player && <InfoRow label="Ziel-Spieler" value={game.target_player} />}
            <InfoRow label="Erstellt" value={formatDateTime(game.created_at)} />
            {game.updated_at && <InfoRow label="Aktualisiert" value={formatDateTime(game.updated_at)} />}
          </div>

          {/* SCORES */}
          {!isArena && (game.creator_score !== null || game.challenger_score !== null) && (
            <DuelScoreSection game={game} />
          )}

          {/* ARENA PARTICIPANTS */}
          {isArena && <ArenaParticipantsSection game={game} />}

          {/* DUEL PAYMENT: CREATOR */}
          {!isArena && (
            <PaymentDetailSection
              title={`Creator: ${game.creator || '?'}`}
              paymentHash={game.creator_payment_hash}
              paidAt={game.creator_paid_at}
              icon={<Zap size={12} className="text-green-400" />}
            />
          )}

          {/* DUEL PAYMENT: CHALLENGER */}
          {!isArena && game.challenger && (
            <PaymentDetailSection
              title={`Challenger: ${game.challenger || '?'}`}
              paymentHash={game.challenger_payment_hash}
              paidAt={game.challenger_paid_at}
              icon={<Zap size={12} className="text-blue-400" />}
            />
          )}

          {/* PAYOUT / WITHDRAW */}
          {(game.status === 'finished' || game.withdraw_link || game.withdraw_id || game.is_claimed) && (
            <PayoutSection game={game} />
          )}

          {/* REFUND INFO (for cancelled duels) */}
          {game.status === 'cancelled' && (
            <div className="bg-black/30 border border-red-500/20 rounded-xl p-3 space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-xs font-bold text-red-300 uppercase">Abgebrochen / Refund</span>
              </div>
              {game.refund_claimed && typeof game.refund_claimed === 'object' && (
                Object.entries(game.refund_claimed).map(([player, claimed]) => (
                  <InfoRow key={player} label={player} value={claimed ? 'Refund abgeholt ✅' : 'Refund offen ⏳'} />
                ))
              )}
              {game.is_claimed !== undefined && (
                <InfoRow label="Claimed" value={game.is_claimed ? 'Ja' : 'Nein'} />
              )}
            </div>
          )}

          {/* RAW JSON (collapsible for debugging) */}
          <RawDataSection game={game} />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// RAW DATA (for debugging)
// ==========================================
const RawDataSection = ({ game }) => {
  const [expanded, setExpanded] = useState(false);

  // Strip questions array from display (too large)
  const displayData = { ...game };
  if (displayData.questions) {
    displayData.questions = `[${displayData.questions.length} Fragen]`;
  }

  return (
    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-bold text-neutral-500 uppercase">Rohdaten (Debug)</span>
        {expanded ? <ChevronUp size={12} className="text-neutral-500" /> : <ChevronDown size={12} className="text-neutral-500" />}
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-white/5">
          <pre className="text-[10px] font-mono text-neutral-400 whitespace-pre-wrap break-all bg-black/40 p-2 rounded-lg mt-2 max-h-60 overflow-y-auto">
            {JSON.stringify(displayData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default GameDetailModal;
