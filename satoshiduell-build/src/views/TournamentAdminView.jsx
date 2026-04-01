import React, { useState, useEffect, useCallback } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import {
  ArrowLeft, Users, Trophy, Crown, RefreshCw, CheckCircle2, XCircle,
  Clock, KeyRound, Copy, Share2, Eye, Gift, Shield, UserCheck, UserX,
  LayoutGrid, Timer, AlertCircle, ChevronDown, ChevronUp,
  Trash2, Ban, Play, Flag, UserMinus
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import {
  fetchTournamentAdminData,
  fetchProfiles,
  approveAndAddParticipant,
  rejectRegistration,
  markPrizeClaimed,
  unmarkPrizeClaimed,
  getTournamentImageUrl,
  disqualifyTournamentPlayer,
  removeTournamentParticipant,
  deleteRegistration,
  startTournamentManually,
  finalizeTournamentManually,
} from '../services/supabase';
import { formatTime } from '../utils/formatters';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { SocialIcon } from '../components/ui/SocialIcons';

// ── Confirm Dialog ──
const ConfirmDialog = ({ title, message, confirmLabel, variant, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4" onClick={onCancel}>
    <div
      className={`bg-[#1a1a1a] border rounded-2xl p-6 max-w-sm w-full ${
        variant === 'danger' ? 'border-red-500/30' :
        variant === 'warning' ? 'border-orange-500/30' :
        'border-green-500/30'
      }`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-3">
        {variant === 'danger' && <AlertCircle size={20} className="text-red-400" />}
        {variant === 'warning' && <AlertCircle size={20} className="text-orange-400" />}
        {variant === 'success' && <CheckCircle2 size={20} className="text-green-400" />}
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      <p className="text-xs text-neutral-400 mb-5 leading-relaxed">{message}</p>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 bg-white/10 text-neutral-400 font-bold py-2.5 rounded-xl hover:bg-white/20 transition-colors text-xs">
          Abbrechen
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 font-bold py-2.5 rounded-xl transition-colors text-xs ${
            variant === 'danger' ? 'bg-red-500 text-white hover:bg-red-400' :
            variant === 'warning' ? 'bg-orange-500 text-black hover:bg-orange-400' :
            'bg-green-500 text-black hover:bg-green-400'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

// ── Toast ──
const Toast = ({ message, type }) => (
  <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[10000] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg ${
    type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-black'
  }`}>
    {message}
  </div>
);

// ── PlayerAvatar ──
const PlayerAvatar = ({ name, avatarMap, size = 'w-7 h-7' }) => (
  <div className={`${size} rounded-md border border-white/10 overflow-hidden bg-neutral-900 flex-shrink-0`}>
    <img
      src={avatarMap[(name || '').toLowerCase()] || getCryptoPunkAvatar(name)}
      alt=""
      className="w-full h-full object-cover"
      onError={(e) => { e.target.onerror = null; e.target.src = getCryptoPunkAvatar(name); }}
    />
  </div>
);

// ── CopyButton (für Kontaktinfos) ──
const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={handleCopy}
      className="bg-white/5 p-1.5 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1"
      title={label || 'Kopieren'}
    >
      <Copy size={12} className={copied ? 'text-green-400' : 'text-neutral-500'} />
      {copied && <span className="text-[9px] text-green-400 font-bold">✓</span>}
    </button>
  );
};

// ══════════════════════════════════════
// HAUPTKOMPONENTE
// ══════════════════════════════════════

const TournamentAdminView = ({ tournamentId, onBack }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    approved: true,
    redeemed: false,
    rejected: false,
  });

  // Admin Action State
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [avatarMap, setAvatarMap] = useState({});

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const runAdminAction = async (actionFn, successMsg) => {
    try {
      const result = await actionFn();
      if (result?.error) {
        showToast(result.error.message || 'Fehler', 'error');
      } else {
        showToast(successMsg);
        await loadData();
      }
    } catch (err) {
      showToast(err.message || 'Unbekannter Fehler', 'error');
    } finally {
      setActionLoading(null);
      setConfirm(null);
    }
  };

  // ── Daten laden ──
  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: adminData, error } = await fetchTournamentAdminData(tournamentId);
    if (error) {
      console.error('Admin data load error:', error);
    } else {
      setData(adminData);
      // Avatare laden
      if (adminData?.tournament?.participants?.length > 0) {
        const { data: profiles } = await fetchProfiles(adminData.tournament.participants);
        const map = {};
        (profiles || []).forEach(p => {
          if (p.username) map[p.username.toLowerCase()] = p.avatar || null;
        });
        setAvatarMap(map);
      }
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleApprove = async (reg) => {
    setActionLoading(`approve-${reg.id}`);
    await runAdminAction(
      () => approveAndAddParticipant(reg.id, user?.username),
      `${reg.identity_display} genehmigt & dem Turnier hinzugefügt`
    );
  };

  const handleReject = async (regId) => {
    await rejectRegistration(regId);
    await loadData();
  };

  const handleClaimPrize = async (prizeId, claimed) => {
    if (claimed) {
      await unmarkPrizeClaimed(prizeId);
    } else {
      await markPrizeClaimed(prizeId);
    }
    await loadData();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Kopiert!');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const statusColor = (status) => {
    if (status === 'registration') return 'text-orange-400';
    if (status === 'active') return 'text-green-400';
    if (status === 'finished') return 'text-neutral-400';
    if (status === 'cancelled') return 'text-red-400';
    return 'text-white';
  };

  // ── Round Labels (128 Support) ──
  const roundLabels = {
    round_of_128: 'Runde der 128',
    round_of_64: 'Runde der 64',
    round_of_32: 'Runde der 32',
    round_of_16: 'Achtelfinale',
    quarter: 'Viertelfinale',
    semi: 'Halbfinale',
    final: 'Finale',
  };

  // ── Loading / Error States ──
  if (loading && !data) {
    return (
      <Background>
        <div className="flex items-center justify-center h-full">
          <div className="text-neutral-500 text-sm">Lade Turnier-Daten...</div>
        </div>
      </Background>
    );
  }

  if (!data?.tournament) {
    return (
      <Background>
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <AlertCircle className="text-red-400" size={32} />
          <div className="text-neutral-400 text-sm">Turnier nicht gefunden</div>
          <button onClick={onBack} className="text-purple-400 text-sm font-bold">Zurück</button>
        </div>
      </Background>
    );
  }

  // ── Destructure Data ──
  const { tournament, prizes, registrations, regStats, gameStats, ranked, bracketMatches } = data;
  const inviteUrl = tournament.invite_code
    ? `https://www.satoshiduell.com/t/${tournament.invite_code}`
    : null;

  const isFinished = tournament.status === 'finished';
  const isRegistration = tournament.status === 'registration';
  const isActive = tournament.status === 'active';
  const isBracket = tournament.format === 'bracket';
  const isHighscore = tournament.format === 'highscore';

  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: Eye },
    { id: 'registrations', label: 'Anmeldungen', icon: Users, badge: regStats.pending > 0 ? regStats.pending : null },
    { id: 'leaderboard', label: isBracket ? 'Bracket' : 'Rangliste', icon: Trophy },
    { id: 'prizes', label: 'Preise', icon: Gift },
  ];

  // ── Helpers: DQ / Remove erlaubt? ──
  const canDisqualify = (entry) => {
    if (isFinished) return false;
    const key = (entry.name || entry.key || '').toLowerCase();
    if (isHighscore) {
      const isDQ = entry.played && entry.score === 0 && entry.timeMs === 999999999;
      return !isDQ && (isActive || isRegistration);
    }
    if (isBracket && isActive) {
      return bracketMatches.some(
        m => ['ready', 'active'].includes(m.status)
          && ((m.player1 || '').toLowerCase() === key || (m.player2 || '').toLowerCase() === key)
      );
    }
    return false;
  };

  const canRemove = (entry) => {
    if (isFinished) return false;
    if (isRegistration) return true;
    if (isHighscore && isActive && !entry.played) return true;
    return false;
  };

  // ══════════════════════════════════════
  // REGISTRATION ROW
  // ══════════════════════════════════════
  const renderRegistrationRow = (reg) => (
    <div
      key={reg.id}
      className={`flex items-center justify-between p-3 rounded-xl border mb-2 ${
        reg.status === 'pending' ? 'border-orange-500/30 bg-orange-500/5' :
        reg.status === 'approved' ? 'border-green-500/20 bg-green-500/5' :
        reg.status === 'redeemed' ? 'border-purple-500/20 bg-purple-500/5' :
        'border-red-500/20 bg-red-500/5'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SocialIcon type={reg.identity_type} size={14} />
          <span className="text-xs font-bold text-white truncate">{reg.identity_display}</span>
          {reg.identity_verified && (
            <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">✓</span>
          )}
          {/* Copy-Button für Kontaktinfo */}
          <CopyButton text={reg.identity_value || reg.identity_display} label={`${reg.identity_display} kopieren`} />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span>{new Date(reg.registered_at).toLocaleString()}</span>
          {reg.player_username && (
            <span className="text-purple-400 flex items-center gap-1">
              → <PlayerAvatar name={reg.player_username} avatarMap={avatarMap} size="w-4 h-4" /> {reg.player_username}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2">
        {reg.status === 'pending' && (
          <>
            <button
              onClick={() => handleApprove(reg)}
              className="bg-green-500/20 p-2 rounded-lg hover:bg-green-500/30 transition-colors"
              title="Genehmigen & Token generieren"
            >
              <CheckCircle2 size={16} className="text-green-400" />
            </button>
            <button
              onClick={() => handleReject(reg.id)}
              className="bg-red-500/20 p-2 rounded-lg hover:bg-red-500/30 transition-colors"
              title="Ablehnen"
            >
              <XCircle size={16} className="text-red-400" />
            </button>
          </>
        )}
        {reg.status === 'approved' && (
          <span className="text-[10px] text-green-400 font-bold px-2 py-1 bg-green-500/10 rounded-full">
            <Clock size={10} className="inline mr-1" />Token gesendet
          </span>
        )}
        {reg.status === 'redeemed' && (
          <span className="text-[10px] text-purple-400 font-bold px-2 py-1 bg-purple-500/10 rounded-full">
            <UserCheck size={10} className="inline mr-1" />Im Turnier
          </span>
        )}
        {reg.status === 'rejected' && (
          <span className="text-[10px] text-red-400 font-bold px-2 py-1 bg-red-500/10 rounded-full">
            <UserX size={10} className="inline mr-1" />Abgelehnt
          </span>
        )}

        {/* Registrierung löschen (nicht-beigetreten) */}
        {!isFinished && ['pending', 'approved', 'rejected', 'removed'].includes(reg.status) && (
          <button
            onClick={() => setConfirm({
              title: 'Registrierung löschen?',
              message: `Die Registrierung von ${reg.identity_display || reg.identity_value} wird gelöscht und der Platz freigegeben.`,
              confirmLabel: 'Löschen',
              variant: 'danger',
              onConfirm: () => {
                setActionLoading(`del-reg-${reg.id}`);
                runAdminAction(() => deleteRegistration(reg.id), 'Registrierung gelöscht');
              },
            })}
            disabled={!!actionLoading}
            className="bg-red-500/10 p-2 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Registrierung löschen"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        )}
        {/* Registrierung löschen (bereits beigetreten) */}
        {!isFinished && reg.status === 'redeemed' && (
          <button
            onClick={() => setConfirm({
              title: 'Registrierung + Teilnehmer löschen?',
              message: `${reg.identity_display} ist bereits beigetreten. Der Spieler "${reg.player_username}" wird auch aus dem Turnier entfernt.`,
              confirmLabel: 'Löschen & Entfernen',
              variant: 'danger',
              onConfirm: () => {
                setActionLoading(`del-reg-${reg.id}`);
                runAdminAction(() => deleteRegistration(reg.id), 'Registrierung gelöscht & Spieler entfernt');
              },
            })}
            disabled={!!actionLoading}
            className="bg-red-500/10 p-2 rounded-lg hover:bg-red-500/20 transition-colors"
            title="Registrierung + Teilnehmer löschen"
          >
            <Trash2 size={14} className="text-red-400" />
          </button>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════
  // REGISTRATION SECTION
  // ══════════════════════════════════════
  const renderRegistrationSection = (status, label, color) => {
    const items = registrations.filter(r => r.status === status);
    if (items.length === 0) return null;

    const isExpanded = expandedSections[status];
    return (
      <div className="mb-4">
        <button
          onClick={() => toggleSection(status)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h4 className={`text-[10px] font-bold uppercase tracking-widest ${color}`}>
            {label} ({items.length})
          </h4>
          {isExpanded
            ? <ChevronUp size={14} className="text-neutral-500" />
            : <ChevronDown size={14} className="text-neutral-500" />
          }
        </button>
        {isExpanded && items.map(renderRegistrationRow)}
      </div>
    );
  };

  // ══════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════
  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative">
        {/* Toast + Confirm */}
        {toast && <Toast message={toast.message} type={toast.type} />}
        {confirm && (
          <ConfirmDialog
            title={confirm.title}
            message={confirm.message}
            confirmLabel={confirm.confirmLabel}
            variant={confirm.variant}
            onConfirm={confirm.onConfirm}
            onCancel={() => setConfirm(null)}
          />
        )}

        {/* ── Header ── */}
        <div className="p-4 pb-2 flex items-center gap-3">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-black text-purple-500 uppercase tracking-widest truncate">
              <Shield size={14} className="inline mr-1" />
              Admin: {tournament.name}
            </h2>
            <p className={`text-xs font-bold mt-0.5 ${statusColor(tournament.status)}`}>
              {tournament.status === 'registration' ? 'Registrierung offen' :
               tournament.status === 'active' ? 'Turnier läuft' :
               tournament.status === 'finished' ? 'Beendet' : tournament.status}
              {isBracket && ' • Bracket'}
              {isHighscore && ' • Highscore'}
            </p>
          </div>
          <button onClick={loadData} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <RefreshCw size={16} className={`text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="px-4 flex gap-1 mb-3 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all relative ${
                  activeTab === tab.id
                    ? 'bg-purple-500 text-black'
                    : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {tab.badge && (
                  <span className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto scrollbar-hide">

          {/* ═══════ OVERVIEW TAB ═══════ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">

              {/* Turnier-Steuerung */}
              {!isFinished && (
                <div className="bg-[#161616] border border-purple-500/20 rounded-xl p-4">
                  <h3 className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-3">
                    ⚙️ Turnier-Steuerung
                  </h3>
                  <div className="flex gap-2 flex-wrap">
                    {isRegistration && (
                      <button
                        disabled={!!actionLoading || gameStats.totalParticipants < 2}
                        onClick={() => setConfirm({
                          title: 'Turnier jetzt starten?',
                          message: `Das Turnier wird mit ${gameStats.totalParticipants} Teilnehmern gestartet. Die Registrierung wird geschlossen.`,
                          confirmLabel: 'Jetzt starten',
                          variant: 'success',
                          onConfirm: () => {
                            setActionLoading('start');
                            runAdminAction(() => startTournamentManually(tournament.id), 'Turnier gestartet!');
                          },
                        })}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          gameStats.totalParticipants < 2
                            ? 'bg-white/5 text-neutral-600 cursor-not-allowed'
                            : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        }`}
                      >
                        <Play size={14} /> Manuell starten
                      </button>
                    )}
                    {isActive && isHighscore && (
                      <button
                        disabled={!!actionLoading}
                        onClick={() => {
                          const played = gameStats.played;
                          const notPlayed = gameStats.totalParticipants - played;
                          setConfirm({
                            title: 'Turnier jetzt beenden?',
                            message: `${played} von ${gameStats.totalParticipants} haben gespielt.${notPlayed > 0 ? ` ${notPlayed} Spieler haben NICHT gespielt.` : ''} Das Ergebnis wird sofort festgelegt.`,
                            confirmLabel: 'Jetzt beenden',
                            variant: 'warning',
                            onConfirm: () => {
                              setActionLoading('finalize');
                              runAdminAction(() => finalizeTournamentManually(tournament.id), 'Turnier beendet!');
                            },
                          });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors"
                      >
                        <Flag size={14} /> Manuell beenden
                      </button>
                    )}
                  </div>
                  {isRegistration && gameStats.totalParticipants < 2 && (
                    <p className="text-[10px] text-neutral-600 mt-2">Mindestens 2 Teilnehmer nötig.</p>
                  )}
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#161616] border border-white/5 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">Teilnehmer</div>
                  <div className="text-xl font-black text-white mt-1">
                    {gameStats.totalParticipants}
                    {gameStats.maxPlayers && <span className="text-neutral-500 text-sm">/{gameStats.maxPlayers}</span>}
                  </div>
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">Gespielt</div>
                  <div className="text-xl font-black text-green-400 mt-1">
                    {gameStats.played}
                    <span className="text-neutral-500 text-sm">/{gameStats.totalParticipants}</span>
                  </div>
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">Anmeldungen</div>
                  <div className="text-xl font-black text-orange-400 mt-1">{regStats.total}</div>
                </div>
                <div className="bg-[#161616] border border-white/5 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-neutral-500 uppercase font-bold">Ausstehend</div>
                  <div className="text-xl font-black text-yellow-400 mt-1">{regStats.pending}</div>
                </div>
              </div>

              {/* Invite Code */}
              {inviteUrl && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-purple-400 uppercase">Einladungslink</span>
                  </div>
                  <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 mb-3">
                    <p className="text-xs text-neutral-300 font-mono break-all">{inviteUrl}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(inviteUrl)}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Copy size={12} /> Kopieren
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (navigator.share) {
                            await navigator.share({ title: tournament.name, text: `Nimm teil: ${inviteUrl}`, url: inviteUrl });
                          } else {
                            copyToClipboard(inviteUrl);
                          }
                        } catch (e) { /* cancelled */ }
                      }}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Share2 size={12} /> Teilen
                    </button>
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="bg-[#161616] border border-white/5 rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Format</span>
                    <span className="text-white font-bold">{isHighscore ? 'Highscore' : 'Bracket'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Zugang</span>
                    <span className="text-white font-bold">
                      {tournament.access_level === 'public' ? 'Öffentlich' : tournament.access_level === 'invite' ? 'Einladungslink' : 'Token'}
                    </span>
                  </div>
                  {isHighscore && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Fragen</span>
                      <span className="text-white font-bold">{tournament.question_count}</span>
                    </div>
                  )}
                  {tournament.play_until && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Deadline</span>
                      <span className="text-white font-bold">{new Date(tournament.play_until).toLocaleString()}</span>
                    </div>
                  )}
                  {tournament.sponsor_name && (
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Sponsor</span>
                      <span className="text-white font-bold">{tournament.sponsor_name}</span>
                    </div>
                  )}
                  {tournament.winner && (
                    <div className="flex justify-between items-center pt-2 border-t border-white/5">
                      <span className="text-yellow-500 font-bold">Gewinner</span>
                      <div className="flex items-center gap-2">
                        <PlayerAvatar name={tournament.winner} avatarMap={avatarMap} size="w-6 h-6" />
                        <div className="text-right">
                          <span className="text-white font-bold">{tournament.winner}</span>
                          {tournament.winner_npub && (
                            <div className="text-[10px] text-neutral-500 font-mono">{tournament.winner_npub.slice(0, 16)}...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Workflow */}
              {tournament.access_level === 'invite' && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-[10px] text-neutral-500 uppercase font-bold mb-2">Workflow</p>
                  <div className="space-y-2 text-xs text-neutral-300">
                    <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">1.</span><span>Teile den Einladungslink — Interessenten registrieren sich</span></div>
                    <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">2.</span><span>Prüfe Anmeldungen im Tab "Anmeldungen"</span></div>
                    <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">3.</span><span>Genehmige → du erhältst einen Token → sende ihn an den Handle</span></div>
                    <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">4.</span><span>Teilnehmer gibt Token in der App ein → ist im Turnier</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══════ REGISTRATIONS TAB ═══════ */}
          {activeTab === 'registrations' && (
            <div>
              <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
                {[
                  { label: 'Ausstehend', count: regStats.pending, color: 'text-orange-400 bg-orange-500/10' },
                  { label: 'Genehmigt', count: regStats.approved, color: 'text-green-400 bg-green-500/10' },
                  { label: 'Eingelöst', count: regStats.redeemed, color: 'text-purple-400 bg-purple-500/10' },
                  { label: 'Abgelehnt', count: regStats.rejected, color: 'text-red-400 bg-red-500/10' },
                ].map(stat => (
                  <div key={stat.label} className={`px-3 py-2 rounded-xl text-center whitespace-nowrap ${stat.color}`}>
                    <div className="text-lg font-black">{stat.count}</div>
                    <div className="text-[9px] font-bold uppercase">{stat.label}</div>
                  </div>
                ))}
              </div>

              {registrations.length === 0 ? (
                <div className="text-center text-neutral-500 text-sm py-10">Noch keine Anmeldungen</div>
              ) : (
                <>
                  {renderRegistrationSection('pending', 'Ausstehend — Genehmigung nötig', 'text-orange-500')}
                  {renderRegistrationSection('approved', 'Genehmigt — Token gesendet, wartet auf Beitritt', 'text-green-500')}
                  {renderRegistrationSection('redeemed', 'Im Turnier', 'text-purple-500')}
                  {renderRegistrationSection('rejected', 'Abgelehnt', 'text-red-500')}
                </>
              )}
            </div>
          )}

          {/* ═══════ LEADERBOARD / BRACKET TAB ═══════ */}
          {activeTab === 'leaderboard' && (
            <div>
              {/* Highscore Rangliste */}
              {isHighscore && (
                <div className="space-y-2">
                  {ranked.length === 0 ? (
                    <div className="text-center text-neutral-500 text-sm py-10">Noch keine Ergebnisse</div>
                  ) : ranked.map((entry, index) => {
                    const isWinner = tournament.winner && entry.name.toLowerCase() === tournament.winner.toLowerCase();
                    const isDQ = entry.played && entry.score === 0 && entry.timeMs === 999999999;
                    const reg = registrations.find(r =>
                      r.player_username && r.player_username.toLowerCase() === entry.name.toLowerCase()
                    );

                    return (
                      <div
                        key={entry.key}
                        className={`flex items-center justify-between rounded-xl px-3 py-3 border ${
                          isDQ ? 'border-red-500/20 bg-red-500/5 opacity-60' :
                          isWinner ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/5 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 text-xs text-neutral-500 font-bold text-center">{index + 1}.</div>
                          <PlayerAvatar name={entry.name} avatarMap={avatarMap} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white truncate">{entry.name}</span>
                              {isWinner && <Crown size={12} className="text-yellow-400 flex-shrink-0" />}
                              {isDQ && (
                                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">DQ</span>
                              )}
                            </div>
                            {reg && (
                              <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                                <SocialIcon type={reg.identity_type} size={10} />
                                <span className="truncate">{reg.identity_display}</span>
                                <CopyButton text={reg.identity_value || reg.identity_display} />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="flex items-center gap-4 text-xs text-neutral-300">
                            <span className={entry.played ? (isDQ ? 'text-red-400' : 'text-white font-bold') : 'text-neutral-600'}>
                              {entry.played ? (isDQ ? 'DQ' : `${entry.score} Pkt`) : '—'}
                            </span>
                            <span className="text-neutral-500 w-16 text-right">
                              {entry.played && entry.timeMs != null && !isDQ
                                ? formatTime(Math.max(0, entry.timeMs) / 1000)
                                : entry.played ? '—' : 'Ausstehend'}
                            </span>
                          </div>

                          {/* Admin-Aktionen */}
                          {!isFinished && (canDisqualify(entry) || canRemove(entry)) && (
                            <div className="flex items-center gap-1 ml-2">
                              {canDisqualify(entry) && !isDQ && (
                                <button
                                  disabled={!!actionLoading}
                                  onClick={() => setConfirm({
                                    title: `${entry.name} disqualifizieren?`,
                                    message: `${entry.name} wird mit Score 0 gewertet und landet ganz unten in der Rangliste.`,
                                    confirmLabel: 'Disqualifizieren',
                                    variant: 'danger',
                                    onConfirm: () => {
                                      setActionLoading(`dq-${entry.key}`);
                                      runAdminAction(() => disqualifyTournamentPlayer(tournament.id, entry.name), `${entry.name} disqualifiziert`);
                                    },
                                  })}
                                  className="bg-red-500/10 p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                                  title="Disqualifizieren"
                                >
                                  <Ban size={12} className="text-red-400" />
                                </button>
                              )}
                              {canRemove(entry) && (
                                <button
                                  disabled={!!actionLoading}
                                  onClick={() => setConfirm({
                                    title: `${entry.name} entfernen?`,
                                    message: `${entry.name} wird aus dem Turnier entfernt. Der Platz wird wieder frei.`,
                                    confirmLabel: 'Entfernen',
                                    variant: 'danger',
                                    onConfirm: () => {
                                      setActionLoading(`rm-${entry.key}`);
                                      runAdminAction(() => removeTournamentParticipant(tournament.id, entry.name), `${entry.name} entfernt`);
                                    },
                                  })}
                                  className="bg-white/5 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                                  title="Aus Turnier entfernen"
                                >
                                  <UserMinus size={12} className="text-neutral-400" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Bracket */}
              {isBracket && (
                <div className="space-y-4">
                  {bracketMatches.length === 0 ? (
                    <div className="text-center text-neutral-500 text-sm py-10">
                      Bracket wird generiert sobald alle Plätze besetzt sind
                    </div>
                  ) : (() => {
                    const rounds = {};
                    bracketMatches.forEach(m => {
                      if (!rounds[m.round_name]) rounds[m.round_name] = [];
                      rounds[m.round_name].push(m);
                    });

                    return Object.entries(rounds).map(([roundName, matches]) => (
                      <div key={roundName}>
                        <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">
                          {roundLabels[roundName] || roundName}
                        </h4>
                        <div className="space-y-2">
                          {matches.map(match => {
                            const matchIsPlayable = ['ready', 'active'].includes(match.status);
                            const canDq = matchIsPlayable && match.player1 && match.player2 && !isFinished;

                            return (
                              <div
                                key={match.id}
                                className={`border rounded-xl p-3 ${
                                  match.status === 'finished' ? 'border-white/5 bg-white/5 opacity-60' :
                                  match.status === 'ready' ? 'border-green-500/30 bg-green-500/5' :
                                  match.status === 'active' ? 'border-yellow-500/30 bg-yellow-500/5' :
                                  'border-white/5 bg-white/5 opacity-40'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    {/* Player 1 */}
                                    <div className="flex items-center gap-1.5">
                                      {match.player1 && <PlayerAvatar name={match.player1} avatarMap={avatarMap} size="w-5 h-5" />}
                                      <span className={`text-xs font-bold ${match.winner === match.player1 ? 'text-yellow-400' : 'text-white'}`}>
                                        {match.player1 || '???'}
                                      </span>
                                      {match.player1_score !== null && (
                                        <span className="text-neutral-400 text-[10px] ml-1">{match.player1_score} Pkt</span>
                                      )}
                                      {canDq && (
                                        <button
                                          disabled={!!actionLoading}
                                          onClick={() => setConfirm({
                                            title: `${match.player1} disqualifizieren?`,
                                            message: `${match.player1} wird disqualifiziert. ${match.player2} gewinnt automatisch und das Bracket geht weiter.`,
                                            confirmLabel: 'Disqualifizieren',
                                            variant: 'danger',
                                            onConfirm: () => {
                                              setActionLoading(`dq-bracket-${match.player1}`);
                                              runAdminAction(() => disqualifyTournamentPlayer(tournament.id, match.player1), `${match.player1} disqualifiziert`);
                                            },
                                          })}
                                          className="bg-red-500/10 p-1 rounded hover:bg-red-500/20 transition-colors ml-1"
                                          title={`${match.player1} disqualifizieren`}
                                        >
                                          <Ban size={10} className="text-red-400" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-neutral-600 my-0.5 ml-7">vs</div>
                                    {/* Player 2 */}
                                    <div className="flex items-center gap-1.5">
                                      {match.player2 && <PlayerAvatar name={match.player2} avatarMap={avatarMap} size="w-5 h-5" />}
                                      <span className={`text-xs font-bold ${match.winner === match.player2 ? 'text-yellow-400' : 'text-white'}`}>
                                        {match.player2 || '???'}
                                      </span>
                                      {match.player2_score !== null && (
                                        <span className="text-neutral-400 text-[10px] ml-1">{match.player2_score} Pkt</span>
                                      )}
                                      {canDq && (
                                        <button
                                          disabled={!!actionLoading}
                                          onClick={() => setConfirm({
                                            title: `${match.player2} disqualifizieren?`,
                                            message: `${match.player2} wird disqualifiziert. ${match.player1} gewinnt automatisch und das Bracket geht weiter.`,
                                            confirmLabel: 'Disqualifizieren',
                                            variant: 'danger',
                                            onConfirm: () => {
                                              setActionLoading(`dq-bracket-${match.player2}`);
                                              runAdminAction(() => disqualifyTournamentPlayer(tournament.id, match.player2), `${match.player2} disqualifiziert`);
                                            },
                                          })}
                                          className="bg-red-500/10 p-1 rounded hover:bg-red-500/20 transition-colors ml-1"
                                          title={`${match.player2} disqualifizieren`}
                                        >
                                          <Ban size={10} className="text-red-400" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {match.status === 'finished' && match.winner && <Crown size={16} className="text-yellow-400" />}
                                    {match.status === 'ready' && <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">Bereit</span>}
                                    {match.status === 'active' && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-bold">Läuft</span>}
                                    {match.status === 'pending' && <span className="text-[9px] bg-white/10 text-neutral-500 px-2 py-1 rounded-full font-bold">Wartet</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          )}

          {/* ═══════ PRIZES TAB ═══════ */}
          {activeTab === 'prizes' && (
            <div className="space-y-3">
              {prizes.length === 0 ? (
                <div className="text-center text-neutral-500 text-sm py-10">Keine Preise definiert</div>
              ) : prizes.map((prize, idx) => {
                const placeEmoji = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                const winnerReg = registrations.find(r =>
                  prize.winner_username && r.player_username
                  && r.player_username.toLowerCase() === prize.winner_username.toLowerCase()
                );

                return (
                  <div
                    key={prize.id}
                    className={`border rounded-xl p-4 ${
                      prize.claimed ? 'border-green-500/30 bg-green-500/5' :
                      prize.winner_username ? 'border-yellow-500/30 bg-yellow-500/5' :
                      'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-lg mr-2">{placeEmoji}</span>
                        <span className="text-sm font-bold text-white">{prize.title}</span>
                      </div>
                      {prize.claimed && (
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">✓ Eingelöst</span>
                      )}
                    </div>

                    {prize.description && (
                      <p className="text-[10px] text-neutral-500 mb-2">{prize.description}</p>
                    )}

                    {prize.winner_username ? (
                      <div className="bg-black/30 rounded-lg p-3 mt-2">
                        <div className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Gewinner</div>
                        <div className="flex items-center gap-2 mb-1">
                          <PlayerAvatar name={prize.winner_username} avatarMap={avatarMap} size="w-8 h-8" />
                          <span className="text-sm font-bold text-white">{prize.winner_username}</span>
                        </div>

                        {(winnerReg || prize.winner_identity_type) && (
                          <div className="flex items-center gap-2 mb-1">
                            <SocialIcon type={winnerReg?.identity_type || prize.winner_identity_type} size={12} />
                            <span className="text-xs text-neutral-300">
                              {winnerReg?.identity_display || prize.winner_identity_value || '—'}
                            </span>
                            <CopyButton text={winnerReg?.identity_value || prize.winner_identity_value || ''} />
                          </div>
                        )}

                        {prize.winner_npub && (
                          <div className="flex items-center gap-2">
                            <SocialIcon type="nostr" size={10} />
                            <span className="text-[10px] text-neutral-400 font-mono truncate">{prize.winner_npub}</span>
                            <CopyButton text={prize.winner_npub} label="npub kopieren" />
                          </div>
                        )}

                        <button
                          onClick={() => handleClaimPrize(prize.id, prize.claimed)}
                          className={`mt-3 w-full py-2 rounded-lg text-xs font-bold transition-colors ${
                            prize.claimed
                              ? 'bg-white/10 text-neutral-400 hover:bg-white/20'
                              : 'bg-green-500 text-black hover:bg-green-400'
                          }`}
                        >
                          {prize.claimed ? 'Als nicht eingelöst markieren' : '✓ Als eingelöst markieren'}
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-neutral-600 italic mt-2">
                        Gewinner wird nach Turnier-Ende zugewiesen
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Background>
  );
};

export default TournamentAdminView;