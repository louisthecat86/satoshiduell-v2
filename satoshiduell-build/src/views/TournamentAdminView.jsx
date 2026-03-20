import React, { useState, useEffect, useCallback } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import {
  ArrowLeft, Users, Trophy, Crown, RefreshCw, CheckCircle2, XCircle,
  Clock, KeyRound, Copy, Share2, Eye, Gift, Shield, UserCheck, UserX,
  LayoutGrid, Timer, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import {
  fetchTournamentAdminData,
  approveRegistration,
  rejectRegistration,
  markPrizeClaimed,
  unmarkPrizeClaimed,
  createTournamentToken,
  getTournamentImageUrl,
} from '../services/supabase';
import { formatTime } from '../utils/formatters';

const TournamentAdminView = ({ tournamentId, onBack }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [generatedToken, setGeneratedToken] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    approved: true,
    redeemed: false,
    rejected: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: adminData, error } = await fetchTournamentAdminData(tournamentId);
    if (error) {
      console.error('Admin data load error:', error);
    } else {
      setData(adminData);
    }
    setLoading(false);
  }, [tournamentId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleApprove = async (regId) => {
    await approveRegistration(regId);
    await loadData();
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

  const handleGenerateToken = async () => {
    if (!data?.tournament) return;
    const { error, token } = await createTournamentToken(data.tournament.id, null, user?.username);
    if (error) {
      alert(error.message || 'Fehler');
      return;
    }
    setGeneratedToken(token);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Kopiert!');
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const identityIcon = (type) => {
    if (type === 'nostr') return '🔑';
    if (type === 'telegram') return '✈️';
    if (type === 'twitter') return '🐦';
    return '👤';
  };

  const statusColor = (status) => {
    if (status === 'registration') return 'text-orange-400';
    if (status === 'active') return 'text-green-400';
    if (status === 'finished') return 'text-neutral-400';
    if (status === 'cancelled') return 'text-red-400';
    return 'text-white';
  };

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

  const { tournament, prizes, registrations, regStats, gameStats, ranked, bracketMatches } = data;
  const inviteUrl = tournament.invite_code
    ? `https://www.satoshiduell.com/t/${tournament.invite_code}`
    : null;

  const tabs = [
    { id: 'overview', label: 'Übersicht', icon: Eye },
    { id: 'registrations', label: 'Anmeldungen', icon: Users, badge: regStats.pending > 0 ? regStats.pending : null },
    { id: 'leaderboard', label: tournament.format === 'bracket' ? 'Bracket' : 'Rangliste', icon: Trophy },
    { id: 'prizes', label: 'Preise', icon: Gift },
  ];

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
          <span className="text-sm">{identityIcon(reg.identity_type)}</span>
          <span className="text-xs font-bold text-white truncate">{reg.identity_display}</span>
          {reg.identity_verified && (
            <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">✓</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-neutral-500">
          <span>{new Date(reg.registered_at).toLocaleString()}</span>
          {reg.player_username && (
            <span className="text-purple-400">→ {reg.player_username}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2">
        {reg.status === 'pending' && (
          <>
            <button
              onClick={() => handleApprove(reg.id)}
              className="bg-green-500/20 p-2 rounded-lg hover:bg-green-500/30 transition-colors"
              title="Genehmigen"
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
            <Clock size={10} className="inline mr-1" />Wartet
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
      </div>
    </div>
  );

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
          {isExpanded ? <ChevronUp size={14} className="text-neutral-500" /> : <ChevronDown size={14} className="text-neutral-500" />}
        </button>
        {isExpanded && items.map(renderRegistrationRow)}
      </div>
    );
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative">
        {/* Header */}
        <div className="p-4 pb-2 flex items-center gap-3">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20}/>
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
              {tournament.format === 'bracket' && ' • Bracket'}
              {tournament.format === 'highscore' && ' • Highscore'}
            </p>
          </div>
          <button onClick={loadData} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <RefreshCw size={16} className={`text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        <div className="flex-1 px-4 pb-4 overflow-y-auto scrollbar-hide">

          {/* ===== OVERVIEW TAB ===== */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
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
                    <span className="text-xs font-bold text-purple-400 uppercase">Einladungscode</span>
                    <button
                      onClick={() => copyToClipboard(tournament.invite_code)}
                      className="text-purple-300 hover:text-white transition-colors"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <div className="font-mono text-lg text-white font-bold mb-2">{tournament.invite_code}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(inviteUrl)}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-1"
                    >
                      <Copy size={12} /> Link kopieren
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

              {/* Token Generation (für token-Modus) */}
              {tournament.access_level === 'token' && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-neutral-400 uppercase">Tokens vergeben</span>
                    <button
                      onClick={handleGenerateToken}
                      className="bg-purple-500 text-black text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-purple-400 transition-colors flex items-center gap-1"
                    >
                      <KeyRound size={12} /> Neuen Token generieren
                    </button>
                  </div>
                  {generatedToken && (
                    <div className="bg-black/40 border border-purple-500/30 rounded-lg p-3 flex items-center justify-between">
                      <span className="font-mono text-sm text-purple-300">{generatedToken}</span>
                      <button onClick={() => copyToClipboard(generatedToken)} className="text-purple-400 hover:text-white ml-2">
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Tournament Info */}
              <div className="bg-[#161616] border border-white/5 rounded-xl p-4">
                <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3">Details</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Format</span>
                    <span className="text-white font-bold">{tournament.format === 'highscore' ? 'Highscore' : 'Bracket'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Zugang</span>
                    <span className="text-white font-bold">
                      {tournament.access_level === 'public' ? 'Öffentlich' : tournament.access_level === 'invite' ? 'Einladungslink' : 'Token'}
                    </span>
                  </div>
                  {tournament.format === 'highscore' && (
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
                      <div className="text-right">
                        <span className="text-white font-bold">{tournament.winner}</span>
                        {tournament.winner_npub && (
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {tournament.winner_npub.slice(0, 16)}...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== REGISTRATIONS TAB ===== */}
          {activeTab === 'registrations' && (
            <div>
              {/* Stats Bar */}
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
                <div className="text-center text-neutral-500 text-sm py-10">
                  Noch keine Anmeldungen
                </div>
              ) : (
                <>
                  {renderRegistrationSection('pending', 'Ausstehend — Genehmigung nötig', 'text-orange-500')}
                  {renderRegistrationSection('approved', 'Genehmigt — Wartet auf Beitritt', 'text-green-500')}
                  {renderRegistrationSection('redeemed', 'Im Turnier', 'text-purple-500')}
                  {renderRegistrationSection('rejected', 'Abgelehnt', 'text-red-500')}
                </>
              )}
            </div>
          )}

          {/* ===== LEADERBOARD / BRACKET TAB ===== */}
          {activeTab === 'leaderboard' && (
            <div>
              {tournament.format === 'highscore' && (
                <div className="space-y-2">
                  {ranked.length === 0 ? (
                    <div className="text-center text-neutral-500 text-sm py-10">Noch keine Ergebnisse</div>
                  ) : ranked.map((entry, index) => {
                    const isWinner = tournament.winner && entry.name.toLowerCase() === tournament.winner.toLowerCase();
                    // Identität aus Registrierungen holen
                    const reg = registrations.find(r =>
                      r.player_username && r.player_username.toLowerCase() === entry.name.toLowerCase()
                    );

                    return (
                      <div
                        key={entry.key}
                        className={`flex items-center justify-between rounded-xl px-3 py-3 border ${
                          isWinner ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/5 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 text-xs text-neutral-500 font-bold text-center">{index + 1}.</div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-white truncate">{entry.name}</span>
                              {isWinner && <Crown size={12} className="text-yellow-400 flex-shrink-0" />}
                            </div>
                            {reg && (
                              <div className="text-[10px] text-neutral-500">
                                {identityIcon(reg.identity_type)} {reg.identity_display}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-neutral-300 flex-shrink-0">
                          <span className={entry.played ? 'text-white font-bold' : 'text-neutral-600'}>
                            {entry.played ? `${entry.score} Pkt` : '—'}
                          </span>
                          <span className="text-neutral-500 w-16 text-right">
                            {entry.played && entry.timeMs != null
                              ? formatTime(Math.max(0, entry.timeMs) / 1000)
                              : entry.played ? '—' : 'Ausstehend'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tournament.format === 'bracket' && (
                <div className="space-y-4">
                  {bracketMatches.length === 0 ? (
                    <div className="text-center text-neutral-500 text-sm py-10">
                      Bracket wird generiert sobald alle Plätze besetzt sind
                    </div>
                  ) : (
                    (() => {
                      // Runden gruppieren
                      const rounds = {};
                      bracketMatches.forEach(m => {
                        if (!rounds[m.round_name]) rounds[m.round_name] = [];
                        rounds[m.round_name].push(m);
                      });

                      const roundLabels = {
                        round_of_32: 'Runde der 32',
                        round_of_16: 'Achtelfinale',
                        quarter: 'Viertelfinale',
                        semi: 'Halbfinale',
                        final: 'Finale',
                      };

                      return Object.entries(rounds).map(([roundName, matches]) => (
                        <div key={roundName}>
                          <h4 className="text-[10px] font-bold text-purple-500 uppercase tracking-widest mb-2">
                            {roundLabels[roundName] || roundName}
                          </h4>
                          <div className="space-y-2">
                            {matches.map(match => (
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
                                    <div className={`text-xs font-bold ${
                                      match.winner === match.player1 ? 'text-yellow-400' : 'text-white'
                                    }`}>
                                      {match.player1 || '???'}
                                      {match.player1_score !== null && (
                                        <span className="text-neutral-400 font-normal ml-2">{match.player1_score} Pkt</span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-neutral-600 my-0.5">vs</div>
                                    <div className={`text-xs font-bold ${
                                      match.winner === match.player2 ? 'text-yellow-400' : 'text-white'
                                    }`}>
                                      {match.player2 || '???'}
                                      {match.player2_score !== null && (
                                        <span className="text-neutral-400 font-normal ml-2">{match.player2_score} Pkt</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    {match.status === 'finished' && match.winner && (
                                      <Crown size={16} className="text-yellow-400" />
                                    )}
                                    {match.status === 'ready' && (
                                      <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">Bereit</span>
                                    )}
                                    {match.status === 'active' && (
                                      <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full font-bold">Läuft</span>
                                    )}
                                    {match.status === 'pending' && (
                                      <span className="text-[9px] bg-white/10 text-neutral-500 px-2 py-1 rounded-full font-bold">Wartet</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== PRIZES TAB ===== */}
          {activeTab === 'prizes' && (
            <div className="space-y-3">
              {prizes.length === 0 ? (
                <div className="text-center text-neutral-500 text-sm py-10">Keine Preise definiert</div>
              ) : prizes.map((prize, idx) => {
                const placeEmoji = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;

                // Identität des Gewinners
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
                        <span className="text-[9px] bg-green-500/20 text-green-400 px-2 py-1 rounded-full font-bold">
                          ✓ Eingelöst
                        </span>
                      )}
                    </div>

                    {prize.description && (
                      <p className="text-[10px] text-neutral-500 mb-2">{prize.description}</p>
                    )}

                    {prize.winner_username ? (
                      <div className="bg-black/30 rounded-lg p-3 mt-2">
                        <div className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Gewinner</div>
                        <div className="flex items-center gap-2 mb-1">
                          <Crown size={12} className="text-yellow-400" />
                          <span className="text-sm font-bold text-white">{prize.winner_username}</span>
                        </div>

                        {/* Identität */}
                        {(winnerReg || prize.winner_identity_type) && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs">
                              {identityIcon(winnerReg?.identity_type || prize.winner_identity_type)}
                            </span>
                            <span className="text-xs text-neutral-300">
                              {winnerReg?.identity_display || prize.winner_identity_value || '—'}
                            </span>
                            {(winnerReg?.identity_verified) && (
                              <span className="text-[9px] text-green-400">✓ verifiziert</span>
                            )}
                          </div>
                        )}

                        {/* npub */}
                        {prize.winner_npub && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-neutral-500">🔑</span>
                            <span className="text-[10px] text-neutral-400 font-mono truncate">{prize.winner_npub}</span>
                            <button onClick={() => copyToClipboard(prize.winner_npub)} className="text-neutral-500 hover:text-white flex-shrink-0">
                              <Copy size={10} />
                            </button>
                          </div>
                        )}

                        {/* Claim Button */}
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

      {/* Generated Token Modal */}
      {generatedToken && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
          onClick={() => setGeneratedToken(null)}
        >
          <div className="bg-[#1a1a1a] border border-purple-500/30 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <KeyRound size={32} className="text-purple-400 mx-auto mb-2" />
              <h3 className="text-lg font-black text-white">Neuer Token</h3>
              <p className="text-xs text-neutral-400 mt-1">Gib diesen Token persönlich an den Teilnehmer weiter</p>
            </div>
            <div className="bg-black/40 border border-white/10 rounded-xl p-3 text-center font-mono text-purple-300 text-lg mb-4">
              {generatedToken}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { copyToClipboard(generatedToken); setGeneratedToken(null); }}
                className="flex-1 bg-purple-500 text-black font-bold py-3 rounded-xl hover:bg-purple-400 transition-colors"
              >
                Kopieren & Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </Background>
  );
};

export default TournamentAdminView;
