import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Trophy, Users, Calendar, Crown, RefreshCw, Trash2, KeyRound, Timer, Share2, Shield, LayoutGrid, Link2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { addTournamentParticipant, createTournamentToken, deleteTournament, fetchTournaments, fetchTournamentPrizes, finalizeTournamentIfReady, redeemTournamentToken, redeemRegistrationToken, getTournamentImageUrl } from '../services/supabase';
import { formatTime } from '../utils/formatters';

const TournamentsView = ({ onBack, onCreateTournament, onStartTournament, onOpenAdmin, onOpenRegistration }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedPrizes, setSelectedPrizes] = useState([]);
  const [localCanCreate, setLocalCanCreate] = useState(user?.can_create_tournaments || false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [joinModal, setJoinModal] = useState(null);
  const [joinToken, setJoinToken] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [generatedToken, setGeneratedToken] = useState(null);

  useEffect(() => {
    if (user?.username) {
      refreshUser(user.username);
    }
  }, []);

  useEffect(() => {
    setLocalCanCreate(user?.can_create_tournaments || false);
  }, [user?.can_create_tournaments]);

  const loadTournaments = async () => {
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await fetchTournaments();
    if (error) {
      console.error('Fehler beim Laden der Turniere:', error);
      setErrorMsg(t('donate_error_create'));
      setLoading(false);
      return;
    }
    setTournaments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // Preise laden wenn Turnier ausgewählt wird
  useEffect(() => {
    if (!selectedTournament) {
      setSelectedPrizes([]);
      return;
    }
    const loadPrizes = async () => {
      const { data } = await fetchTournamentPrizes(selectedTournament.id);
      setSelectedPrizes(data || []);
    };
    loadPrizes();
  }, [selectedTournament?.id]);

  useEffect(() => {
    if (!selectedTournament) return;
    if (selectedTournament.status === 'finished') return;
    if (!selectedTournament.play_until) return;

    finalizeTournamentIfReady(selectedTournament.id).then(({ data }) => {
      if (data) {
        setSelectedTournament(data);
        setTournaments(prev => prev.map(tour => (tour.id === data.id ? data : tour)));
      }
    });
  }, [selectedTournament?.id]);

  const canDeleteTournament = (tournament) => {
    if (!user) return false;
    if (user.is_admin === true) return true;
    if (tournament.creator?.toLowerCase() === user.username?.toLowerCase()) return true;
    return false;
  };

  const isCreator = (tournament) => {
    if (!user || !tournament) return false;
    return tournament.creator?.toLowerCase() === user.username?.toLowerCase();
  };

  const handleDeleteTournament = async (tournamentId) => {
    const { error } = await deleteTournament(tournamentId);
    if (error) {
      console.error('Delete error:', error);
      alert(t('donate_error_create'));
      return;
    }
    setDeleteConfirm(null);
    setSelectedTournament(null);
    await loadTournaments();
  };

  const isParticipant = (tournament) => {
    if (!tournament || !user?.username) return false;
    return (tournament.participants || []).some(
      (p) => (p || '').toLowerCase() === user.username.toLowerCase()
    );
  };

  const canJoinTournament = (tournament) => {
    if (!tournament) return false;
    if (!user) return false;
    if (isParticipant(tournament)) return false;
    if (!['registration', 'active'].includes(tournament.status)) return false;
    if (tournament.max_players && tournament.current_participants >= tournament.max_players) return false;
    if (tournament.play_until && new Date(tournament.play_until) <= new Date()) return false;
    return true;
  };

  const handleJoinTournament = async (tournament) => {
    if (!user) {
      alert(t('tournament_join_login'));
      return;
    }
    if (!canJoinTournament(tournament)) return;

    // Invite-Modus: Registration-Flow öffnen
    if (tournament.access_level === 'invite' && onOpenRegistration) {
      onOpenRegistration(tournament.id, tournament.invite_code);
      return;
    }

    // Token-Modus: Token-Eingabe
    if (tournament.access_level === 'token') {
      setJoinToken('');
      setJoinError('');
      setJoinModal({ tournament });
      return;
    }

    // Public: Direkt beitreten
    setJoinLoading(true);
    const { data, error } = await addTournamentParticipant(tournament.id, user.username);
    setJoinLoading(false);

    if (error) {
      console.error('Join error:', error);
      alert(t('tournament_join_error'));
      return;
    }

    if (data) {
      setSelectedTournament(data);
      setTournaments(prev => prev.map(tour => (tour.id === data.id ? data : tour)));
    }
    await loadTournaments();
  };

  const handleRedeemToken = async () => {
    if (!joinModal?.tournament) return;
    if (!joinToken.trim()) {
      setJoinError(t('tournament_join_token_required'));
      return;
    }

    setJoinLoading(true);
    setJoinError('');

    // Versuche zuerst als Registration-Token, dann als alten Token
    let result = await redeemRegistrationToken(joinModal.tournament.id, joinToken.trim(), user?.username);

    if (result.error) {
      // Fallback: alter Token-Flow
      result = await redeemTournamentToken(joinModal.tournament.id, joinToken.trim(), user?.username);
    }

    setJoinLoading(false);

    if (result.error) {
      console.error('Token redeem error:', result.error);
      setJoinError(t('tournament_join_token_invalid'));
      return;
    }

    if (result.data) {
      setSelectedTournament(result.data);
      setTournaments(prev => prev.map(tour => (tour.id === result.data.id ? result.data : tour)));
    }
    await loadTournaments();
    setJoinModal(null);
  };

  const handleGenerateToken = async (tournament) => {
    if (!tournament || !user) return;
    const { error, token } = await createTournamentToken(tournament.id, null, user.username);
    if (error) {
      console.error('Token creation error:', error);
      if ((error.message || '').includes('Token-Limit')) {
        alert(t('tournament_token_limit'));
      } else {
        alert(t('tournament_token_error'));
      }
      return;
    }
    setGeneratedToken({ tournamentId: tournament.id, token });
  };

  const statusLabel = (status) => {
    if (status === 'registration') return t('tournament_status_registration');
    if (status === 'active') return t('tournament_status_active');
    if (status === 'finished') return t('tournament_status_finished');
    if (status === 'cancelled') return 'Abgesagt';
    return status;
  };

  const formatBadge = (format) => {
    if (format === 'bracket') return 'Bracket';
    return 'Highscore';
  };

  const visibleTournaments = localCanCreate
    ? tournaments
    : tournaments.filter(tournament => ['registration', 'active', 'finished'].includes(tournament.status));

  const getPlayUntil = (tournament) => tournament?.play_until || null;

  const formatPlayUntil = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const questionCount = (tournament) => tournament?.question_count || 0;
  const maxPlayersLabel = (tournament) => (
    tournament?.max_players ? tournament.max_players : t('tournament_unlimited')
  );

  const accessLabel = (tournament) => {
    if (tournament?.access_level === 'token') return t('tournament_access_token');
    if (tournament?.access_level === 'invite') return 'Einladungslink';
    return t('tournament_access_public');
  };

  const hasPlayed = (tournament) => {
    if (!tournament || !user?.username) return false;
    const scores = tournament.participant_scores || {};
    const key = user.username.toLowerCase();
    return scores[key] !== undefined && scores[key] !== null;
  };

  const canStartTournament = (tournament) => {
    if (!tournament) return false;
    if (!isParticipant(tournament)) return false;
    if (hasPlayed(tournament)) return false;
    if (tournament.play_until && new Date(tournament.play_until) <= new Date()) return false;
    return true;
  };

  const canShareTournament = (tournament) => {
    if (!tournament || !user) return false;
    if (user.is_admin === true) return true;
    if (tournament.creator?.toLowerCase() === user.username?.toLowerCase()) return true;
    return false;
  };

  const getResultsList = (tournament) => {
    const participants = Array.isArray(tournament?.participants) ? tournament.participants : [];
    const scores = tournament?.participant_scores || {};
    const times = tournament?.participant_times || {};

    const rows = participants.map((name) => {
      const key = (name || '').toLowerCase();
      const score = scores[key];
      const timeMs = times[key];
      const played = score !== undefined && score !== null;
      return { name, key, score: played ? score : null, timeMs: played ? timeMs : null, played };
    });

    rows.sort((a, b) => {
      if (a.played !== b.played) return a.played ? -1 : 1;
      if (!a.played && !b.played) return a.name.localeCompare(b.name);
      if (a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
      const aTime = a.timeMs ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.timeMs ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.name.localeCompare(b.name);
    });

    return rows;
  };

  const formatTournamentTime = (timeMs) => {
    if (timeMs === null || timeMs === undefined) return '-';
    return formatTime(Math.max(0, timeMs) / 1000);
  };

  const buildShareText = (tournament) => {
    const url = tournament.invite_code
      ? `https://www.satoshiduell.com/t/${tournament.invite_code}`
      : 'https://www.satoshiduell.com';
    const access = accessLabel(tournament);
    const description = (tournament?.description || '').trim();

    const lines = [
      t('tournament_share_title', { name: tournament?.name || '-' }),
      description ? t('tournament_share_line_desc', { description }) : null,
      `Format: ${formatBadge(tournament.format)}`,
      t('tournament_share_line_access', { access }),
      t('tournament_share_line_url', { url })
    ].filter(Boolean);

    return lines.join('\n');
  };

  const handleShareTournament = async (tournament) => {
    if (!tournament) return;
    const title = t('tournament_share_title', { name: tournament.name || '' });
    const text = buildShareText(tournament);
    const url = tournament.invite_code
      ? `https://www.satoshiduell.com/t/${tournament.invite_code}`
      : 'https://www.satoshiduell.com';

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${title}\n${text}`.trim());
        alert(t('tournament_share_copied'));
        return;
      }
      alert(t('tournament_share_unavailable'));
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const carbonStyle = {
    backgroundImage: [
      'linear-gradient(120deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 35%, rgba(0,0,0,0) 60%)',
      'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)',
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, rgba(0,0,0,0.05) 2px 4px)',
      'repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0 2px, rgba(0,0,0,0.03) 2px 4px)'
    ].join(', ')
  };

  const renderModals = () => (
    <>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-black text-white uppercase">{t('tournament_delete_confirm_title')}</h3>
              <p className="text-neutral-400 text-sm">
                {t('tournament_delete_confirm_text', { name: deleteConfirm.name })}
              </p>
              <p className="text-xs text-red-400">
                {t('tournament_delete_confirm_warning')}
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all"
                >
                  {t('btn_cancel')}
                </button>
                <button 
                  onClick={() => handleDeleteTournament(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  {t('tournament_delete_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {joinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <h3 className="text-xl font-black text-white uppercase">{t('tournament_join_token_title')}</h3>
                <p className="text-neutral-400 text-sm">{t('tournament_join_token_hint')}</p>
              </div>

              <input
                type="text"
                value={joinToken}
                onChange={(e) => setJoinToken(e.target.value)}
                placeholder={t('tournament_join_token_placeholder')}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
              />

              {joinError && (
                <div className="text-xs text-red-400 font-bold text-center">{joinError}</div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setJoinModal(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all"
                >
                  {t('btn_cancel')}
                </button>
                <button
                  onClick={handleRedeemToken}
                  disabled={joinLoading}
                  className="flex-1 px-4 py-3 rounded-xl bg-purple-500 text-black font-bold hover:bg-purple-400 transition-all disabled:opacity-60"
                >
                  {t('tournament_join_token_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {generatedToken && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-purple-500/20 rounded-full flex items-center justify-center border-2 border-purple-500">
                <KeyRound className="text-purple-400" size={28} />
              </div>
              <h3 className="text-xl font-black text-white uppercase">{t('tournament_token_generated_title')}</h3>
              <p className="text-neutral-400 text-sm">{t('tournament_token_generated_hint')}</p>

              <div className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm">
                {generatedToken.token}
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedToken.token);
                    alert(t('nostr_copied') || 'Kopiert!');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all"
                >
                  {t('btn_copy_withdraw')}
                </button>
                <button
                  onClick={() => setGeneratedToken(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-purple-500 text-black font-bold hover:bg-purple-400 transition-all"
                >
                  {t('btn_done')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ============================================
  // DETAIL VIEW (wenn ein Turnier ausgewählt ist)
  // ============================================
  if (selectedTournament) {
    const isWinner = Boolean(selectedTournament.winner)
      && selectedTournament.winner.toLowerCase() === user?.username?.toLowerCase();
    const resultsList = getResultsList(selectedTournament);

    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
          <div className="flex items-center justify-between gap-4 mb-6 pt-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedTournament(null)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
                <ArrowLeft className="text-white" size={20}/>
              </button>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-widest">
                  {t('tournament_list_title')}
                </h2>
                <p className="text-xs text-neutral-500 mt-1">{selectedTournament.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Admin Button für Creator */}
              {(isCreator(selectedTournament) || user?.is_admin) && onOpenAdmin && (
                <button
                  onClick={() => onOpenAdmin(selectedTournament.id)}
                  className="bg-purple-500/20 p-2 rounded-xl hover:bg-purple-500/30 transition-colors border border-purple-500/50"
                  title="Admin Dashboard"
                >
                  <Shield className="text-purple-400" size={20}/>
                </button>
              )}
              {canDeleteTournament(selectedTournament) && (
                <button 
                  onClick={() => setDeleteConfirm({ id: selectedTournament.id, name: selectedTournament.name })}
                  className="bg-red-500/20 p-2 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/50"
                  title={t('tournament_delete_btn')}
                >
                  <Trash2 className="text-red-400" size={20}/>
                </button>
              )}
            </div>
          </div>

          <div className="px-4 mb-6">
            {(() => {
              const imageUrl = selectedTournament.image_url || getTournamentImageUrl(selectedTournament.image_path);
              if (!imageUrl) return null;
              return (
                <div className="mb-4 h-40 rounded-2xl border border-white/10 overflow-hidden relative">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${imageUrl})`,
                      backgroundSize: '130%',
                      backgroundPosition: 'center',
                      filter: 'blur(2px)',
                      transform: 'scale(1.05)'
                    }}
                  />
                  <div className="absolute inset-0 bg-black/20" />
                </div>
              );
            })()}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest ml-1">{t('tournament_status_label')}</h3>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  selectedTournament.format === 'bracket'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {selectedTournament.format === 'bracket' ? '🏟️ Bracket' : '📊 Highscore'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_question_count_label')}</div>
                  <div className="text-lg font-black text-white">{questionCount(selectedTournament)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_participants')}</div>
                  <div className="text-lg font-black text-white">{selectedTournament.current_participants}/{maxPlayersLabel(selectedTournament)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_status_label')}</div>
                  <div className="text-lg font-black text-green-400">{statusLabel(selectedTournament.status)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_access_label')}</div>
                  <div className="text-lg font-black text-white">{accessLabel(selectedTournament)}</div>
                </div>
              </div>
              {selectedTournament.play_until && (
                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-neutral-300">
                  <Timer size={14} className="text-orange-400" />
                  {t('tournament_play_until_label')}: {formatPlayUntil(getPlayUntil(selectedTournament))}
                </div>
              )}
              {selectedTournament.sponsor_name && (
                <div className="mt-3 text-center text-[11px] text-neutral-300">
                  Sponsor: <span className="font-bold text-white">{selectedTournament.sponsor_name}</span>
                </div>
              )}
              {selectedTournament.access_level === 'token' && selectedTournament.contact_info && (
                <div className="mt-2 text-center text-[11px] text-neutral-400">
                  {t('tournament_contact_label')}: {selectedTournament.contact_info}
                </div>
              )}
              {selectedTournament.description && (
                <p className="mt-4 text-xs text-neutral-400 text-center">{selectedTournament.description}</p>
              )}
            </div>
          </div>

          {/* Preise */}
          {selectedPrizes.length > 0 && (
            <div className="px-4 mb-6">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Preise</h3>
                <div className="space-y-2">
                  {selectedPrizes.map((prize, idx) => {
                    const emoji = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                    return (
                      <div key={prize.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2">
                        <span className="text-sm">{emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-white truncate">{prize.title}</div>
                          {prize.winner_username && (
                            <div className="text-[10px] text-yellow-400">
                              <Crown size={10} className="inline mr-1" />{prize.winner_username}
                            </div>
                          )}
                        </div>
                        {prize.claimed && (
                          <span className="text-[9px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full">✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Invite-Code Anzeige für Creator */}
          {selectedTournament.invite_code && isCreator(selectedTournament) && (
            <div className="px-4 mb-6">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-purple-400 uppercase">Einladungscode</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`https://www.satoshiduell.com/t/${selectedTournament.invite_code}`);
                      alert('Link kopiert!');
                    }}
                    className="text-purple-300 hover:text-white"
                  >
                    <Link2 size={14} />
                  </button>
                </div>
                <div className="font-mono text-lg text-white font-bold text-center">{selectedTournament.invite_code}</div>
              </div>
            </div>
          )}

          {/* Ergebnisse / Rangliste */}
          <div className="px-4 mb-6">
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-4 ml-1">
                {t('tournament_results_title')}
              </h3>
              {resultsList.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center">{t('tournament_results_empty')}</p>
              ) : (
                <div className="space-y-2">
                  {resultsList.map((entry, index) => {
                    const entryIsWinner = selectedTournament.winner
                      && entry.name
                      && entry.name.toLowerCase() === selectedTournament.winner.toLowerCase();
                    return (
                      <div
                        key={entry.key || entry.name || index}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
                          entryIsWinner
                            ? 'border-yellow-500/40 bg-yellow-500/10'
                            : 'border-white/5 bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 text-[10px] text-neutral-500 font-bold">{index + 1}.</div>
                          <div className="text-xs font-bold text-white">
                            {entry.name || '-'}
                          </div>
                          {entryIsWinner && <Crown size={12} className="text-yellow-400" />}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-300">
                          <div>{entry.played ? entry.score : '-'}</div>
                          <div>{entry.played ? formatTournamentTime(entry.timeMs) : t('tournament_not_played')}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 mb-6 space-y-3">
            {canJoinTournament(selectedTournament) && (
              <Button
                onClick={() => handleJoinTournament(selectedTournament)}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-black py-4 flex items-center justify-center gap-2"
                disabled={joinLoading}
              >
                {selectedTournament.access_level === 'invite'
                  ? '🔗 Mit Einladung beitreten'
                  : selectedTournament.access_level === 'token'
                  ? t('tournament_join_token_btn')
                  : t('tournament_join_btn')}
              </Button>
            )}
            {canStartTournament(selectedTournament) && (
              <Button
                onClick={() => onStartTournament && onStartTournament(selectedTournament)}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-3 flex items-center justify-center gap-2"
              >
                {t('tournament_start_quiz')}
              </Button>
            )}
            {selectedTournament.access_level === 'token'
              && isCreator(selectedTournament) && (
              <Button
                onClick={() => handleGenerateToken(selectedTournament)}
                className="w-full bg-purple-500 hover:bg-purple-600 text-black font-black py-3 flex items-center justify-center gap-2"
              >
                <KeyRound size={18} /> {t('tournament_token_generate')}
              </Button>
            )}
            {/* Admin Dashboard Button */}
            {(isCreator(selectedTournament) || user?.is_admin) && onOpenAdmin && (
              <Button
                onClick={() => onOpenAdmin(selectedTournament.id)}
                className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-black py-3 flex items-center justify-center gap-2 border border-purple-500/30"
              >
                <Shield size={18} /> Admin Dashboard
              </Button>
            )}
            {canShareTournament(selectedTournament) && (
              <Button
                onClick={() => handleShareTournament(selectedTournament)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-black py-3 flex items-center justify-center gap-2"
              >
                <Share2 size={18} /> {t('tournament_share_btn')}
              </Button>
            )}
            {/* Gewinner-Info */}
            {selectedTournament.status === 'finished' && isWinner && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                <Crown size={24} className="text-yellow-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white mb-1">Du hast gewonnen!</p>
                <p className="text-xs text-neutral-400">
                  Der Veranstalter wird dich für die Preisübergabe kontaktieren.
                </p>
              </div>
            )}
            {isParticipant(selectedTournament) && !isWinner && (
              <div className="text-center text-xs text-green-400 font-bold">
                {t('tournament_joined')}
              </div>
            )}
            {hasPlayed(selectedTournament) && (
              <div className="text-center text-xs text-neutral-400 font-bold">
                {t('tournament_played')}
              </div>
            )}
          </div>
        </div>
        {renderModals()}
      </Background>
    );
  }

  // ============================================
  // LIST VIEW (Turnierübersicht)
  // ============================================
  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20}/>
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
              <Trophy size={24} /> {t('tournament_list_title')}
            </h2>
          </div>
          <button 
            onClick={() => {
              refreshUser(user?.username);
              setLocalCanCreate(!localCanCreate);
              setTimeout(() => setLocalCanCreate(user?.can_create_tournaments || false), 100);
            }}
            className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors"
            title={t('tournament_refresh_permissions')}
          >
            <RefreshCw className="text-white" size={20}/>
          </button>
        </div>

        {/* Create Tournament Button */}
        {localCanCreate && (
          <div className="px-4 mb-4">
            <div
              style={carbonStyle}
              className="border border-white/10 rounded-2xl p-4 text-center shadow-lg shadow-black/40"
            >
              <Crown className="text-white/80 mx-auto mb-2" size={32} />
              <p className="text-xs text-neutral-300 mb-3">{t('tournament_creator_permission')}</p>
              <Button onClick={onCreateTournament} className="w-full bg-white/10 hover:bg-white/20 text-white">
                {t('tournament_btn_create')}
              </Button>
            </div>
          </div>
        )}

        {/* Tournament List */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 scrollbar-hide">
          {loading && (
            <div className="text-center text-neutral-500 text-sm py-10">{t('tournament_loading')}</div>
          )}
          {!loading && errorMsg && (
            <div className="text-center text-red-400 text-sm py-10">{errorMsg}</div>
          )}

          {/* Active Tournaments */}
          <div>
            <h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3 pl-1">
              {t('tournament_status_active')}
            </h3>
            {!loading && visibleTournaments.filter(t => t.status === 'active').map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                {(() => {
                  const imageUrl = tournament.image_url || getTournamentImageUrl(tournament.image_path);
                  return (
                    <button
                      onClick={() => setSelectedTournament(tournament)}
                      className="w-full border border-green-500/30 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
                    >
                      {imageUrl && (
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `url(${imageUrl})`,
                            backgroundSize: '130%',
                            backgroundPosition: 'center',
                            filter: 'blur(2px)',
                            transform: 'scale(1.05)'
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/35 to-emerald-500/35" />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                            <p className="text-[10px] text-neutral-200 line-clamp-1">{tournament.description}</p>
                          </div>
                          <div className="flex gap-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              tournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-200' : 'bg-purple-500/30 text-purple-200'
                            }`}>
                              {formatBadge(tournament.format)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1 text-[10px]">
                            <Users size={12} className="text-neutral-100" />
                            <span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span>
                          </div>
                          {tournament.sponsor_name && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <span className="text-yellow-200 font-bold">{tournament.sponsor_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })()}
                {canDeleteTournament(tournament) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: tournament.id, name: tournament.name });
                    }}
                    className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10"
                    title={t('tournament_delete_btn')}
                  >
                    <Trash2 className="text-red-400" size={12}/>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Registration Open */}
          <div>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 pl-1">
              {t('tournament_status_registration')}
            </h3>
            {!loading && visibleTournaments.filter(t => t.status === 'registration').map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                {(() => {
                  const imageUrl = tournament.image_url || getTournamentImageUrl(tournament.image_path);
                  return (
                    <button
                      onClick={() => setSelectedTournament(tournament)}
                      className="w-full border border-orange-500/30 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
                    >
                      {imageUrl && (
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundImage: `url(${imageUrl})`,
                            backgroundSize: '130%',
                            backgroundPosition: 'center',
                            filter: 'blur(2px)',
                            transform: 'scale(1.05)'
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/35 to-yellow-500/35" />
                      <div className="relative">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                            <p className="text-[10px] text-neutral-200 line-clamp-1">{tournament.description}</p>
                          </div>
                          <div className="flex gap-1">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              tournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-200' : 'bg-purple-500/30 text-purple-200'
                            }`}>
                              {formatBadge(tournament.format)}
                            </span>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/30 text-orange-200">
                              {accessLabel(tournament)}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex items-center gap-1 text-[10px]">
                            <Users size={12} className="text-neutral-100" />
                            <span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span>
                          </div>
                          {tournament.play_until && (
                            <div className="flex items-center gap-1 text-[10px]">
                              <Calendar size={12} className="text-neutral-100" />
                              <span className="text-neutral-200">{formatPlayUntil(getPlayUntil(tournament))}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })()}
                {canDeleteTournament(tournament) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: tournament.id, name: tournament.name });
                    }}
                    className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10"
                    title={t('tournament_delete_btn')}
                  >
                    <Trash2 className="text-red-400" size={12}/>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* History */}
          <div>
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1">
              {t('tournament_history_title')}
            </h3>
            {!loading && visibleTournaments.filter(t => t.status === 'finished').length === 0 && (
              <div className="text-center text-neutral-600 text-xs py-4">{t('tournament_history_empty')}</div>
            )}
            {!loading && visibleTournaments.filter(t => t.status === 'finished').map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                <button
                  onClick={() => setSelectedTournament(tournament)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left opacity-70"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                      <p className="text-[10px] text-neutral-400">
                        {tournament.winner ? (<><span className="text-yellow-400 font-bold">{tournament.winner}</span></>) : '-'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        tournament.format === 'bracket' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                      }`}>
                        {formatBadge(tournament.format)}
                      </span>
                      <Trophy size={16} className="text-yellow-400" />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10px]">
                      <span className="text-yellow-400 font-bold">{t('tournament_question_count_short', { count: questionCount(tournament) })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Users size={12} className="text-neutral-400" />
                      <span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span>
                    </div>
                  </div>
                </button>
                {canDeleteTournament(tournament) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: tournament.id, name: tournament.name });
                    }}
                    className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10"
                    title={t('tournament_delete_btn')}
                  >
                    <Trash2 className="text-red-400" size={12}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {renderModals()}
    </Background>
  );
};

export default TournamentsView;