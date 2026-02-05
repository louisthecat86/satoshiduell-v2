import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { ArrowLeft, PlayCircle, Clock, CheckCircle, Swords, Trophy, RefreshCcw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchUserGames } from '../services/supabase';
import { useTranslation } from '../hooks/useTranslation';

// 24 Stunden in Millisekunden (Zum Testen auf z.B. 10 * 1000 setzen)
const REFUND_TIMEOUT = 24 * 60 * 60 * 1000; 

const ActiveGamesView = ({ onBack, onSelectGame, onRefund }) => { 
  const { user } = useAuth();
  const { t } = useTranslation();
  const userName = user?.username || user?.name || '';
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- HELPER: Sicherer Vergleich ---
  const normalize = (str) => (str || "").toLowerCase().trim();

  useEffect(() => {
    const loadGames = async () => {
      if (userName) {
        // fetchUserGames liefert bereits mit Avataren angereicherte Daten
        const { data } = await fetchUserGames(userName);
        if (data) setGames(data);
      }
      setLoading(false);
    };
    loadGames();
    const interval = setInterval(loadGames, 5000); // Live update alle 5s
    return () => clearInterval(interval);
  }, [userName]);

  const handleShareDuel = async (game) => {
    try {
      const shareUrl = `https://satoshiduell.com/?duel=${game.id}`;
      const shareText = t('share_content', { amount: game.amount, url: shareUrl });

      if (navigator.share) {
        await navigator.share({ text: shareText, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert(t('share_success'));
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // --- LOGIK TRENNUNG ---

  // 1. CLAIMABLE: Gewonnen und noch nicht abgeholt
  const claimableGames = games.filter(g => {
    if (g.status !== 'finished') return false;
    if (g.is_claimed === true || g.claimed === true) return false; 

    if (g.mode === 'arena') {
      const refundClaimed = g.refund_claimed || {};
      if (refundClaimed[normalize(userName)]) return false;
      const winner = g.winner;
      return winner && normalize(winner) === normalize(userName);
    }

    const isCreator = normalize(g.creator) === normalize(userName);
    
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    const opScore = isCreator ? g.challenger_score : g.creator_score;
    const myTime = isCreator ? g.creator_time : g.challenger_time; 
    const opTime = isCreator ? g.challenger_time : g.creator_time;
    
    // Gewonnen wenn Score höher ODER (Score gleich UND Zeit besser)
    const iWon = myScore > opScore || (myScore === opScore && myTime < opTime);

    return iWon;
  });
  
  // 2. ACTION: Ich muss spielen (bin dran)
  const myTurnGames = games.filter(g => {
    if (g.mode === 'arena') {
      const refundClaimed = g.refund_claimed || {};
      if (refundClaimed[normalize(userName)]) return false;
      const participants = Array.isArray(g.participants) ? g.participants : [];
      if (!participants.map(normalize).includes(normalize(userName))) return false;
      const scores = g.participant_scores || {};
      const myScore = scores[normalize(userName)] ?? scores[userName];
      return (g.status === 'open' || g.status === 'active') && (myScore === null || myScore === undefined);
    }
    if (g.status === 'finished') return false; 
    if (g.status === 'refunded') return false; 
    
    const me = normalize(userName);
    const target = normalize(g.target_player);

    // Fall A: Ich bin Herausgefordert und habe noch nicht angenommen/gespielt
    if (target === me && !g.challenger) return true;

    // Fall B: Spiel läuft, aber ich habe noch kein Ergebnis
    const isCreator = normalize(g.creator) === me;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    
    // Zeige an, wenn Status active/open ist UND ich noch keine Punkte habe
    // (Ausnahme: Wenn ich Creator bin und Status open ist -> dann warte ich auf Gegner, spiele nicht selbst nochmal)
    if (g.status === 'open' && isCreator) return false; 

    return (g.status === 'active' || g.status === 'open') && myScore === null;
  });

  // 3. WAITING: Ich habe gespielt, warte auf Gegner
  const waitingGames = games.filter(g => {
    if (g.mode === 'arena') {
      const refundClaimed = g.refund_claimed || {};
      if (refundClaimed[normalize(userName)]) return false;
      const participants = Array.isArray(g.participants) ? g.participants : [];
      if (!participants.map(normalize).includes(normalize(userName))) return false;
      const scores = g.participant_scores || {};
      const myScore = scores[normalize(userName)] ?? scores[userName];
      if (g.status === 'open') return myScore !== null && myScore !== undefined;
      return g.status === 'active' && myScore !== null && myScore !== undefined;
    }
    if (g.status === 'finished') return false;
    if (g.status === 'refunded') return false;
    
    const me = normalize(userName);
    const target = normalize(g.target_player);

    // Wenn ich herausgefordert wurde, aber noch nicht angenommen habe -> gehört zu "My Turn"
    if (target === me && !g.challenger) return false;

    const isCreator = normalize(g.creator) === me;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    
    // Zeige an, wenn ich Creator bin und noch keiner gejoined ist (Status open)
    if (g.status === 'open' && isCreator) return true;

    // Oder wenn ich schon gespielt habe (Score != null) und das Spiel noch läuft
    return g.status === 'active' && myScore !== null;
  });

  // 4. REFUNDED: Storniert ABER NOCH NICHT ABGEHOLT
  const refundedGames = games.filter(g => 
      g.status === 'refunded' && 
      g.is_claimed !== true && 
      g.claimed !== true
  );

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        
        {/* HEADER */}
        <div className="p-6 pb-2 flex items-center gap-4">
            <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="text-white" size={20}/>
            </button>
            <h2 className="text-xl font-black text-green-500 uppercase tracking-widest flex items-center gap-2">
               <PlayCircle size={24} /> {t('active_games_title')}
            </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-6 scrollbar-hide">
           
           {/* 0. GEWINN ABHOLEN */}
           {claimableGames.length > 0 && (
             <div className="animate-in slide-in-from-top-5 duration-500">
               <h3 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
                 <Trophy size={12}/> {t('active_claim_title')} ({claimableGames.length})
               </h3>
               <div className="space-y-3">
                 {claimableGames.map(game => {
                   const isCreator = normalize(game.creator) === normalize(user.name);
                   const opponent = isCreator ? (game.challenger || 'Gegner') : game.creator;
                   const opponentAvatar = isCreator ? game.challengerAvatar : game.creatorAvatar;
                   const avatarSrc = opponentAvatar || getCryptoPunkAvatar(opponent);
                   
                   return (
                   <button 
                     key={game.id}
                     onClick={() => onSelectGame(game)} 
                     className="w-full bg-gradient-to-r from-yellow-500 to-amber-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-yellow-900/20 hover:scale-[1.02] transition-transform group border border-white/20"
                   >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-md overflow-hidden bg-neutral-900 border border-white/10">
                          <img src={avatarSrc} alt={opponent} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col items-start">
                           <span className="text-black font-black uppercase text-lg flex items-center gap-2">
                             <Trophy size={20} className="text-black fill-black"/>
                             {t('result_win_title')}
                           </span>
                           <span className="text-black/70 text-xs font-bold">
                             vs {opponent}
                           </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="bg-black/80 px-3 py-1 rounded-lg text-yellow-500 font-mono font-black text-sm">
                           +{game.amount * 2} Sats
                         </span>
                         <span className="text-[10px] text-black/60 mt-1 uppercase tracking-wider font-bold group-hover:translate-x-1 transition-transform">
                           {t('active_claim_action')} {'->'}
                         </span>
                      </div>
                   </button>
                 )})}
               </div>
             </div>
           )}

           {/* 1. DEINE AKTIONEN */}
           {myTurnGames.length > 0 && (
             <div className="animate-in slide-in-from-left-5 duration-500">
               <h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3 pl-1">
                 {t('active_your_actions')} ({myTurnGames.length})
               </h3>
               <div className="space-y-3">
                 {myTurnGames.map(game => {
                   const isChallengeForMe = normalize(game.target_player) === normalize(user.name);
                   const isCreator = normalize(game.creator) === normalize(user.name);
                   const opponent = isChallengeForMe ? game.creator : (isCreator ? (game.challenger || 'Gegner') : game.creator);
                   const opponentAvatar = isChallengeForMe ? game.creatorAvatar : (isCreator ? game.challengerAvatar : game.creatorAvatar);
                   const avatarSrc = opponentAvatar || getCryptoPunkAvatar(opponent);
                   
                   return (
                     <button 
                       key={game.id}
                       onClick={() => onSelectGame(game)} 
                       className={`w-full rounded-2xl p-4 flex items-center justify-between shadow-lg hover:scale-[1.02] transition-transform group
                         ${isChallengeForMe 
                           ? 'bg-gradient-to-r from-purple-600 to-purple-800 border border-purple-400' 
                           : 'bg-gradient-to-r from-orange-500 to-orange-600 shadow-orange-900/20'}
                       `}
                     >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-md overflow-hidden bg-neutral-900 border border-white/10">
                            <img src={avatarSrc} alt={opponent} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex flex-col items-start">
                             <span className="text-white font-black uppercase text-lg flex items-center gap-2">
                               {isChallengeForMe ? <Swords size={20} className="text-white"/> : <PlayCircle size={20} className="fill-white text-orange-500"/>}
                               {isChallengeForMe ? t('active_challenged_title') : t('active_your_turn')}
                             </span>
                             <span className={`${isChallengeForMe ? 'text-purple-200' : 'text-orange-200'} text-xs font-medium`}>
                               {isChallengeForMe
                                 ? t('active_challenged_by', { name: game.creator })
                                 : (isCreator ? t('active_waiting_list') : t('active_vs', { opponent: game.creator }))} 
                             </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="bg-black/20 px-2 py-1 rounded-lg text-white font-mono font-bold text-xs">
                             {game.amount} Sats
                           </span>
                           <span className="text-[10px] text-white/60 mt-1 uppercase tracking-wider group-hover:translate-x-1 transition-transform flex items-center gap-1">
                              {isChallengeForMe ? t('active_accept_action') : t('active_start_quiz_action')}
                           </span>
                        </div>
                     </button>
                   );
                 })}
               </div>
             </div>
           )}

           {/* 2. WARTEN (MIT REFUND) */}
           {waitingGames.length > 0 && (
             <div className="animate-in slide-in-from-right-5 duration-500 delay-100">
               <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1 mt-2">
                 {t('active_waiting_list')} ({waitingGames.length})
               </h3>
               <div className="space-y-3">
                 {waitingGames.map(game => {
                    const isChallenge = game.target_player && game.target_player.length > 0;
                    const isArena = game.mode === 'arena';
                    const userKey = normalize(userName);
                    const refundLinks = game.refund_links || {};
                    const hasRefundLink = Boolean(refundLinks[userKey]);
                    
                    const createdTime = new Date(game.created_at).getTime();
                    const paidAt = isArena
                      ? (game.participant_paid_at ? game.participant_paid_at[userKey] : null)
                      : game.creator_paid_at;
                    const paidTime = paidAt ? new Date(paidAt).getTime() : createdTime;
                    // Kann erstattet werden wenn Zeit abgelaufen ist
                    const canRefund = (Date.now() - paidTime) > REFUND_TIMEOUT;
                    const isMyGame = game.mode === 'arena'
                      ? (Array.isArray(game.participants) && game.participants.map(normalize).includes(normalize(userName)))
                      : normalize(game.creator) === normalize(userName);

                    return (
                     <div key={game.id} className="w-full bg-[#161616] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 opacity-90">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start">
                               <span className="text-neutral-400 font-bold uppercase text-sm flex items-center gap-2">
                                 <Clock size={16} className="text-neutral-500"/>
                                 {isArena ? t('arena_waiting_full') : (isChallenge ? t('active_challenge_sent') : t('active_waiting'))}
                               </span>
                               <span className="text-neutral-600 text-xs mt-1">
                                 {isArena
                                   ? t('arena_waiting_slots', { joined: (game.participants || []).length, total: game.max_players || 2 })
                                   : (isChallenge ? t('active_challenge_to', { target: game.target_player }) : t('active_in_lobby'))}
                               </span>
                            </div>
                            <div className="flex flex-col items-end">
                               <span className="text-neutral-500 font-mono font-bold text-xs">
                                 {game.amount} Sats
                               </span>
                               {/* Score Anzeige falls ich schon gespielt habe */}
                               {isMyGame && game.creator_score !== null && (
                                   <span className="text-[10px] text-green-500/50 mt-1 uppercase tracking-wider flex items-center gap-1">
                                     <CheckCircle size={10}/> {t('active_your_score', { score: game.creator_score })}
                                   </span>
                               )}
                            </div>
                        </div>

                        {/* TEILEN BUTTON - Nur wenn mein Spiel offen ist */}
                        {game.status === 'open' && isMyGame && (
                            <button 
                              onClick={() => handleShareDuel(game)}
                              className="w-full bg-white/5 border border-white/10 text-white/80 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                            >
                              {t('share_duel_btn')}
                            </button>
                        )}

                        {/* REFUND BUTTON - Nur sichtbar wenn Zeit abgelaufen & mein Spiel & noch offen */}
                            {game.status === 'open' && isMyGame && hasRefundLink ? (
                              <button
                              onClick={() => onSelectGame(game)}
                              className="w-full bg-red-500/10 border border-red-500/50 text-red-500 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all"
                              >
                                <RefreshCcw size={14} /> {t('payout_show_qr')}
                              </button>
                            ) : game.status === 'open' && isMyGame && canRefund ? (
                             <button 
                                onClick={() => onRefund(game)}
                                className="w-full bg-red-500/10 border border-red-500/50 text-red-500 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all animate-pulse"
                             >
                                  <RefreshCcw size={14} /> {t('active_refund_request')}
                             </button>
                        ) : (
                             isMyGame && game.status === 'open' && (
                                   <div className="w-full flex items-center gap-2 mt-1 opacity-30" title={t('active_refund_lock_hint')}>
                                     <div className="h-1 bg-neutral-800 rounded-full flex-1 overflow-hidden">
                                          <div className="h-full bg-neutral-600 w-1/3 animate-pulse"></div>
                                     </div>
                                    <span className="text-[8px] text-neutral-600">{t('active_refund_lock_label')}</span>
                                 </div>
                             )
                        )}
                     </div>
                    );
                 })}
               </div>
             </div>
           )}

           {/* 3. REFUNDED & BEREIT ZUM ABHOLEN */}
           {refundedGames.length > 0 && (
               <div className="mt-8 animate-in slide-in-from-bottom-5">
                     <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
                      <RefreshCcw size={12}/> {t('active_refunds_open')} ({refundedGames.length})
                   </h3>
                   {refundedGames.map(game => (
                       <button key={game.id} onClick={() => onSelectGame(game)} className="w-full bg-red-900/10 border border-red-500/30 p-3 rounded-xl flex justify-between items-center mb-2 hover:bg-red-900/20 transition-colors">
                           <span className="text-red-500 text-xs font-bold uppercase flex items-center gap-2">
                           <RefreshCcw size={12} className="animate-spin-slow"/> {t('active_refund_item', { id: game.id.slice(0, 4) })}
                           </span>
                           <span className="text-red-400 text-xs font-mono font-bold">{game.amount} sats {'->'}</span>
                       </button>
                   ))}
               </div>
           )}

                 {loading && <div className="text-center text-neutral-600 py-10 animate-pulse">{t('active_loading')}</div>}
           
           {!loading && games.length === 0 && (
              <div className="text-center py-20 opacity-50">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PlayCircle size={32} className="text-neutral-600"/>
                 </div>
                  <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">{t('active_no_games')}</p>
              </div>
           )}

        </div>
        
        {/* FOOTER */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
            <Button onClick={onBack} variant="secondary" className="w-full py-4 shadow-2xl flex items-center justify-center gap-2">
              {t('result_home_button')}
            </Button>
        </div>

      </div>
    </Background>
  );
};

export default ActiveGamesView;