import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Trophy, Users, Calendar, Crown, RefreshCw, Trash2, Timer, Share2, Shield, Link2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { deleteTournament, fetchTournaments, fetchTournamentPrizes, finalizeTournamentIfReady, getTournamentImageUrl } from '../services/supabase';
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
      setErrorMsg('Fehler beim Laden');
      setLoading(false);
      return;
    }
    setTournaments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // Preise laden wenn Turnier ausgewählt
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

  // Auto-Finalisierung prüfen
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

  // ============================================
  // SICHTBARKEIT: Nur eigene Turniere + Turniere wo man Teilnehmer ist
  // ============================================
  const visibleTournaments = tournaments.filter(tournament => {
    if (!user?.username) return false;
    // Creator sieht eigene
    if (tournament.creator?.toLowerCase() === user.username.toLowerCase()) return true;
    // Admin sieht alle
    if (user.is_admin) return true;
    // Teilnehmer sieht seine Turniere
    const isParticipantCheck = (tournament.participants || []).some(
      p => (p || '').toLowerCase() === user.username.toLowerCase()
    );
    if (isParticipantCheck) return true;
    return false;
  });

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

  const isParticipant = (tournament) => {
    if (!tournament || !user?.username) return false;
    return (tournament.participants || []).some(
      (p) => (p || '').toLowerCase() === user.username.toLowerCase()
    );
  };

  const handleDeleteTournament = async (tournamentId) => {
    const { error } = await deleteTournament(tournamentId);
    if (error) {
      console.error('Delete error:', error);
      alert('Fehler beim Löschen');
      return;
    }
    setDeleteConfirm(null);
    setSelectedTournament(null);
    await loadTournaments();
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
    if (tournament.status === 'finished') return false;
    if (tournament.play_until && new Date(tournament.play_until) <= new Date()) return false;
    return true;
  };

  const statusLabel = (status) => {
    if (status === 'registration') return 'Anmeldung offen';
    if (status === 'active') return 'Läuft';
    if (status === 'finished') return 'Beendet';
    if (status === 'cancelled') return 'Abgesagt';
    return status;
  };

  const formatBadge = (format) => {
    if (format === 'bracket') return 'Bracket';
    return 'Highscore';
  };

  const getPlayUntil = (tournament) => tournament?.play_until || null;

  const formatPlayUntil = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString();
  };

  const questionCount = (tournament) => tournament?.question_count || 0;
  const maxPlayersLabel = (tournament) => (
    tournament?.max_players ? tournament.max_players : '∞'
  );

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

  const handleShareTournament = async (tournament) => {
    if (!tournament) return;
    const inviteUrl = tournament.invite_code
      ? `https://www.satoshiduell.com/t/${tournament.invite_code}`
      : 'https://www.satoshiduell.com';
    const text = `🏆 ${tournament.name}\n${tournament.description || ''}\n\nJetzt teilnehmen: ${inviteUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: tournament.name, text, url: inviteUrl });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        alert('Link kopiert!');
        return;
      }
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

  // ============================================
  // DELETE MODAL
  // ============================================
  const renderDeleteModal = () => {
    if (!deleteConfirm) return null;
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl max-w-sm w-full p-6">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
              <Trash2 className="text-red-500" size={32} />
            </div>
            <h3 className="text-xl font-black text-white uppercase">Turnier löschen?</h3>
            <p className="text-neutral-400 text-sm">"{deleteConfirm.name}" wird unwiderruflich gelöscht.</p>
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all">
                Abbrechen
              </button>
              <button onClick={() => handleDeleteTournament(deleteConfirm.id)}
                className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                <Trash2 size={18} /> Löschen
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ============================================
  // DETAIL VIEW
  // ============================================
  if (selectedTournament) {
    const isWinner = Boolean(selectedTournament.winner)
      && selectedTournament.winner.toLowerCase() === user?.username?.toLowerCase();
    const resultsList = getResultsList(selectedTournament);

    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6 pt-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSelectedTournament(null)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
                <ArrowLeft className="text-white" size={20}/>
              </button>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest">
                  {selectedTournament.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    selectedTournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-300' : 'bg-purple-500/30 text-purple-300'
                  }`}>
                    {formatBadge(selectedTournament.format)}
                  </span>
                  <span className="text-xs text-neutral-500">{statusLabel(selectedTournament.status)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(isCreator(selectedTournament) || user?.is_admin) && onOpenAdmin && (
                <button onClick={() => onOpenAdmin(selectedTournament.id)}
                  className="bg-purple-500/20 p-2 rounded-xl hover:bg-purple-500/30 transition-colors border border-purple-500/50"
                  title="Admin Dashboard">
                  <Shield className="text-purple-400" size={20}/>
                </button>
              )}
              {canDeleteTournament(selectedTournament) && (
                <button onClick={() => setDeleteConfirm({ id: selectedTournament.id, name: selectedTournament.name })}
                  className="bg-red-500/20 p-2 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/50">
                  <Trash2 className="text-red-400" size={20}/>
                </button>
              )}
            </div>
          </div>

          {/* Turnierbild */}
          {(() => {
            const imageUrl = selectedTournament.image_url || getTournamentImageUrl(selectedTournament.image_path);
            if (!imageUrl) return null;
            return (
              <div className="px-4 mb-4">
                <div className="h-40 rounded-2xl border border-white/10 overflow-hidden relative">
                  <div className="absolute inset-0" style={{
                    backgroundImage: `url(${imageUrl})`, backgroundSize: '130%',
                    backgroundPosition: 'center', filter: 'blur(2px)', transform: 'scale(1.05)'
                  }} />
                  <div className="absolute inset-0 bg-black/20" />
                </div>
              </div>
            );
          })()}

          {/* Turnier-Info */}
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
                  <Timer size={14} className="text-orange-400" />
                  Deadline: {formatPlayUntil(getPlayUntil(selectedTournament))}
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

          {/* Invite-Code für Creator */}
          {selectedTournament.invite_code && isCreator(selectedTournament) && (
            <div className="px-4 mb-4">
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-purple-400 uppercase">Einladungslink</span>
                </div>
                <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 mb-2">
                  <p className="text-[10px] text-neutral-300 font-mono break-all">
                    https://www.satoshiduell.com/t/{selectedTournament.invite_code}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => {
                    navigator.clipboard.writeText(`https://www.satoshiduell.com/t/${selectedTournament.invite_code}`);
                    alert('Link kopiert!');
                  }}
                    className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-1">
                    <Link2 size={12} /> Kopieren
                  </button>
                  <button onClick={() => handleShareTournament(selectedTournament)}
                    className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-1">
                    <Share2 size={12} /> Teilen
                  </button>
                </div>
              </div>
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
                            <div className="text-[10px] text-yellow-400">
                              <Crown size={10} className="inline mr-1" />{prize.winner_username}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Rangliste / Ergebnisse */}
          <div className="px-4 mb-4">
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Rangliste</h3>
              {resultsList.length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-4">Noch keine Ergebnisse</p>
              ) : (
                <div className="space-y-2">
                  {resultsList.map((entry, index) => {
                    const entryIsWinner = selectedTournament.winner
                      && entry.name && entry.name.toLowerCase() === selectedTournament.winner.toLowerCase();
                    return (
                      <div key={entry.key || index}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 border ${
                          entryIsWinner ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/5 bg-white/5'
                        }`}>
                        <div className="flex items-center gap-2">
                          <div className="w-6 text-[10px] text-neutral-500 font-bold">{index + 1}.</div>
                          <div className="text-xs font-bold text-white">{entry.name || '-'}</div>
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
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 mb-6 space-y-3">
            {canStartTournament(selectedTournament) && (
              <Button
                onClick={() => onStartTournament && onStartTournament(selectedTournament)}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 flex items-center justify-center gap-2 text-lg"
              >
                🎮 Quiz starten
              </Button>
            )}

            {isParticipant(selectedTournament) && hasPlayed(selectedTournament) && (
              <div className="text-center text-xs text-neutral-400 font-bold py-2">
                ✓ Du hast bereits gespielt
              </div>
            )}

            {selectedTournament.status === 'finished' && isWinner && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                <Crown size={24} className="text-yellow-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white mb-1">Du hast gewonnen!</p>
                <p className="text-xs text-neutral-400">
                  Der Veranstalter wird dich für die Preisübergabe kontaktieren.
                </p>
              </div>
            )}
          </div>
        </div>
        {renderDeleteModal()}
      </Background>
    );
  }

  // ============================================
  // LIST VIEW
  // ============================================
  const activeTournaments = visibleTournaments.filter(t => t.status === 'active');
  const registrationTournaments = visibleTournaments.filter(t => t.status === 'registration');
  const finishedTournaments = visibleTournaments.filter(t => t.status === 'finished');

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
              <Trophy size={24} /> Community Turniere
            </h2>
          </div>
          <button onClick={() => {
            refreshUser(user?.username);
            loadTournaments();
          }}
            className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <RefreshCw className="text-white" size={20}/>
          </button>
        </div>

        {/* Create Tournament Button */}
        {localCanCreate && (
          <div className="px-4 mb-4">
            <div style={carbonStyle}
              className="border border-white/10 rounded-2xl p-4 text-center shadow-lg shadow-black/40">
              <Crown className="text-white/80 mx-auto mb-2" size={32} />
              <p className="text-xs text-neutral-300 mb-3">Du bist berechtigt, Turniere zu erstellen</p>
              <Button onClick={onCreateTournament} className="w-full bg-white/10 hover:bg-white/20 text-white">
                Turnier erstellen
              </Button>
            </div>
          </div>
        )}

        {/* Tournament List */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 scrollbar-hide">
          {loading && (
            <div className="text-center text-neutral-500 text-sm py-10">Lade Turniere...</div>
          )}
          {!loading && errorMsg && (
            <div className="text-center text-red-400 text-sm py-10">{errorMsg}</div>
          )}

          {/* Hinweis wenn keine Turniere */}
          {!loading && visibleTournaments.length === 0 && (
            <div className="text-center py-16">
              <Trophy size={48} className="text-neutral-700 mx-auto mb-4" />
              <p className="text-neutral-500 text-sm mb-2">Keine Turniere vorhanden</p>
              <p className="text-neutral-600 text-xs">
                {localCanCreate
                  ? 'Erstelle dein erstes Turnier oder tritt einem bei über einen Einladungslink.'
                  : 'Tritt einem Turnier bei über einen Einladungslink vom Veranstalter.'}
              </p>
            </div>
          )}

          {/* Aktive Turniere (läuft) */}
          {activeTournaments.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3 pl-1">
                Läuft
              </h3>
              {activeTournaments.map(tournament => (
                <div key={tournament.id} className="relative mb-3">
                  <button
                    onClick={() => setSelectedTournament(tournament)}
                    className="w-full border border-green-500/30 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
                  >
                    {(() => {
                      const imageUrl = tournament.image_url || getTournamentImageUrl(tournament.image_path);
                      return imageUrl ? (
                        <>
                          <div className="absolute inset-0" style={{
                            backgroundImage: `url(${imageUrl})`, backgroundSize: '130%',
                            backgroundPosition: 'center', filter: 'blur(2px)', transform: 'scale(1.05)'
                          }} />
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/40 to-emerald-500/40" />
                        </>
                      ) : <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20" />;
                    })()}
                    <div className="relative">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-white font-black text-sm flex-1">{tournament.name}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-2 ${
                          tournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-200' : 'bg-purple-500/30 text-purple-200'
                        }`}>{formatBadge(tournament.format)}</span>
                      </div>
                      {tournament.description && (
                        <p className="text-[10px] text-neutral-200 line-clamp-1 mb-2">{tournament.description}</p>
                      )}
                      <div className="flex gap-4 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Users size={12} className="text-neutral-100" />
                          <span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span>
                        </div>
                        {canStartTournament(tournament) && (
                          <span className="text-green-300 font-bold animate-pulse">▶ Spielen</span>
                        )}
                        {hasPlayed(tournament) && (
                          <span className="text-neutral-300">✓ Gespielt</span>
                        )}
                      </div>
                    </div>
                  </button>
                  {canDeleteTournament(tournament) && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
                      className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10">
                      <Trash2 className="text-red-400" size={12}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Registrierung offen */}
          {registrationTournaments.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 pl-1">
                Anmeldung offen
              </h3>
              {registrationTournaments.map(tournament => (
                <div key={tournament.id} className="relative mb-3">
                  <button
                    onClick={() => setSelectedTournament(tournament)}
                    className="w-full border border-orange-500/30 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-yellow-500/20" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-white font-black text-sm flex-1">{tournament.name}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-2 ${
                          tournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-200' : 'bg-purple-500/30 text-purple-200'
                        }`}>{formatBadge(tournament.format)}</span>
                      </div>
                      <div className="flex gap-4 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Users size={12} className="text-neutral-100" />
                          <span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span>
                        </div>
                        {tournament.play_until && (
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-neutral-100" />
                            <span className="text-neutral-200">{formatPlayUntil(getPlayUntil(tournament))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  {canDeleteTournament(tournament) && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
                      className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10">
                      <Trash2 className="text-red-400" size={12}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Beendet */}
          {finishedTournaments.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1">
                Historie
              </h3>
              {finishedTournaments.map(tournament => (
                <div key={tournament.id} className="relative mb-3">
                  <button
                    onClick={() => setSelectedTournament(tournament)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left opacity-70"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                        {tournament.winner && (
                          <p className="text-[10px] text-yellow-400 font-bold">
                            <Crown size={10} className="inline mr-1" />{tournament.winner}
                          </p>
                        )}
                      </div>
                      <Trophy size={16} className="text-yellow-400" />
                    </div>
                    <div className="flex gap-4 text-[10px]">
                      <span className="text-neutral-400">{questionCount(tournament)} Fragen</span>
                      <span className="text-neutral-400">{tournament.current_participants} Teilnehmer</span>
                    </div>
                  </button>
                  {canDeleteTournament(tournament) && (
                    <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
                      className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10">
                      <Trash2 className="text-red-400" size={12}/>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {renderDeleteModal()}
    </Background>
  );
};

export default TournamentsView;