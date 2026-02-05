import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { Trophy, Frown, Loader2, Home, Clock, Target, CheckCircle2, RefreshCw, RefreshCcw, Wallet, Copy, Hourglass, UserPlus } from 'lucide-react'; 
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { getGameStatus, markGameAsClaimed, fetchProfiles, fetchTournamentById } from '../services/supabase';
import { createWithdrawLink, getWithdrawLinkStatus } from '../services/lnbits';
import confetti from 'canvas-confetti';
import { QRCodeCanvas } from 'qrcode.react';

const ResultView = ({ gameData, onHome }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const userName = user?.username || user?.name || '';

  const [finalGameData, setFinalGameData] = useState(gameData);
  const [viewStatus, setViewStatus] = useState('loading'); 
  const [withdrawData, setWithdrawData] = useState(null); 
  const [isClaimed, setIsClaimed] = useState(false); // Initial false, wird durch useEffect gesetzt
  const [isChecking, setIsChecking] = useState(false);
  const [payoutChoice, setPayoutChoice] = useState('full');
  const [showPayoutQr, setShowPayoutQr] = useState(false);
  const [creatorAvatar, setCreatorAvatar] = useState(null);
  const [challengerAvatar, setChallengerAvatar] = useState(null);
  const [arenaAvatars, setArenaAvatars] = useState({}); // Map: username -> avatar URL

  // --- HELPER: Normalisierung für case-insensitive Vergleiche ---
  const normalize = (str) => (str || "").toLowerCase().trim();

  // --- GAME MODE & PLAYER DATA ---
  const isArena = finalGameData.mode === 'arena';
  const isTournament = finalGameData.mode === 'tournament';
  const isCreator = normalize(userName) === normalize(finalGameData.creator);
  const hasChallenger = !!finalGameData.challenger;

  const myData = isCreator
    ? { 
        name: finalGameData.creator,
        score: finalGameData.creator_score, 
        time: finalGameData.creator_time,
        avatar: creatorAvatar
      }
    : { 
        name: finalGameData.challenger || userName,
        score: finalGameData.challenger_score, 
        time: finalGameData.challenger_time,
        avatar: challengerAvatar
      };
  
  const opData = isCreator
    ? { 
        name: finalGameData.challenger || finalGameData.target_player || '???',
        score: finalGameData.challenger_score, 
        time: finalGameData.challenger_time,
        avatar: challengerAvatar
      }
    : { 
        name: finalGameData.creator,
        score: finalGameData.creator_score, 
        time: finalGameData.creator_time,
        avatar: creatorAvatar
      };

  useEffect(() => {
      const determineStatus = () => {
          if (isTournament) {
            const key = normalize(userName);
            const scores = finalGameData.participant_scores || {};
            const played = scores[key] !== undefined && scores[key] !== null;
            if (!played) return 'waiting_play';
            if (finalGameData.status !== 'finished') return 'waiting_result';
            if (finalGameData.winner && normalize(finalGameData.winner) === key) return 'win';
            return 'lose';
          }
          // A. Refund
            if (finalGameData.status === 'refunded' || finalGameData.withdraw_link) {
              if (finalGameData.withdraw_link) setWithdrawData({ lnurl: finalGameData.withdraw_link, id: finalGameData.withdraw_id });
              return 'refund';
            }

          if (isArena) {
              const userKey = normalize(userName);
              const refundLinks = finalGameData.refund_links || {};
              const refundIds = finalGameData.refund_ids || {};
              if (refundLinks[userKey]) {
                setWithdrawData({ lnurl: refundLinks[userKey], id: refundIds[userKey] });
                return 'refund';
              }
            const participants = Array.isArray(finalGameData.participants) ? finalGameData.participants : [];
            const scores = finalGameData.participant_scores || {};

            if (participants.length === 0 || finalGameData.status === 'open') return 'waiting_join';

            const allPlayed = participants.every(p => scores[p] !== undefined && scores[p] !== null);
            if (!allPlayed) return 'waiting_play';

            const winner = finalGameData.winner;
            if (winner && normalize(winner) === normalize(userName)) return 'win';
            if (winner && normalize(winner) !== normalize(userName)) return 'lose';
            return 'waiting_play';
          }

          // B. Waiting Join
          if (finalGameData.status === 'open') return 'waiting_join';

          // C. Waiting Play (Jemand hat noch keinen Score)
          if (finalGameData.status === 'active') {
              if (myData.score === null) return 'waiting_play'; 
              if (opData.score === null) return 'waiting_play';
          }

          // D. Finished
          if (finalGameData.status === 'finished' || (myData.score !== null && opData.score !== null)) {
              if (myData.score > opData.score) return 'win';
              if (opData.score > myData.score) return 'lose';
              if (myData.time < opData.time) return 'win'; // Zeit-Tiebreaker
              if (opData.time < myData.time) return 'lose';
              return 'draw';
          }

          return 'waiting_play';
      };

      const s = determineStatus();
      setViewStatus(s);

      // Gewinnlink wird erst nach Auswahl/Bestätigung erzeugt

  }, [finalGameData, isClaimed]); // myData/opData hängen von finalGameData ab

  useEffect(() => {
    if (viewStatus !== 'win' || isClaimed || finalGameData.is_claimed) return;
    if (!showPayoutQr) return;
    setWithdrawData(null);
    generateWinLink(payoutAmount);
  }, [payoutChoice, showPayoutQr]);

  // --- SYNC isClaimed mit finalGameData (auch beim initialen Laden) ---
  useEffect(() => {
    const claimed = finalGameData.is_claimed || finalGameData.claimed || false;
    console.log('Claimed status check:', {
      gameId: finalGameData.id,
      is_claimed: finalGameData.is_claimed,
      claimed: finalGameData.claimed,
      computed: claimed,
      currentIsClaimed: isClaimed
    });
    if (claimed !== isClaimed) {
      setIsClaimed(claimed);
    }
  }, [finalGameData.is_claimed, finalGameData.claimed, finalGameData.id]);


  // --- 4. LIVE UPDATE ---
  useEffect(() => {
    if (isTournament) return;
    if (['win', 'lose', 'draw', 'refund'].includes(viewStatus)) return;

    const interval = setInterval(async () => {
      const { data } = await getGameStatus(gameData.id);
      if (data) {
        // Prüfen auf Änderungen
        if (data.status !== finalGameData.status || 
            data.challenger !== finalGameData.challenger || 
            data.creator_score !== finalGameData.creator_score || 
            data.challenger_score !== finalGameData.challenger_score) {
             
             setFinalGameData(data);
             // Avatare nachladen wenn Gegner joint
             if (data.challenger && !challengerAvatar) loadAvatars([data.creator, data.challenger]);
        }
      }
    }, 3000); 

    return () => clearInterval(interval);
  }, [viewStatus, gameData.id, finalGameData]);

  useEffect(() => {
    if (!isTournament) return;

    const interval = setInterval(async () => {
      const { data } = await fetchTournamentById(finalGameData.id);
      if (data) {
        setFinalGameData({ ...data, mode: 'tournament' });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isTournament, finalGameData.id]);


  // --- 5. AVATAR LOADING ---
  const loadAvatars = async (usernames) => {
      const { data: profiles } = await fetchProfiles(usernames);
      const map = {};
      profiles?.forEach(p => map[p.username] = p.avatar || null);
      
      if (isArena) {
        // Für Arena: Alle Teilnehmer-Avatare speichern
        setArenaAvatars(map);
      } else {
        // Für Duel: Creator und Challenger separat
        const cAvatar = map[finalGameData.creator];
        const chAvatar = map[finalGameData.challenger || finalGameData.target_player];
        
        setCreatorAvatar(cAvatar);
        setChallengerAvatar(chAvatar);
      }
  };
  
  useEffect(() => {
     if (isArena) {
       // Lade Avatare aller Arena-Teilnehmer
       const participants = finalGameData.participants || [];
       if (participants.length > 0 && Object.keys(arenaAvatars).length === 0) {
         loadAvatars(participants);
       }
     } else {
       // Lade Creator/Challenger Avatare für Duels
       if (!creatorAvatar || (hasChallenger && !challengerAvatar)) {
           loadAvatars([finalGameData.creator, finalGameData.challenger || finalGameData.target_player].filter(Boolean));
       }
     }
  }, [finalGameData.participants, finalGameData.challenger]);

  if (isTournament) {
    const scores = finalGameData.participant_scores || {};
    const times = finalGameData.participant_times || {};
    const myKey = normalize(userName);
    const myScore = scores[myKey];
    const myTime = times[myKey];
    const isCreatorView = normalize(userName) === normalize(finalGameData.creator);
    const winnerToken = finalGameData.winner_token;
    const isWinner = Boolean(finalGameData.winner)
      && normalize(finalGameData.winner) === normalize(userName);
    const tournamentTitle = viewStatus === 'win'
      ? t('tournament_result_win')
      : viewStatus === 'lose'
        ? t('tournament_result_lose')
        : viewStatus === 'waiting_result'
          ? t('tournament_result_scoring')
          : t('tournament_result_waiting');

    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-md mx-auto p-6 text-center">
          <div className="mb-6">
            <h2 className="text-2xl font-black uppercase text-white">
              {tournamentTitle}
            </h2>
            <p className="text-neutral-400 text-sm mt-2">{finalGameData.name}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase">{t('tournament_score_label')}</span>
                <p className="text-white font-black">{myScore ?? '-'}</p>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase">{t('tournament_time_label')}</span>
                <p className="text-white font-black">{myTime ? `${(myTime / 1000).toFixed(1)}s` : '-'}</p>
              </div>
              <div className="col-span-2">
                <span className="text-[10px] text-neutral-400 font-bold uppercase">{t('tournament_winner_label')}</span>
                <p className="text-white font-black">{finalGameData.winner || '-'}</p>
              </div>
            </div>
          </div>

          {isWinner && winnerToken && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-6">
              <p className="text-xs text-neutral-300 mb-2">{t('tournament_payout_token_hint')}</p>
              <div className="font-mono text-lg text-green-300">{winnerToken}</div>
              <p className="text-[10px] text-neutral-400 mt-2">{t('tournament_payout_token_persist_hint')}</p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(winnerToken);
                  alert(t('nostr_copied') || 'Kopiert!');
                }}
                className="mt-3 w-full px-4 py-2 rounded-xl bg-white/10 text-white font-bold hover:bg-white/20 transition-all"
              >
                {t('btn_copy_withdraw')}
              </button>
            </div>
          )}

          {isCreatorView && winnerToken && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mb-6">
              <p className="text-xs text-neutral-300 mb-2">{t('tournament_creator_token_hint')}</p>
              <div className="font-mono text-lg text-purple-300">{winnerToken}</div>
            </div>
          )}

          <Button
            onClick={onHome}
            className="w-full bg-white/10 text-white hover:bg-white/20"
          >
            {t('back_home')}
          </Button>
        </div>
      </Background>
    );
  }


  // --- 6. GEWINN LOGIK ---
  const fullWinAmount = isArena
    ? finalGameData.amount * (finalGameData.max_players || (finalGameData.participants || []).length || 2)
    : finalGameData.amount * 2;
  const payoutAmount = payoutChoice === 'donate1'
    ? Math.max(1, Math.floor(fullWinAmount * 0.99))
    : fullWinAmount;
  const donationAmount = fullWinAmount - payoutAmount;

  const generateWinLink = async (amountOverride = null) => {
      if (withdrawData) return;
      const winAmount = amountOverride ?? payoutAmount;
      const dataLink = await createWithdrawLink(winAmount, finalGameData.id);
      if (dataLink?.lnurl) {
          setWithdrawData(dataLink);
      }
  };

  const handleClaimSuccess = async () => {
      if (isClaimed) return;
      setIsClaimed(true);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      console.log('🎉 Calling markGameAsClaimed...');
      const result = await markGameAsClaimed(finalGameData.id, payoutAmount, donationAmount);
      console.log('markGameAsClaimed completed:', result);
      setTimeout(() => onHome(), 2500);
  };

  const checkWithdrawStatus = async () => {
    if (!withdrawData?.id || isClaimed) return;
    setIsChecking(true);
    console.log('Checking withdraw status for:', withdrawData.id);
    const claimed = await getWithdrawLinkStatus(withdrawData.id);
    console.log('Withdraw status result:', claimed);
    setIsChecking(false);
    if (claimed) {
      console.log('✅ Withdraw was claimed! Marking game as claimed...');
      await handleClaimSuccess();
    }
  };
  
  useEffect(() => {
    let interval;
    if (withdrawData?.id && !isClaimed) {
      console.log('Starting auto-check for withdraw link:', withdrawData.id);
      interval = setInterval(async () => {
          const claimed = await getWithdrawLinkStatus(withdrawData.id);
          console.log('Auto-check result:', claimed);
          if (claimed) { 
            clearInterval(interval); 
            console.log('✅ Auto-detected claim! Marking game...');
            await handleClaimSuccess(); 
          }
      }, 3000); 
    }
    return () => {
      if (interval) {
        console.log('Stopping auto-check');
        clearInterval(interval);
      }
    };
  }, [withdrawData, isClaimed]);


  // ==========================================
  // VIEW: REFUND
  // ==========================================
  if (viewStatus === 'refund') {
    return (
        <Background>
          <div className="w-full max-w-md mx-auto relative p-6 flex flex-col items-center justify-center min-h-[80vh]">
              <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500 mb-6 animate-pulse">
                 <RefreshCcw size={48} className="text-red-500"/>
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Rückerstattung</h2>
              <p className="text-neutral-400 text-sm text-center mb-8 px-4">
                  Das Spiel wurde storniert. Hier ist dein Einsatz zurück.
              </p>
              
              {!isClaimed && withdrawData?.lnurl ? (
                  <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.2)] mb-6 relative group flex flex-col items-center gap-4">
                       <QRCodeCanvas value={withdrawData.lnurl} size={200} />
                       <a href={`lightning:${withdrawData.lnurl}`} className="w-full bg-red-500 py-3 rounded-lg text-white font-bold text-center flex items-center justify-center gap-2">
                           <Wallet size={18}/> Wallet öffnen
                       </a>
                       <button onClick={checkWithdrawStatus} className="text-xs text-neutral-400 flex items-center gap-1">
                           <RefreshCw size={12} className={isChecking ? "animate-spin":""}/> Status prüfen
                       </button>
                  </div>
              ) : (
                <div className="bg-green-500/20 border border-green-500 p-6 rounded-xl text-center">
                    <CheckCircle2 className="mx-auto text-green-500 mb-2" size={32}/>
                    <span className="font-bold text-green-200">Erstattet!</span>
                </div>
              )}
              <Button onClick={onHome} variant="secondary" className="mt-8 w-full">Zum Dashboard</Button>
          </div>
        </Background>
    );
  }

  // ==========================================
  // VIEW: WAIT / RESULT
  // ==========================================
  
  let headerIcon = <Loader2 size={48} className="text-orange-500 animate-spin mb-4" />;
  let headerTitle = t('result_waiting_title');
  let headerSub = t('result_waiting_subtitle');

  if (viewStatus === 'waiting_join') {
      headerIcon = <UserPlus size={48} className="text-blue-400 animate-pulse mb-4" />;
      headerTitle = isArena ? t('arena_waiting_full') : "WARTEN AUF GEGNER";
      headerSub = isArena ? t('arena_waiting_sub') : "Das Spiel ist offen.";
  } else if (viewStatus === 'waiting_play') {
      headerIcon = <Loader2 size={48} className="text-yellow-500 animate-spin mb-4" />;
      headerTitle = isArena ? t('arena_waiting_results') : "WARTEN AUF ERGEBNIS";
      headerSub = isArena ? t('arena_waiting_results_sub') : "Jemand muss noch spielen...";
  } else if (viewStatus === 'win') {
      headerIcon = <Trophy size={64} className="text-yellow-400 mb-4 drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]" />;
      headerTitle = t('result_win_title');
      headerSub = `+${payoutAmount} SATS`;
  } else if (viewStatus === 'lose') {
      headerIcon = <Frown size={64} className="text-neutral-600 mb-4" />;
      headerTitle = t('result_lose_title');
      headerSub = t('result_lose_subtitle');
  } else if (viewStatus === 'draw') {
      headerIcon = <span className="text-6xl mb-4">🤝</span>;
      headerTitle = t('result_draw_title');
      headerSub = t('result_draw_subtitle');
  }

  return (
    <Background>
      <div className="flex flex-col h-[100vh] w-full max-w-md mx-auto relative overflow-y-auto p-4 pb-20 scrollbar-hide">

        {/* ARENA: Vollständige Bestenlisten-Ansicht */}
        {isArena ? (
          <div className="flex-1 flex flex-col">
            {/* HEADER */}
            <div className="mb-6 text-center">
              {viewStatus === 'win' ? (
                <Trophy size={64} className="text-yellow-400 mb-4 mx-auto drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]" />
              ) : viewStatus === 'lose' ? (
                <Frown size={64} className="text-neutral-600 mb-4 mx-auto" />
              ) : (
                <Loader2 size={48} className="text-orange-500 animate-spin mb-4 mx-auto" />
              )}
              <h2 className={`text-3xl font-black uppercase italic ${viewStatus === 'win' ? 'text-green-400' : viewStatus === 'lose' ? 'text-red-400' : 'text-white'}`}>
                {viewStatus === 'win' ? t('result_win_title') : viewStatus === 'lose' ? t('result_lose_title') : t('arena_waiting_results')}
              </h2>
              {viewStatus === 'win' && (
                <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest font-bold">+{payoutAmount} SATS</p>
              )}
            </div>

            {/* BESTENLISTE */}
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4 mb-6">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4 text-center">{t('arena_scoreboard')}</h3>
              <div className="flex flex-col gap-3">
                {(() => {
                  const scores = finalGameData.participant_scores || {};
                  const times = finalGameData.participant_times || {};
                  const participants = finalGameData.participants || [];
                  
                  const rows = participants.map(p => ({
                    name: p,
                    score: scores[p] ?? null,
                    time: times[p] ?? null
                  }));

                  rows.sort((a, b) => {
                    if (a.score === null) return 1;
                    if (b.score === null) return -1;
                    if (b.score !== a.score) return b.score - a.score;
                    return (a.time ?? Infinity) - (b.time ?? Infinity);
                  });

                  return rows.map((row, idx) => {
                    const isMe = normalize(row.name) === normalize(userName);
                    const isWinner = idx === 0 && row.score !== null;
                    const placeIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                    const timeInSeconds = row.time !== null ? (row.time / 1000).toFixed(2) : '-';
                    
                    return (
                      <div 
                        key={row.name} 
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isWinner 
                            ? 'bg-yellow-500/10 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]' 
                            : isMe
                            ? 'bg-orange-500/10 border-orange-500/50'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        {/* Platzierung */}
                        <div className="flex items-center justify-center w-8">
                          {placeIcon ? (
                            <span className="text-2xl">{placeIcon}</span>
                          ) : (
                            <span className="text-sm font-black text-neutral-500">#{idx + 1}</span>
                          )}
                        </div>

                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-neutral-800 border-2 border-white/20 overflow-hidden flex-shrink-0">
                          <img 
                            src={arenaAvatars[row.name] || getCryptoPunkAvatar(row.name)}
                            alt={row.name}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className={`font-black uppercase text-sm truncate ${isWinner ? 'text-yellow-300' : isMe ? 'text-orange-400' : 'text-white'}`}>
                            {row.name}
                            {isMe && <span className="ml-1 text-[10px] text-neutral-500">(Du)</span>}
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="flex flex-col items-end gap-1">
                          <div className={`text-xs font-bold ${isWinner ? 'text-yellow-300' : 'text-green-400'}`}>
                            {row.score !== null ? `${row.score} Richtig` : 'Ausstehend'}
                          </div>
                          <div className="text-[10px] font-mono text-neutral-400">
                            {row.time !== null ? `${timeInSeconds}s` : '-'}
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* WIN PAYOUT (nur bei Gewinn) */}
            {viewStatus === 'win' && !isClaimed && (
               <div className="animate-in slide-in-from-bottom-4 duration-700 w-full mb-6 flex flex-col items-center">
                   <h3 className="font-black uppercase italic text-xl mb-4 text-white drop-shadow-md">{t('result_claim_title')}</h3>

                   <div className="w-full bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
                     <p className="text-xs text-neutral-400 mb-2 uppercase tracking-widest font-bold">{t('payout_choose_title')}</p>
                     <div className="flex gap-2">
                       <button
                         onClick={() => setPayoutChoice('full')}
                         className={`flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase ${payoutChoice === 'full' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}
                       >
                         {t('payout_full_label')}
                       </button>
                       <button
                         onClick={() => setPayoutChoice('donate1')}
                         className={`flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase ${payoutChoice === 'donate1' ? 'bg-orange-500 text-black' : 'bg-white/10 text-white'}`}
                       >
                         {t('payout_donate_label')}
                       </button>
                     </div>
                     {payoutChoice === 'donate1' && (
                       <p className="text-[10px] text-neutral-400 mt-2">
                         {t('payout_donate_hint', { amount: donationAmount })}
                       </p>
                     )}
                   </div>
                   
                   {!showPayoutQr ? (
                     <button
                       onClick={() => { setShowPayoutQr(true); generateWinLink(payoutAmount); }}
                       className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 py-4 rounded-xl text-black font-black uppercase text-center shadow-lg hover:scale-[1.02] transition-transform"
                     >
                       {t('payout_show_qr')}
                     </button>
                   ) : (
                     <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4 relative flex flex-col items-center gap-4">
                        {withdrawData?.lnurl ? (
                            <>
                               <QRCodeCanvas value={withdrawData.lnurl} size={260} level="H" includeMargin />
                                 <a href={`lightning:${withdrawData.lnurl}`} className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 py-3 rounded-lg text-black font-black uppercase text-center flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                                   <Wallet size={18}/> {t('btn_wallet')}
                               </a>
                               <button onClick={() => {navigator.clipboard.writeText(withdrawData.lnurl); alert(t('nostr_copied'));}} className="absolute top-2 right-2 p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200">
                                   <Copy size={14} className="text-neutral-500"/>
                               </button>
                            </>
                        ) : (
                            <Loader2 className="animate-spin text-orange-500" size={32}/>
                        )}
                     </div>
                   )}
               </div>
            )}

            {/* HOME BUTTON */}
            <div className="mt-auto">
              <Button onClick={onHome} variant="secondary" className="w-full py-4 flex items-center justify-center gap-2 shadow-lg hover:bg-white/10">
                <Home size={20}/> {t('result_home_button')}
              </Button>
            </div>
          </div>
        ) : (
          /* DUEL: Klassische VS-Ansicht */
          <div className="flex-1 flex flex-col items-center pt-8">
          
          {/* HEADER */}
          <div className="mb-8 text-center min-h-[120px] flex flex-col items-center justify-center">
              {headerIcon}
              <h2 className={`text-3xl font-black uppercase italic ${viewStatus === 'win' ? 'text-green-400' : viewStatus === 'lose' ? 'text-red-400' : 'text-white'}`}>
                  {headerTitle}
              </h2>
              <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest font-bold">
                  {headerSub}
              </p>
          </div>

          {/* SCORE CARD */}
          <div className="w-full flex items-center justify-center gap-2 mb-8 relative">
              {/* MY STATS */}
              <div className="flex-1 max-w-[160px]">
                  <PlayerStatCard 
                      name={myData.name} 
                      score={myData.score} 
                      time={myData.time} 
                      isMe={true} 
                      status={viewStatus} 
                      avatar={myData.avatar} 
                  />
              </div>

              {/* VS */}
              <div className="flex flex-col items-center justify-center z-10 -mx-2">
                 <div className="w-8 h-8 rounded-full bg-[#222] border-2 border-[#333] flex items-center justify-center">
                    <span className="text-[8px] font-black text-neutral-500">VS</span>
                 </div>
              </div>

              {/* OPPONENT STATS */}
              <div className="flex-1 max-w-[160px]">
                  <PlayerStatCard 
                      name={opData.name} 
                      score={opData.score} 
                      time={opData.time} 
                      isMe={false} 
                      status={viewStatus === 'win' ? 'lose' : (viewStatus === 'lose' ? 'win' : viewStatus)} 
                      avatar={opData.avatar} 
                  />
              </div>
          </div>

          {/* WINNER PAYOUT */}
          {viewStatus === 'win' && !isClaimed && (
             <div className="animate-in slide-in-from-bottom-4 duration-700 w-full mb-8 flex flex-col items-center">
                 <h3 className="font-black uppercase italic text-xl mb-4 text-white drop-shadow-md">{t('result_claim_title')}</h3>

                 <div className="w-full max-w-xs bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
                   <p className="text-xs text-neutral-400 mb-2 uppercase tracking-widest font-bold">{t('payout_choose_title')}</p>
                   <div className="flex gap-2">
                     <button
                       onClick={() => setPayoutChoice('full')}
                       className={`flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase ${payoutChoice === 'full' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}
                     >
                       {t('payout_full_label')}
                     </button>
                     <button
                       onClick={() => setPayoutChoice('donate1')}
                       className={`flex-1 px-3 py-2 rounded-lg text-xs font-black uppercase ${payoutChoice === 'donate1' ? 'bg-orange-500 text-black' : 'bg-white/10 text-white'}`}
                     >
                       {t('payout_donate_label')}
                     </button>
                   </div>
                   {payoutChoice === 'donate1' && (
                     <p className="text-[10px] text-neutral-400 mt-2">
                       {t('payout_donate_hint', { amount: donationAmount })}
                     </p>
                   )}
                 </div>
                 
                 {!showPayoutQr ? (
                   <button
                     onClick={() => { setShowPayoutQr(true); generateWinLink(payoutAmount); }}
                     className="w-full max-w-xs bg-gradient-to-r from-orange-500 to-yellow-500 py-4 rounded-xl text-black font-black uppercase text-center shadow-lg hover:scale-[1.02] transition-transform"
                   >
                     {t('payout_show_qr')}
                   </button>
                 ) : (
                   <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4 relative flex flex-col items-center gap-4">
                      {withdrawData?.lnurl ? (
                          <>
                             <QRCodeCanvas value={withdrawData.lnurl} size={260} level="H" includeMargin />
                             <a href={`lightning:${withdrawData.lnurl}`} className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 py-3 rounded-lg text-black font-black uppercase text-center flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform">
                               <Wallet size={18}/> {t('btn_wallet')}
                             </a>
                             <button onClick={() => {navigator.clipboard.writeText(withdrawData.lnurl); alert(t('nostr_copied'));}} className="absolute top-2 right-2 p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200">
                                 <Copy size={14} className="text-neutral-500"/>
                             </button>
                             <div className="w-full bg-neutral-100 text-neutral-700 text-[10px] font-mono rounded-lg px-3 py-2 break-all">
                               {withdrawData.lnurl}
                             </div>
                          </>
                      ) : (
                          <div className="w-56 h-56 flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400"/></div>
                      )}
                   </div>
                 )}
                 
                 <button onClick={checkWithdrawStatus} disabled={isChecking} className="text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl text-neutral-300 flex items-center gap-2 transition-colors">
                      <RefreshCw size={12} className={isChecking ? "animate-spin" : ""} />
                      {isChecking ? t('checking') : t('check_status')}
                 </button>
             </div>
          )}

          {isClaimed && (
             <div className="bg-green-500/20 border border-green-500 p-4 rounded-2xl flex items-center gap-3 mb-6 animate-in zoom-in">
                 <CheckCircle2 className="text-green-500" size={24}/>
                 <span className="font-bold text-green-100 uppercase text-sm">{t('payout_claimed')}</span>
             </div>
          )}

          {/* FOOTER */}
          <div className="pb-6 mt-auto">
            <Button onClick={onHome} variant="secondary" className="w-full py-4 flex items-center justify-center gap-2 shadow-lg hover:bg-white/10">
              <Home size={20} /> {t('result_home_button')}
            </Button>
          </div>
        </div>
        )}

      </div>
    </Background>
  );
};

const PlayerStatCard = ({ name, score, time, isMe, status, avatar }) => {
    let borderClass = "border-white/10";
    if (status === 'win') borderClass = "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
    if (status === 'lose') borderClass = "border-red-500/50";

    const avatarSrc = avatar || (name === "???" ? null : getCryptoPunkAvatar(name));

    return (
      <div className={`flex flex-col items-center bg-[#161616] border ${borderClass} rounded-2xl p-4 transition-all w-full relative overflow-hidden`}>
        <div className="w-12 h-12 rounded-md bg-neutral-800 border border-white/10 overflow-hidden mb-2 shadow-inner relative">
           {avatarSrc ? (
               <img src={avatarSrc} alt={name} className="w-full h-full object-cover" />
           ) : (
               <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold text-xl">?</div>
           )}
        </div>
        
        <span className={`text-xs font-black uppercase tracking-wider mb-3 truncate max-w-full ${isMe ? 'text-white' : 'text-neutral-400'}`}>
          {name || (isMe ? 'DU' : 'Gegner')} {isMe && <span className="text-orange-500">*</span>}
        </span>
        
        <div className="grid grid-cols-2 gap-2 w-full">
            <div className="flex flex-col items-center bg-black/30 rounded-lg p-2">
                <Target size={12} className="text-orange-500 mb-1" />
                <span className="text-lg font-black text-white leading-none">{score !== null ? score : '-'}</span>
            </div>
            <div className="flex flex-col items-center bg-black/30 rounded-lg p-2">
                <Clock size={12} className="text-blue-500 mb-1" />
                <span className="text-lg font-black text-white leading-none">
                  {time !== null ? (time / 1000).toFixed(1) : '-'}
                  <span className="text-[8px] text-neutral-500 ml-0.5">s</span>
                </span>
            </div>
        </div>
      </div>
    );
};

export default ResultView;