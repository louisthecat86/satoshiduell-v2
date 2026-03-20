import React, { useState, useEffect, useCallback } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Trophy, Users, Crown, RefreshCw, Trash2, Timer, Share2, Shield, Link2, Clock, XCircle, KeyRound, Swords, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import BracketTree from '../components/ui/BracketTree';
import { useTranslation } from '../hooks/useTranslation';
import { deleteTournament, fetchTournaments, fetchTournamentPrizes, fetchMyTournamentRegistrations, fetchBracketMatches, fetchTournamentById, finalizeTournamentIfReady, redeemTournamentToken, getTournamentImageUrl } from '../services/supabase';
import { formatTime } from '../utils/formatters';

const TournamentsView = ({ onBack, onCreateTournament, onStartTournament, onOpenAdmin, onOpenRegistration }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [selectedPrizes, setSelectedPrizes] = useState([]);
  const [bracketMatches, setBracketMatches] = useState([]);
  const [localCanCreate, setLocalCanCreate] = useState(user?.can_create_tournaments || false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [tournaments, setTournaments] = useState([]);
  const [myRegistrations, setMyRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [tokenModal, setTokenModal] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => { if (user?.username) refreshUser(user.username); }, []);
  useEffect(() => { setLocalCanCreate(user?.can_create_tournaments || false); }, [user?.can_create_tournaments]);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    const [tournamentsResult, registrationsResult] = await Promise.all([
      fetchTournaments(),
      user?.username ? fetchMyTournamentRegistrations(user.username) : { data: [] },
    ]);
    if (tournamentsResult.error) setErrorMsg('Fehler beim Laden');
    setTournaments(tournamentsResult.data || []);
    setMyRegistrations(registrationsResult.data || []);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Wenn Turnier ausgewählt: Daten laden + ggf. frisch von DB holen
  const loadSelectedTournamentData = useCallback(async (tournament) => {
    if (!tournament) { setSelectedPrizes([]); setBracketMatches([]); return; }

    // Turnier frisch von DB laden (damit bracket-status aktuell ist)
    const { data: fresh } = await fetchTournamentById(tournament.id);
    if (fresh) {
      setSelectedTournament(fresh);
      setTournaments(prev => prev.map(t => t.id === fresh.id ? fresh : t));
    }

    const { data: prizes } = await fetchTournamentPrizes(tournament.id);
    setSelectedPrizes(prizes || []);

    if ((fresh || tournament).format === 'bracket') {
      const { data: matches } = await fetchBracketMatches(tournament.id);
      setBracketMatches(matches || []);
    }
  }, []);

  useEffect(() => { loadSelectedTournamentData(selectedTournament); }, [selectedTournament?.id]);

  // Auto-Finalisierung
  useEffect(() => {
    if (!selectedTournament || selectedTournament.status === 'finished' || !selectedTournament.play_until) return;
    finalizeTournamentIfReady(selectedTournament.id).then(({ data }) => {
      if (data) { setSelectedTournament(data); setTournaments(prev => prev.map(t => t.id === data.id ? data : t)); }
    });
  }, [selectedTournament?.id]);

  const visibleTournaments = tournaments.filter(t => ['registration', 'active', 'finished', 'archived'].includes(t.status));
  const getMyRegistration = (tid) => myRegistrations.find(r => r.tournament_id === tid);
  const canDeleteTournament = (t) => { if (!user) return false; if (user.is_admin) return true; return t.creator?.toLowerCase() === user.username?.toLowerCase(); };
  const isCreator = (t) => user && t && t.creator?.toLowerCase() === user.username?.toLowerCase();
  const isParticipant = (t) => { if (!t || !user?.username) return false; return (t.participants || []).some(p => (p || '').toLowerCase() === user.username.toLowerCase()); };

  const hasPlayed = (t) => {
    if (!t || !user?.username) return false;
    if (t.format === 'bracket') return false;
    const scores = t.participant_scores || {};
    return scores[user.username.toLowerCase()] !== undefined && scores[user.username.toLowerCase()] !== null;
  };

  const getMyBracketMatch = () => {
    if (!user?.username || bracketMatches.length === 0) return null;
    const me = user.username.toLowerCase();
    return bracketMatches.find(m =>
      ['ready', 'active'].includes(m.status) &&
      ((m.player1 || '').toLowerCase() === me || (m.player2 || '').toLowerCase() === me)
    );
  };

  const hasPlayedBracketMatch = (match) => {
    if (!match || !user?.username) return false;
    const me = user.username.toLowerCase();
    if ((match.player1 || '').toLowerCase() === me && match.player1_score !== null) return true;
    if ((match.player2 || '').toLowerCase() === me && match.player2_score !== null) return true;
    return false;
  };

  const canStartTournament = (t) => {
    if (!t || !isParticipant(t) || t.status === 'finished') return false;
    if (t.play_until && new Date(t.play_until) <= new Date()) return false;
    if (t.format === 'bracket') { const m = getMyBracketMatch(); return m && !hasPlayedBracketMatch(m); }
    return !hasPlayed(t);
  };

  const handleDeleteTournament = async (id) => { await deleteTournament(id); setDeleteConfirm(null); setSelectedTournament(null); await loadData(); };

  const handleRedeemToken = async (tid) => {
    if (!tokenInput.trim() || !user?.username) { setTokenError('Bitte Token eingeben'); return; }
    setTokenLoading(true); setTokenError('');
    const { data, error } = await redeemTournamentToken(tid, tokenInput.trim(), user.username);
    setTokenLoading(false);
    if (error) { setTokenError('Token ungültig oder bereits verwendet'); return; }
    setTokenModal(null); setTokenInput('');
    if (data) { setSelectedTournament(data); setTournaments(prev => prev.map(t => t.id === data.id ? data : t)); }
    await loadData();
  };

  // Bracket nach dem Spielen neu laden
  const handleStartTournamentWrapped = (tournament) => {
    if (onStartTournament) onStartTournament(tournament);
  };

  const statusLabel = (s) => ({ registration: 'Anmeldung offen', active: 'Läuft', finished: 'Beendet', archived: '📦 Archiviert' }[s] || s);
  const formatBadge = (f) => f === 'bracket' ? 'Bracket' : 'Highscore';
  const formatPlayUntil = (v) => { if (!v) return '-'; const d = new Date(v); return isNaN(d.getTime()) ? '-' : d.toLocaleString(); };
  const questionCount = (t) => t?.question_count || 0;
  const maxPlayersLabel = (t) => t?.max_players ? t.max_players : '∞';
  const roundDisplayName = (n) => ({ round_of_32: 'Runde der 32', round_of_16: 'Achtelfinale', quarter: 'Viertelfinale', semi: 'Halbfinale', final: '🏆 Finale' }[n] || n);

  const getResultsList = (tournament) => {
    const participants = Array.isArray(tournament?.participants) ? tournament.participants : [];
    const scores = tournament?.participant_scores || {};
    const times = tournament?.participant_times || {};
    return participants.map(name => {
      const key = (name || '').toLowerCase();
      const score = scores[key]; const timeMs = times[key];
      const played = score !== undefined && score !== null;
      return { name, key, score: played ? score : null, timeMs: played ? timeMs : null, played };
    }).sort((a, b) => {
      if (a.played !== b.played) return a.played ? -1 : 1;
      if (a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
      return (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity);
    });
  };

  const fmtTime = (ms) => (ms === null || ms === undefined) ? '-' : formatTime(Math.max(0, ms) / 1000);

  const handleShareTournament = async (tournament) => {
    if (!tournament?.invite_code) return;
    const url = `https://www.satoshiduell.com/t/${tournament.invite_code}`;
    const text = `🏆 ${tournament.name}\n${tournament.description || ''}\n\nJetzt teilnehmen: ${url}`;
    try { if (navigator.share) await navigator.share({ title: tournament.name, text, url }); else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); alert('Link kopiert!'); } } catch (e) {}
  };

  const carbonStyle = {
    backgroundImage: ['linear-gradient(120deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 35%, rgba(0,0,0,0) 60%)','linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)','repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 2px, rgba(0,0,0,0.05) 2px 4px)','repeating-linear-gradient(-45deg, rgba(255,255,255,0.03) 0 2px, rgba(0,0,0,0.03) 2px 4px)'].join(', ')
  };

  // ============================================
  // BRACKET TREE
  // ============================================
  const BracketTree = ({ matches }) => {
    if (!matches || matches.length === 0) return <p className="text-xs text-neutral-500 text-center py-4">Bracket wird generiert sobald alle Plätze besetzt sind.</p>;

    const rounds = {};
    matches.forEach(m => { if (!rounds[m.round_name]) rounds[m.round_name] = []; rounds[m.round_name].push(m); });
    const roundOrder = ['round_of_32', 'round_of_16', 'quarter', 'semi', 'final'];
    const sortedRounds = Object.keys(rounds).sort((a, b) => roundOrder.indexOf(a) - roundOrder.indexOf(b));
    const me = (user?.username || '').toLowerCase();

    return (
      <div className="space-y-5">
        {sortedRounds.map(roundName => {
          const roundMatches = rounds[roundName];
          const allFinished = roundMatches.every(m => m.status === 'finished');
          const someActive = roundMatches.some(m => m.status === 'ready' || m.status === 'active');

          return (
            <div key={roundName}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className={`text-[10px] font-bold uppercase tracking-widest pl-1 ${
                  someActive ? 'text-green-400' : allFinished ? 'text-neutral-600' : 'text-purple-400'
                }`}>
                  {roundDisplayName(roundName)}
                </h4>
                {someActive && <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
                {allFinished && <span className="text-[9px] text-neutral-600">✓</span>}
              </div>
              <div className="space-y-2">
                {roundMatches.map(match => {
                  const isMyMatch = me && (
                    (match.player1 || '').toLowerCase() === me || (match.player2 || '').toLowerCase() === me
                  );
                  return <MatchCard key={match.id} match={match} isMyMatch={isMyMatch} me={me} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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
                  <Trash2 size={18} /> Löschen</button>
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
                  {tokenLoading ? 'Prüfe...' : 'Beitreten'}</button>
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
    const isBracket = selectedTournament.format === 'bracket';
    const myMatch = isBracket ? getMyBracketMatch() : null;

    const getOpponentName = () => {
      if (!myMatch || !user?.username) return null;
      const me = user.username.toLowerCase();
      return (myMatch.player1 || '').toLowerCase() === me ? myMatch.player2 : myMatch.player1;
    };

    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 mb-6 pt-4">
            <div className="flex items-center gap-4">
              <button onClick={() => { setSelectedTournament(null); setBracketMatches([]); }} className="bg-white/10 p-2 rounded-xl hover:bg-white/20">
                <ArrowLeft className="text-white" size={20} />
              </button>
              <div>
                <h2 className="text-lg font-black text-white uppercase tracking-widest">{selectedTournament.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isBracket ? 'bg-blue-500/30 text-blue-300' : 'bg-purple-500/30 text-purple-300'}`}>
                    {formatBadge(selectedTournament.format)}</span>
                  <span className="text-xs text-neutral-500">{statusLabel(selectedTournament.status)}</span>
                </div>
              </div>
            </div>
            {canDeleteTournament(selectedTournament) && (
              <button onClick={() => setDeleteConfirm({ id: selectedTournament.id, name: selectedTournament.name })}
                className="bg-red-500/20 p-2 rounded-xl hover:bg-red-500/30 border border-red-500/50">
                <Trash2 className="text-red-400" size={20} />
              </button>
            )}
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

          {/* Registrierung für Nicht-Teilnehmer */}
          {!amParticipant && !amCreator && (
            <div className="px-4 mb-4">
              {!myReg && selectedTournament.status !== 'finished' && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 text-center">
                  <Trophy size={24} className="text-purple-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-2">An diesem Turnier teilnehmen?</p>
                  <Button onClick={() => onOpenRegistration && onOpenRegistration(selectedTournament.id, selectedTournament.invite_code)}
                    className="w-full bg-purple-500 hover:bg-purple-400 text-black font-black py-3">Registrieren</Button>
                </div>
              )}
              {myReg?.status === 'pending' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 text-center">
                  <Clock size={24} className="text-orange-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-1">Registrierung wird geprüft</p>
                  <p className="text-xs text-neutral-400">Du erhältst deinen Code über {myReg.identity_display}.</p>
                </div>
              )}
              {myReg?.status === 'approved' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 text-center">
                  <KeyRound size={24} className="text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white mb-1">Registrierung genehmigt!</p>
                  <button onClick={() => { setTokenInput(''); setTokenError(''); setTokenModal({ tournamentId: selectedTournament.id }); }}
                    className="w-full mt-3 bg-green-500 text-black font-black py-3 rounded-xl hover:bg-green-400 flex items-center justify-center gap-2">
                    <KeyRound size={18} /> Code eingeben</button>
                </div>
              )}
              {myReg?.status === 'rejected' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-center">
                  <XCircle size={24} className="text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white">Registrierung abgelehnt</p>
                </div>
              )}
            </div>
          )}

          {/* BRACKET: Mein aktuelles Match */}
          {isBracket && amParticipant && myMatch && !hasPlayedBracketMatch(myMatch) && (
            <div className="px-4 mb-4">
              <div className="bg-green-500/10 border border-green-500/40 rounded-2xl p-4">
                <div className="text-center mb-3">
                  <Swords size={28} className="text-green-400 mx-auto mb-2" />
                  <h3 className="text-sm font-black text-white uppercase">Dein Match — {roundDisplayName(myMatch.round_name)}</h3>
                </div>
                <div className="bg-black/30 rounded-xl p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-green-300">{user?.username}</span>
                    <span className="text-[10px] text-neutral-500 font-bold">⚔️</span>
                    <span className="text-sm font-bold text-white">{getOpponentName() || '???'}</span>
                  </div>
                </div>
                <Button onClick={() => handleStartTournamentWrapped(selectedTournament)}
                  className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 flex items-center justify-center gap-2 text-lg">
                  ⚔️ Match spielen
                </Button>
              </div>
            </div>
          )}

          {isBracket && amParticipant && myMatch && hasPlayedBracketMatch(myMatch) && (
            <div className="px-4 mb-4">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 text-center">
                <Clock size={24} className="text-yellow-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-white">Warte auf {getOpponentName()}</p>
                <p className="text-xs text-neutral-400 mt-1">Dein Gegner muss noch spielen</p>
              </div>
            </div>
          )}

          {isBracket && amParticipant && !myMatch && selectedTournament.status === 'active' && !selectedTournament.winner && (
            <div className="px-4 mb-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
                <p className="text-xs text-neutral-400">Warte auf die nächste Runde oder du bist ausgeschieden.</p>
              </div>
            </div>
          )}

          {/* HIGHSCORE: Quiz starten */}
          {!isBracket && canStartTournament(selectedTournament) && (
            <div className="px-4 mb-4">
              <Button onClick={() => handleStartTournamentWrapped(selectedTournament)}
                className="w-full bg-green-500 hover:bg-green-400 text-black font-black py-4 flex items-center justify-center gap-2 text-lg">
                🎮 Quiz starten</Button>
            </div>
          )}
          {!isBracket && amParticipant && hasPlayed(selectedTournament) && (
            <div className="px-4 mb-2 text-center text-xs text-neutral-400 font-bold">✓ Du hast bereits gespielt</div>
          )}

          {/* Info Card */}
          <div className="px-4 mb-4">
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                {!isBracket && <div><div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Fragen</div><div className="text-lg font-black text-white">{questionCount(selectedTournament)}</div></div>}
                <div><div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Teilnehmer</div><div className="text-lg font-black text-white">{selectedTournament.current_participants}/{maxPlayersLabel(selectedTournament)}</div></div>
                {isBracket && <div><div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">Modus</div><div className="text-lg font-black text-blue-400">K.O.</div></div>}
              </div>
              {selectedTournament.play_until && (
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-neutral-300">
                  <Timer size={14} className="text-orange-400" /> Deadline: {formatPlayUntil(selectedTournament.play_until)}</div>
              )}
              {selectedTournament.sponsor_name && (
                <div className="mt-2 text-center text-[11px] text-neutral-300">Sponsor: <span className="font-bold text-white">{selectedTournament.sponsor_name}</span></div>
              )}
              {selectedTournament.description && <p className="mt-3 text-xs text-neutral-400 text-center">{selectedTournament.description}</p>}
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
                    <button onClick={() => { navigator.clipboard.writeText(`https://www.satoshiduell.com/t/${selectedTournament.invite_code}`); alert('Kopiert!'); }}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 flex items-center justify-center gap-1"><Link2 size={12} /> Kopieren</button>
                    <button onClick={() => handleShareTournament(selectedTournament)}
                      className="flex-1 bg-purple-500/20 text-purple-300 text-xs font-bold py-2 rounded-lg hover:bg-purple-500/30 flex items-center justify-center gap-1"><Share2 size={12} /> Teilen</button>
                  </div>
                </div>
              )}
              <Button onClick={() => onOpenAdmin && onOpenAdmin(selectedTournament.id)}
                className="w-full bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-black py-3 flex items-center justify-center gap-2 border border-purple-500/30">
                <Shield size={18} /> Admin Dashboard</Button>
            </div>
          )}

          {/* Preise */}
          {selectedPrizes.length > 0 && (
            <div className="px-4 mb-4">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Preise</h3>
                {selectedPrizes.map((prize, idx) => {
                  const emoji = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                  return (
                    <div key={prize.id} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2 mb-1">
                      <span className="text-sm">{emoji}</span>
                      <div className="flex-1"><div className="text-xs font-bold text-white truncate">{prize.title}</div>
                        {prize.winner_username && <div className="text-[10px] text-yellow-400"><Crown size={10} className="inline mr-1" />{prize.winner_username}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BRACKET TREE — für ALLE sichtbar */}
          {isBracket && (
            <div className="px-4 mb-4">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Turnierbaum</h3>
                <BracketTree matches={bracketMatches} currentUser={user?.username} />
              </div>
            </div>
          )}

          {/* HIGHSCORE Rangliste */}
          {!isBracket && resultsList.length > 0 && (
            <div className="px-4 mb-4">
              <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-3 ml-1">Rangliste</h3>
                {resultsList.map((entry, index) => {
                  const w = selectedTournament.winner && entry.name.toLowerCase() === selectedTournament.winner.toLowerCase();
                  return (
                    <div key={entry.key || index} className={`flex items-center justify-between rounded-xl px-3 py-2 border mb-1 ${w ? 'border-yellow-500/40 bg-yellow-500/10' : 'border-white/5 bg-white/5'}`}>
                      <div className="flex items-center gap-2">
                        <div className="w-6 text-[10px] text-neutral-500 font-bold">{index + 1}.</div>
                        <div className="text-xs font-bold text-white">{entry.name}</div>
                        {w && <Crown size={12} className="text-yellow-400" />}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-neutral-300">
                        <div>{entry.played ? `${entry.score} Pkt` : '-'}</div>
                        <div>{entry.played ? fmtTime(entry.timeMs) : 'Ausstehend'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Gewinner */}
          {selectedTournament.status === 'finished' && selectedTournament.winner && (
            <div className="px-4 mb-6">
              <div className={`${isWinner ? 'bg-green-500/10 border-green-500/30' : 'bg-yellow-500/10 border-yellow-500/30'} border rounded-2xl p-4 text-center`}>
                <Crown size={24} className="text-yellow-400 mx-auto mb-2" />
                {isWinner ? (
                  <><p className="text-sm font-bold text-white mb-1">Du hast gewonnen!</p><p className="text-xs text-neutral-400">Der Veranstalter kontaktiert dich.</p></>
                ) : (
                  <p className="text-sm font-bold text-white">Gewinner: {selectedTournament.winner}</p>
                )}
              </div>
            </div>
          )}
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
  const finishedTournaments = visibleTournaments.filter(t => t.status === 'finished' || t.status === 'archived').slice(0, 10);

  const RegistrationBadge = ({ registration }) => {
    if (!registration) return null;
    if (registration.status === 'pending') return <div className="flex items-center gap-1 text-[10px] text-orange-400 font-bold"><Clock size={10} /> Wird geprüft</div>;
    if (registration.status === 'approved') return <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold"><KeyRound size={10} /> Code eingeben</div>;
    if (registration.status === 'rejected') return <div className="flex items-center gap-1 text-[10px] text-red-400 font-bold"><XCircle size={10} /> Abgelehnt</div>;
    return null;
  };

  const renderCard = (tournament, borderColor, bgGradient) => {
    const myReg = getMyRegistration(tournament.id);
    const imageUrl = tournament.image_url || getTournamentImageUrl(tournament.image_path);
    const amPart = isParticipant(tournament);
    return (
      <div key={tournament.id} className="relative mb-3">
        <button onClick={() => setSelectedTournament(tournament)}
          className={`w-full border ${borderColor} rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left relative overflow-hidden`}>
          {imageUrl ? (<><div className="absolute inset-0" style={{ backgroundImage: `url(${imageUrl})`, backgroundSize: '130%', backgroundPosition: 'center', filter: 'blur(2px)', transform: 'scale(1.05)' }} /><div className={`absolute inset-0 ${bgGradient}`} /></>) : <div className={`absolute inset-0 ${bgGradient}`} />}
          <div className="relative">
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-white font-black text-sm flex-1">{tournament.name}</h4>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-2 ${tournament.format === 'bracket' ? 'bg-blue-500/30 text-blue-200' : 'bg-purple-500/30 text-purple-200'}`}>{formatBadge(tournament.format)}</span>
            </div>
            {tournament.description && <p className="text-[10px] text-neutral-200 line-clamp-1 mb-2">{tournament.description}</p>}
            <div className="flex gap-4 text-[10px]">
              <div className="flex items-center gap-1"><Users size={12} className="text-neutral-100" /><span className="text-white font-bold">{tournament.current_participants}/{maxPlayersLabel(tournament)}</span></div>
              {amPart && <span className="text-green-300 font-bold">✓ Dabei</span>}
            </div>
            {myReg && !amPart && <div className="mt-2"><RegistrationBadge registration={myReg} /></div>}
          </div>
        </button>
        {canDeleteTournament(tournament) && (
          <button onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
            className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 border border-red-500/50 z-10"><Trash2 className="text-red-400" size={12} /></button>
        )}
      </div>
    );
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        <div className="p-6 pb-2 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20"><ArrowLeft className="text-white" size={20} /></button>
          <div className="flex-1"><h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2"><Trophy size={24} /> Community Turniere</h2></div>
          <button onClick={() => { refreshUser(user?.username); loadData(); }} className="bg-white/10 p-2 rounded-xl hover:bg-white/20"><RefreshCw className="text-white" size={20} /></button>
        </div>
        {localCanCreate && (
          <div className="px-4 mb-4"><div style={carbonStyle} className="border border-white/10 rounded-2xl p-4 text-center shadow-lg shadow-black/40">
            <Crown className="text-white/80 mx-auto mb-2" size={32} /><p className="text-xs text-neutral-300 mb-3">Du bist berechtigt, Turniere zu erstellen</p>
            <Button onClick={onCreateTournament} className="w-full bg-white/10 hover:bg-white/20 text-white">Turnier erstellen</Button>
          </div></div>
        )}
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 scrollbar-hide">
          {loading && <div className="text-center text-neutral-500 text-sm py-10">Lade Turniere...</div>}
          {!loading && visibleTournaments.length === 0 && (
            <div className="text-center py-16"><Trophy size={48} className="text-neutral-700 mx-auto mb-4" /><p className="text-neutral-500 text-sm">Keine Turniere vorhanden</p></div>
          )}
          {activeTournaments.length > 0 && (<div><h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3 pl-1">Läuft</h3>{activeTournaments.map(t => renderCard(t, 'border-green-500/30', 'bg-gradient-to-r from-green-500/30 to-emerald-500/30'))}</div>)}
          {registrationTournaments.length > 0 && (<div><h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 pl-1">Anmeldung offen</h3>{registrationTournaments.map(t => renderCard(t, 'border-orange-500/30', 'bg-gradient-to-r from-orange-500/20 to-yellow-500/20'))}</div>)}
          {finishedTournaments.length > 0 && (<div><h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1">Historie</h3>
            {finishedTournaments.map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                <button onClick={() => setSelectedTournament(tournament)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left opacity-70">
                  <div className="flex items-start justify-between mb-2"><div className="flex-1"><h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                    {tournament.winner && <p className="text-[10px] text-yellow-400 font-bold"><Crown size={10} className="inline mr-1" />{tournament.winner}</p>}</div>
                    <Trophy size={16} className="text-yellow-400" /></div>
                </button>
                {canDeleteTournament(tournament) && (
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirm({ id: tournament.id, name: tournament.name }); }}
                    className="absolute -top-2 -right-2 bg-black/70 p-1.5 rounded-lg hover:bg-red-500/30 border border-red-500/50 z-10"><Trash2 className="text-red-400" size={12} /></button>
                )}
              </div>
            ))}
          </div>)}
        </div>
      </div>
      {renderModals()}
    </Background>
  );
};

export default TournamentsView;