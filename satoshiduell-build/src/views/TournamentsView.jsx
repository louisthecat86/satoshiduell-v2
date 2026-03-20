import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Trophy, Users, Calendar, Crown, RefreshCw, Trash2, Timer, Share2, Shield, Link2, Clock, XCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { deleteTournament, fetchTournaments, fetchTournamentPrizes, fetchMyTournamentRegistrations, finalizeTournamentIfReady, redeemTournamentToken, getTournamentImageUrl } from '../services/supabase';
import { formatTime } from '../utils/formatters';

const TournamentsView = ({ onBack, onCreateTournament, onStartTournament, onOpenAdmin, onOpenRegistration }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedPrizes, setSelectedPrizes] = useState([]);
  const [localCanCreate, setLocalCanCreate] = useState(user?.can_create_tournaments || false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Token-Eingabe State
  const [tokenModal, setTokenModal] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    if (user?.username) refreshUser(user.username);
  }, []);

  useEffect(() => {
    setLocalCanCreate(user?.can_create_tournaments || false);
  }, [user?.can_create_tournaments]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    const [tournamentsResult, registrationsResult] = await Promise.all([
      fetchTournaments(),
      user?.username ? fetchMyTournamentRegistrations(user.username) : { data: [] },
    ]);
    if (tournamentsResult.error) {
      setErrorMsg('Fehler beim Laden');
    }
    setTournaments(tournamentsResult.data || []);
    setMyRegistrations(registrationsResult.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!selectedTournament) { setSelectedPrizes([]); return; }
    fetchTournamentPrizes(selectedTournament.id).then(({ data }) => setSelectedPrizes(data || []));
  }, [selectedTournament?.id]);

  useEffect(() => {
    if (!selectedTournament || selectedTournament.status === 'finished' || !selectedTournament.play_until) return;
    finalizeTournamentIfReady(selectedTournament.id).then(({ data }) => {
      if (data) {
        setSelectedTournament(data);
        setTournaments(prev => prev.map(t => t.id === data.id ? data : t));
      }
    });
  }, [selectedTournament?.id]);

  // ============================================
  // ALLE Turniere sichtbar (außer cancelled)
  // ============================================
  const visibleTournaments = tournaments.filter(t =>
    ['registration', 'active', 'finished'].includes(t.status)
  );

  const getMyRegistration = (tournamentId) =>
    myRegistrations.find(r => r.tournament_id === tournamentId);

  const canDeleteTournament = (tournament) => {
    if (!user) return false;
    if (user.is_admin) return true;
    return tournament.creator?.toLowerCase() === user.username?.toLowerCase();
  };

  const isCreator = (tournament) =>
    user && tournament && tournament.creator?.toLowerCase() === user.username?.toLowerCase();

  const isParticipant = (tournament) => {
    if (!tournament || !user?.username) return false;
    return (tournament.participants || []).some(p => (p || '').toLowerCase() === user.username.toLowerCase());
  };

  const hasPlayed = (tournament) => {
    if (!tournament || !user?.username) return false;
    const scores = tournament.participant_scores || {};
    return scores[user.username.toLowerCase()] !== undefined && scores[user.username.toLowerCase()] !== null;
  };

  const canStartTournament = (tournament) => {
    if (!tournament || !isParticipant(tournament) || hasPlayed(tournament)) return false;
    if (tournament.status === 'finished') return false;
    if (tournament.play_until && new Date(tournament.play_until) <= new Date()) return false;
    return true;
  };

  const handleDeleteTournament = async (tournamentId) => {
    await deleteTournament(tournamentId);
    setDeleteConfirm(null);
    setSelectedTournament(null);
    await loadData();
  };

  const handleRedeemToken = async (tournamentId) => {
    if (!tokenInput.trim() || !user?.username) { setTokenError('Bitte Token eingeben'); return; }
    setTokenLoading(true);
    setTokenError('');
    const { data, error } = await redeemTournamentToken(tournamentId, tokenInput.trim(), user.username);
    setTokenLoading(false);
    if (error) { setTokenError('Token ungültig oder bereits verwendet'); return; }
    setTokenModal(null);
    setTokenInput('');
    if (data) {
      setSelectedTournament(data);
      setTournaments(prev => prev.map(t => t.id === data.id ? data : t));
    }
    await loadData();
  };

  const statusLabel = (s) => {
    if (s === 'registration') return 'Anmeldung offen';
    if (s === 'active') return 'Läuft';
    if (s === 'finished') return 'Beendet';
    return s;
  };

  const formatBadge = (f) => f === 'bracket' ? 'Bracket' : 'Highscore';
  const formatPlayUntil = (v) => { if (!v) return '-'; const d = new Date(v); return isNaN(d.getTime()) ? '-' : d.toLocaleString(); };
  const questionCount = (t) => t?.question_count || 0;
  const maxPlayersLabel = (t) => t?.max_players ? t.max_players : '∞';

  const getResultsList = (tournament) => {
    const participants = Array.isArray(tournament?.participants) ? tournament.participants : [];
    const scores = tournament?.participant_scores || {};
    const times = tournament?.participant_times || {};
    const rows = participants.map(name => {
      const key = (name || '').toLowerCase();
      const score = scores[key]; const timeMs = times[key];
      const played = score !== undefined && score !== null;
      return { name, key, score: played ? score : null, timeMs: played ? timeMs : null, played };
    });
    rows.sort((a, b) => {
      if (a.played !== b.played) return a.played ? -1 : 1;
      if (!a.played && !b.played) return 0;
      if (a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
      return (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity);
    });
    return rows;
  };

  const formatTournamentTime = (ms) => {
    if (ms === null || ms === undefined) return '-';
    return formatTime(Math.max(0, ms) / 1000);
  };

  const handleShareTournament = async (tournament) => {
    if (!tournament?.invite_code) return;
    const url = `https://www.satoshiduell.com/t/${tournament.invite_code}`;
    const text = `🏆 ${tournament.name}\n${tournament.description || ''}\n\nJetzt teilnehmen: ${url}`;
    try {
      if (navigator.share) await navigator.share({ title: tournament.name, text, url });
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); alert('Link kopiert!'); }
    } catch (e) { /* cancelled */ }
  };

  const carbonStyle = {
    backgroundImage: [
      'linear-gradient(120deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 35%, rgba(0,0,0,0) 60%)',
      'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)',
      'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, rgba(0,0,0,0.05) 2px 4px)',
      'repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0 2px, rgba(0,0,0,0.03) 2px 4px)'
    ].join(', ')
  };

  // ============================================
  // MODALS
  // ============================================
  const renderModals = () => (
    <>
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl max-w-sm w-full p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Trash2 className="text-red-500" size={32} />
              <h3 className="text-xl font-black text-white uppercase">Turnier löschen?</h3>
              <p className="text-neutral-400 text-sm">"{deleteConfirm.name}" wird unwiderruflich gelöscht.</p>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10">Abbrechen</button>
                <button onClick={() => handleDeleteTournament(deleteConfirm.id)} className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 flex items-center justify-center gap-2">
                  <Trash2 size={18} /> Löschen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {tokenModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1a1a1a] border border-green-500/30 rounded-2xl max-w-sm w-full p-6">
            <div className="flex flex-col gap-4">
              <div className="text-center">
                <KeyRound size={32} className="text-green-400 mx-auto mb-2" />
                <h3 className="text-xl font-black text-white">Teilnahme-Code eingeben</h3>
                <p className="text-neutral-400 text-sm mt-1">Gib den Code ein, den du vom Veranstalter erhalten hast</p>
              </div>
              <input type="text" value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                placeholder="z.B. T-a1b2c3d4e5..." autoFocus
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono outline-none focus:border-green-500/50" />
              {tokenError && <div className="text-xs text-red-400 font-bold text-center">{tokenError}</div>}
              <div className="flex gap-3">
                <button onClick={() => { setTokenModal(null); setTokenInput(''); setTokenError(''); }}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10">Abbrechen</button>
                <button onClick={() => handleRedeemToken(tokenModal.tournamentId)}
                  disabled={tokenLoading || !tokenInput.trim()}
                  className="flex-1 px-4 py-3 rounded-xl bg-green-500 text-black font-bold hover:bg-green-400 disabled:opacity-60">
                  {tokenLoading ? 'Prüfe...' : 'Beitreten'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ============================================
  // DETAIL VIEW
  // ============================================
  if (selectedTournament) {
    const isWinner = selectedTournament.winner && selectedTournament.winner.toLowerCase() === user?.username?.toLowerCase();
    const resultsList = getResultsList(selectedTournament);
    const myReg = getMyRegistration(selectedTournament.id);
    const amParticipant = isParticipant(selectedTournament);
    const amCreator = isCreator(selectedTournament);

    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6 pt-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedTournament(null)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
                <ArrowLeft className="text-white" size={20} />
              </button>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest">{selectedTournament.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${selectedTournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-300' : 'bg-purple-500/30 text-purple-300'}`}>
                    {formatBadge(selectedTournament.format)}
                  </span>
                  <span className="text-xs text-neutral-500">{statusLabel(selectedTournament.status)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(amCreator || user?.is_admin) && onOpenAdmin && (
                <button onClick={() => onOpenAdmin(selectedTournament.id)}
                  className="bg-purple-500/20 p-2 rounded-xl hover:bg-purple-500/30 transition-colors border border-purple-500/50">
                  <Shield className="text-purple-400" size={20} />
                </button>
              )}
              {canDeleteTournament(selectedTournament) && (
                <button onClick={() => setDeleteConfirm({ id: selectedTournament.id, name: selectedTournament.name })}
                  className="bg-red-500/20 p-2 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/50">
                  <Trash2 className="text-red-400" size={20} />
                </button>
              )}
            </div>
          </div>

          {/* Bild */}
          {(() => {
            const url = selectedTournament.image_url || getTournamentImageUrl(selectedTournament.image_path);
            if (!url) return null;
            return (
              <div className="px-4 mb-4">
                <div className="h-40 rounded-2xl border border-white/10 overflow-hidden relative">
                  <div className="absolute inset-0" style={{ backgroundImage: `url(${url})`, backgroundSize: '130%', backgroundPosition: 'center', filter: 'blur(2px)', transform: 'scale(1.05)' }} />
                  <div className="absolute inset-0 bg-black/20" />
                </div>
              </div>
            );
          })()}

          {/* ===== REGISTRIERUNG / STATUS FÜR NICHT-TEILNEHMER ===== */}
          {!amParticipant && !amCreator && (
            <div className="px-4 mb-4">
              {/* Noch nicht registriert */}
              {!myReg && selectedTournament.status !== 'finished' && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
                  <Trophy size={24} className="text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-2">An diesem Turnier teilnehmen?</p>
                  <p className="text-xs text-neutral-400 mb-4">
                    Registriere dich mit deinem Kontaktweg. Der Veranstalter prüft deine Anmeldung und sendet dir einen Teilnahme-Code.
                  </p>
                  <Button
                    onClick={() => onOpenRegistration && onOpenRegistration(selectedTournament.id, selectedTournament.invite_code)}
                    className="w-full bg-purple-500 hover:bg-purple-400 text-black font-black py-3"
                  >
                    Registrieren
                  </Button>
                </div>
              )}

              {/* Registrierung: Pending */}
              {myReg && myReg.status === 'pending' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
                  <Clock size={24} className="text-orange-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-1">Registrierung wird geprüft</p>
                  <p className="text-xs text-neutral-400">
                    Der Veranstalter prüft deine Anmeldung. Du erhältst deinen Teilnahme-Code über deinen hinterlegten Kontaktweg ({myReg.identity_display}).
                  </p>
                </div>
              )}

              {/* Registrierung: Approved → Token eingeben */}
              {myReg && myReg.status === 'approved' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                  <KeyRound size={24} className="text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-1">Registrierung genehmigt!</p>
                  <p className="text-xs text-neutral-400 mb-3">
                    Du solltest deinen Teilnahme-Code über {myReg.identity_display} erhalten haben.
                  </p>
                  <button
                    onClick={() => { setTokenInput(''); setTokenError(''); setTokenModal({ tournamentId: selectedTournament.id }); }}
                    className="w-full bg-green-500 text-black font-black py-3 rounded-xl hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <KeyRound size={18} /> Code eingeben & beitreten
                  </button>
                </div>
              )}

              {/* Registrierung: Rejected */}
              {myReg && myReg.status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
                  <XCircle size={24} className="text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-1">Registrierung abgelehnt</p>
                  <p className="text-xs text-neutral-400">Der Veranstalter hat deine Anmeldung leider abgelehnt.</p>
                </div>
              )}

              {/* Registrierung: Redeemed aber noch nicht in participants (edge case) */}
              {myReg && myReg.status === 'redeemed' && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
                  <p className="text-sm font-bold text-white">Token eingelöst — lade Seite neu</p>
                </div>
              )}
            </div>
          )}

          {/* Info Card */}
          <div className="px-4 mb-4">
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Fragen</div>
                  <div className="text-lg font-black text-white">{questionCount(selectedTournament)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Teilnehmer</div>
                  <div className="text-lg font-black text-white">{selectedTournament.current_participants}/{maxPlayersLabel(selectedTournament)}</div>
                </div>
              </div>
              {selectedTournament.play_until && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-neutral-300">
                  <Timer size={14} className="text-orange-400" /> Deadline: {formatPlayUntil(selectedTournament.play_until)}
                </div>
              )}
              {selectedTournament.sponsor_name && (
                <div className="mt-2 text-center text-[11px] text-neutral-300">
                  Sponsor: <span className="font-bold text-white">{selectedTournament.sponsor_name}</span>
                </div>
              )}
              {selectedTournament.description && (
                <p className="mt-3 text-xs text-neutral-400 text-center">{selectedTournament.description}</p>
              )}
            </div>
          </div>

          {/* Creator Tools */}
          {amCreator && (
            <div className="px-4 mb-4 space-y-3">
              {selectedTournament.invite_code && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                  <div className="text-[10px] font-bold text-purple-400 uppercase mb-2">Einladungslink</div>
                  <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 mb-2">
                    <p className="text-[10px] text-neutral-300 font-mono break-all">https://www.satoshiduell.com/t/{selectedTournament.invite_code}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { navigator.clipboard.writeText(`https://www.satoshiduell.com/t/${selectedTournament.invite_code}`); alert('Link kopiert!'); }}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 flex items-center justify-center gap-1">
                      <Link2 size={12} /> Kopieren
                    </button>
                    <button onClick={() => handleShareTournament(selectedTournament)}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 flex items-center justify-center gap-1">
                      <Share2 size={12} /> Teilen
                    </button>
                  </div>
                </div>
              )}
              <Button onClick={() => onOpenAdmin && onOpenAdmin(selectedTournament.id)}
                className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-black py-3 flex items-center justify-center gap-2 border border-purple-500/30">
                <Shield size={18} /> Admin Dashboard öffnen
              </Button>
            </div>
          )}

          {/* Preise */}
          {selectedPrizes.length > 0 && (
            <div className="px-4 mb-4">
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
                            <div className="text-[10px] text-yellow-400"><Crown size={10} className="inline mr-1" />{prize.winner_username}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Rangliste (nur wenn Teilnehmer oder Turnier beendet) */}
          {(amParticipant || amCreator || selectedTournament.status === 'finished') && resultsList.length > 0 && (
            <div className="px-4 mb-4">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Rangliste</h3>
                <div className="space-y-2">
                  {resultsList.map((entry, index) => {
                    const entryIsWinner = selectedTournament.winner && entry.name.toLowerCase() === selectedTournament.winner.toLowerCase();
                    return (
                      <div key={entry.key || index}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 border ${entryIsWinner ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/5 bg-white/5'}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 text-[10px] text-neutral-500 font-bold">{index + 1}.</div>
                          <div className="text-xs font-bold text-white">{entry.name}</div>
                          {entryIsWinner && <Crown size={12} className="text-yellow-400" />}
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-neutral-300">
                          <div>{entry.played ? `${entry.score} Pkt` : '-'}</div>
                          <div>{entry.played ? formatTournamentTime(entry.timeMs) : 'Ausstehend'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-4 mb-6 space-y-3">
            {canStartTournament(selectedTournament) && (
              <Button onClick={() => onStartTournament && onStartTournament(selectedTournament)}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 flex items-center justify-center gap-2 text-lg">
                🎮 Quiz starten
              </Button>
            )}
            {amParticipant && hasPlayed(selectedTournament) && (
              <div className="text-center text-xs text-neutral-400 font-bold py-2">✓ Du hast bereits gespielt</div>
            )}
            {selectedTournament.status === 'finished' && isWinner && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                <Crown size={24} className="text-yellow-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white mb-1">Du hast gewonnen!</p>
                <p className="text-xs text-neutral-400">Der Veranstalter wird dich für die Preisübergabe kontaktieren.</p>
              </div>
            )}
          </div>
        </div>
        {renderModals()}
      </Background>
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================
  const activeTournaments = visibleTournaments.filter(t => t.status === 'active');
  const registrationTournaments = visibleTournaments.filter(t => t.status === 'registration');
  const finishedTournaments = visibleTournaments.filter(t => t.status === 'finished');

  const RegistrationBadge = ({ registration }) => {
    if (!registration) return null;
    if (registration.status === 'pending') return <div className="flex items-center gap-1 text-[10px] text-orange-400 font-bold"><Clock size={10} /> Wird geprüft</div>;
    if (registration.status === 'approved') return <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold"><KeyRound size={10} /> Code eingeben</div>;
    if (registration.status === 'rejected') return <div className="flex items-center gap-1 text-[10px] text-red-400 font-bold"><XCircle size={10} /> Abgelehnt</div>;
    return null;
  };

  const renderTournamentCard = (tournament, borderColor, bgGradient) => {
    const myReg = getMyRegistration(tournament.id);
    const imageUrl = tournament.image_url || getTournamentImageUrl(tournament.image_path);
    const amPart = isParticipant(tournament);

    return (
      <div key={tournament.id} className="relative mb-3">
        <button onClick={() => setSelectedTournament(tournament)}
          className={`w-full border ${borderColor} rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left relative overflow-hidden`}>
          {imageUrl ? (
            <>
              <div className="absolute inset-0" style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: '130%', backgroundPosition: 'center', filter: 'blur(2px)', transform: 'scale(1.05)' }} />
              <div className={`absolute inset-0 ${bgGradient}`} />
            </>
          ) : <div className={`absolute inset-0 ${bgGradient}`} />}
          <div className="relative">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-white font-black text-sm flex-1">{tournament.name}</h4>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-2 ${tournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-200' : 'bg-purple-500/30 text-purple-200'}`}>
                {formatBadge(tournament.format)}
              </span>
            </div>
            {tournament.description && <p className="text-[10px] text-neutral-200 line-clamp-1 mb-2">{tournament.description}</p>}
            <div className="flex gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <Users size={12} className="text-neutral-100" />
                <span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span>
              </div>
              {amPart && canStartTournament(tournament) && <span className="text-green-300 font-bold animate-pulse">▶ Spielen</span>}
              {amPart && hasPlayed(tournament) && <span className="text-neutral-300">✓ Gespielt</span>}
              {amPart && !hasPlayed(tournament) && !canStartTournament(tournament) && <span className="text-green-300 font-bold">✓ Dabei</span>}
            </div>
            {myReg && !amPart && (
              <div className="mt-2"><RegistrationBadge registration={myReg} /></div>
            )}
          </div>
        </button>
        {canDeleteTournament(tournament) && (
          <button onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
            className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10">
            <Trash2 className="text-red-400" size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        <div className="p-6 pb-2 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
              <Trophy size={24} /> Community Turniere
            </h2>
          </div>
          <button onClick={() => { refreshUser(user?.username); loadData(); }}
            className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <RefreshCw className="text-white" size={20} />
          </button>
        </div>

        {localCanCreate && (
          <div className="px-4 mb-4">
            <div style={carbonStyle} className="border border-white/10 rounded-2xl p-4 text-center shadow-lg shadow-black/40">
              <Crown className="text-white/80 mx-auto mb-2" size={32} />
              <p className="text-xs text-neutral-300 mb-3">Du bist berechtigt, Turniere zu erstellen</p>
              <Button onClick={onCreateTournament} className="w-full bg-white/10 hover:bg-white/20 text-white">Turnier erstellen</Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 scrollbar-hide">
          {loading && <div className="text-center text-neutral-500 text-sm py-10">Lade Turniere...</div>}
          {!loading && errorMsg && <div className="text-center text-red-400 text-sm py-10">{errorMsg}</div>}
          {!loading && visibleTournaments.length === 0 && (
            <div className="text-center py-16">
              <Trophy size={48} className="text-neutral-700 mx-auto mb-4" />
              <p className="text-neutral-500 text-sm mb-2">Keine Turniere vorhanden</p>
              <p className="text-neutral-600 text-xs">Aktuell gibt es keine offenen Turniere.</p>
            </div>
          )}

          {activeTournaments.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3 pl-1">Läuft</h3>
              {activeTournaments.map(t => renderTournamentCard(t, 'border-green-500/30', 'bg-gradient-to-r from-green-500/30 to-emerald-500/30'))}
            </div>
          )}

          {registrationTournaments.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 pl-1">Anmeldung offen</h3>
              {registrationTournaments.map(t => renderTournamentCard(t, 'border-orange-500/30', 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20'))}
            </div>
          )}

          {finishedTournaments.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1">Historie</h3>
              {finishedTournaments.map(tournament => (
                <div key={tournament.id} className="relative mb-3">
                  <button onClick={() => setSelectedTournament(tournament)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left opacity-70">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                        {tournament.winner && <p className="text-[10px] text-yellow-400 font-bold"><Crown size={10} className="inline mr-1" />{tournament.winner}</p>}
                      </div>
                      <Trophy size={16} className="text-yellow-400" />
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="text-neutral-400">{questionCount(tournament)} Fragen</span>
                      <span className="text-neutral-400">{tournament.current_participants} Teilnehmer</span>
                    </div>
                  </button>
                  {canDeleteTournament(tournament) && (
                    <button onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
                      className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10">
                      <Trash2 className="text-red-400" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {renderModals()}
    </Background>
  );
};

export default TournamentsView;