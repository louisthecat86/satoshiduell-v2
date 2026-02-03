import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, PlayCircle, Clock, CheckCircle, Swords, Trophy, RefreshCcw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { fetchUserGames } from '../services/supabase';
import { useTranslation } from '../hooks/useTranslation';

// 24 Stunden in Millisekunden (Setze es zum Testen wieder auf 0, wenn nötig)
const REFUND_TIMEOUT = 24 * 60 * 60 * 1000; 

const ActiveGamesView = ({ onBack, onSelectGame, onRefund }) => { 
  const { user } = useAuth();
  const { t } = useTranslation();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadGames = async () => {
      if (user?.name) {
        const { data } = await fetchUserGames(user.name);
        if (data) setGames(data);
      }
      setLoading(false);
    };
    loadGames();
    const interval = setInterval(loadGames, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // --- LOGIK TRENNUNG ---

  // 1. CLAIMABLE: Gewonnen und noch nicht abgeholt
  const claimableGames = games.filter(g => {
    if (g.status !== 'finished') return false;
    if (g.is_claimed === true || g.claimed === true) return false; 

    const isCreator = g.creator === user.name;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    const opScore = isCreator ? g.challenger_score : g.creator_score;
    const myTime = isCreator ? g.creator_time : g.challenger_time; 
    const opTime = isCreator ? g.challenger_time : g.creator_time;
    const iWon = myScore > opScore || (myScore === opScore && myTime < opTime);

    return iWon;
  });
  
  // 2. ACTION: Ich muss spielen
  const myTurnGames = games.filter(g => {
    if (g.status === 'finished') return false; 
    if (g.status === 'refunded') return false; 
    if (g.target_player === user.name && !g.challenger) return true;

    const isCreator = g.creator === user.name;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    return (g.status === 'active' || g.status === 'open') && myScore === null;
  });

  // 3. WAITING: Ich warte auf Gegner
  const waitingGames = games.filter(g => {
    if (g.status === 'finished') return false;
    if (g.status === 'refunded') return false;
    if (g.target_player === user.name && !g.challenger) return false;

    const isCreator = g.creator === user.name;
    const myScore = isCreator ? g.creator_score : g.challenger_score;
    return (g.status === 'active' || g.status === 'open') && myScore !== null;
  });

  // 4. REFUNDED: Storniert ABER NOCH NICHT ABGEHOLT (Das ist der Fix!)
  const refundedGames = games.filter(g => 
      g.status === 'refunded' && 
      g.is_claimed !== true && 
      g.claimed !== true
  );

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative overflow-hidden">
        
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
                 <Trophy size={12}/> Gewinne abholen! ({claimableGames.length})
               </h3>
               <div className="space-y-3">
                 {claimableGames.map(game => {
                   const opponent = game.creator === user.name ? (game.challenger || 'Gegner') : game.creator;
                   const opponentAvatar = game.creator === user.name ? game.challengerAvatar : game.creatorAvatar;
                   const avatarSrc = opponentAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${opponent}`;
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
                             GEWONNEN!
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
                           Abholen {'->'}
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
                 Deine Aktionen ({myTurnGames.length})
               </h3>
               <div className="space-y-3">
                 {myTurnGames.map(game => {
                   const isChallengeForMe = game.target_player === user.name;
                   const opponent = isChallengeForMe ? game.creator : (game.creator === user.name ? (game.challenger || 'Gegner') : game.creator);
                   const opponentAvatar = isChallengeForMe ? game.creatorAvatar : (game.creator === user.name ? game.challengerAvatar : game.creatorAvatar);
                   const avatarSrc = opponentAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${opponent}`;
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
                               {isChallengeForMe ? 'DU BIST HERAUSGEFORDERT!' : 'DU BIST DRAN!'}
                             </span>
                             <span className={`${isChallengeForMe ? 'text-purple-200' : 'text-orange-200'} text-xs font-medium`}>
                               {isChallengeForMe ? `von ${game.creator}` : (game.creator === user.name ? 'Warte auf Gegner...' : `vs ${game.creator}`)} 
                             </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="bg-black/20 px-2 py-1 rounded-lg text-white font-mono font-bold text-xs">
                             {game.amount} Sats
                           </span>
                           <span className="text-[10px] text-white/60 mt-1 uppercase tracking-wider group-hover:translate-x-1 transition-transform flex items-center gap-1">
                             {isChallengeForMe ? 'Annehmen ->' : 'Quiz starten ->'}
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
                 Warten auf Gegner ({waitingGames.length})
               </h3>
               <div className="space-y-3">
                 {waitingGames.map(game => {
                    const isChallenge = game.target_player && game.target_player.length > 0;
                    
                    const createdTime = new Date(game.created_at).getTime();
                    const canRefund = (Date.now() - createdTime) > REFUND_TIMEOUT;
                    const isMyGame = game.creator === user.name;

                    return (
                     <div key={game.id} className="w-full bg-[#161616] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 opacity-90">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex flex-col items-start">
                               <span className="text-neutral-400 font-bold uppercase text-sm flex items-center gap-2">
                                 <Clock size={16} className="text-neutral-500"/>
                                 {isChallenge ? `Herausforderung gesendet` : `Warten...`}
                               </span>
                               <span className="text-neutral-600 text-xs mt-1">
                                 {isChallenge ? `an ${game.target_player}` : 'Lobby'}
                               </span>
                            </div>
                            <div className="flex flex-col items-end">
                               <span className="text-neutral-500 font-mono font-bold text-xs">
                                 {game.amount} Sats
                               </span>
                               <span className="text-[10px] text-green-500/50 mt-1 uppercase tracking-wider flex items-center gap-1">
                                 <CheckCircle size={10}/> Fertig (Score: {game.creator === user.name ? game.creator_score : game.challenger_score})
                               </span>
                            </div>
                        </div>

                        {canRefund && isMyGame ? (
                             <button 
                                onClick={() => onRefund(game)}
                                className="w-full bg-red-500/10 border border-red-500/50 text-red-500 py-2 rounded-lg text-xs font-black uppercase flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition-all animate-pulse"
                             >
                                <RefreshCcw size={14} /> Einsatz zurückfordern
                             </button>
                        ) : (
                             isMyGame && (
                                 <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden mt-1">
                                     <div className="h-full bg-neutral-700 w-1/2 animate-pulse"></div>
                                 </div>
                             )
                        )}
                     </div>
                    );
                 })}
               </div>
             </div>
           )}

           {/* 3. REFUNDED & BEREIT ZUM ABHOLEN (Falls man die Seite verlassen hat) */}
           {refundedGames.length > 0 && (
               <div className="mt-8 animate-in slide-in-from-bottom-5">
                   <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-3 pl-1 flex items-center gap-2">
                      <RefreshCcw size={12}/> Rückerstattungen offen ({refundedGames.length})
                   </h3>
                   {refundedGames.map(game => (
                       <button key={game.id} onClick={() => onSelectGame(game)} className="w-full bg-red-900/10 border border-red-500/30 p-3 rounded-xl flex justify-between items-center mb-2 hover:bg-red-900/20 transition-colors">
                           <span className="text-red-500 text-xs font-bold uppercase flex items-center gap-2">
                               <RefreshCcw size={12} className="animate-spin-slow"/> Rückerstattung #{game.id}
                           </span>
                           <span className="text-red-400 text-xs font-mono font-bold">{game.amount} sats {'->'}</span>
                       </button>
                   ))}
               </div>
           )}

           {loading && <div className="text-center text-neutral-600 py-10 animate-pulse">Lade Spiele...</div>}
           
           {!loading && games.length === 0 && (
              <div className="text-center py-20 opacity-50">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <PlayCircle size={32} className="text-neutral-600"/>
                 </div>
                 <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">Keine aktiven Spiele</p>
              </div>
           )}

        </div>
        
        {/* FOOTER */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
            <Button onClick={onBack} variant="secondary" className="w-full py-4 shadow-2xl flex items-center justify-center gap-2">
                Zurück zum Dashboard
            </Button>
        </div>

      </div>
    </Background>
  );
};

export default ActiveGamesView;