import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Home, Trophy, Swords, Loader2, Star, Crown, Medal } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

const LeaderboardView = ({ onBack, onChallenge }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data: finishedDuels } = await supabase
        .from('duels')
        .select('*')
        .eq('status', 'finished');

      if (finishedDuels) {
        const playerStats = {};
        finishedDuels.forEach(d => {
          const p1Won = d.creator_score > d.challenger_score || (d.creator_score === d.challenger_score && d.creator_time < d.challenger_time);
          const winnerName = p1Won ? d.creator : d.challenger;
          const prize = d.amount || 0;

          if (winnerName) {
            if (!playerStats[winnerName]) {
              playerStats[winnerName] = { name: winnerName, wins: 0, satsWon: 0 };
            }
            playerStats[winnerName].wins++;
            playerStats[winnerName].satsWon += prize;
          }
        });

        const sortedList = Object.values(playerStats)
          .sort((a, b) => b.satsWon - a.satsWon)
          .slice(0, 50);
        setLeaderboard(sortedList);
      }
      setLoading(false);
    };
    fetchLeaderboard();
  }, []);

  // Hilfskomponente für die Top 3 Plätze
  const PodiumPlace = ({ player, rank }) => {
    if (!player) return <div className="flex-1" />;
    
    const isFirst = rank === 1;
    const size = isFirst ? "w-24 h-24" : "w-16 h-16";
    const color = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-600";
    const border = rank === 1 ? "border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)]" : rank === 2 ? "border-slate-300" : "border-amber-600";

    return (
      <div className={`flex flex-col items-center ${isFirst ? '-mt-8 z-10' : 'mt-4'} flex-1`}>
        <div className="relative">
          <div className={`rounded-full border-4 overflow-hidden bg-neutral-900 ${size} ${border}`}>
            <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${player.name}`} alt={player.name} className="w-full h-full object-cover" />
          </div>
          <div className={`absolute -bottom-2 -right-1 bg-black rounded-full p-1 border ${border}`}>
             {rank === 1 ? <Crown size={16} className={color} /> : <Medal size={16} className={color} />}
          </div>
        </div>
        <span className="text-white font-black uppercase text-[10px] mt-3 tracking-widest truncate w-20 text-center">{player.name}</span>
        <span className={`${color} font-mono text-xs font-bold`}>{player.satsWon.toLocaleString()}</span>
      </div>
    );
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto overflow-hidden relative">
        
        {/* HEADER */}
        <div className="p-6 pb-2 text-center">
           <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter flex items-center justify-center gap-3">
             <Star className="text-yellow-500 fill-yellow-500" size={24} />
             {t('tile_leaderboard')}
             <Star className="text-yellow-500 fill-yellow-500" size={24} />
           </h2>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-yellow-500" size={48} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* PODIUM BEREICH */}
            <div className="flex items-start justify-between px-4 pt-12 pb-8 bg-gradient-to-b from-yellow-500/5 to-transparent">
               <PodiumPlace player={leaderboard[1]} rank={2} />
               <PodiumPlace player={leaderboard[0]} rank={1} />
               <PodiumPlace player={leaderboard[2]} rank={3} />
            </div>

            {/* LISTE RESTLICHE SPIELER */}
            <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-2 scrollbar-hide">
               {leaderboard.slice(3).map((p, i) => {
                  const isMe = p.name === user.name;
                  return (
                    <div 
                      key={p.name} 
                      className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${isMe ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-[#161616] border-white/5 hover:border-white/10'}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono font-black text-neutral-600 w-6 italic">#{i + 4}</span>
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-white/5 overflow-hidden">
                           <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${p.name}`} alt={p.name} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col">
                           <span className={`text-sm font-black uppercase tracking-tight ${isMe ? 'text-orange-500' : 'text-white'}`}>
                             {p.name} {isMe && <span className="text-[10px] opacity-70 ml-1">{t('result_you_marker')}</span>}
                           </span>
                           <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{p.wins} {t('lobby_fight')}s gewonnen</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                         <div className="text-right">
                            <span className="block font-mono font-black text-sm text-yellow-500 leading-none">{p.satsWon.toLocaleString()}</span>
                            <span className="text-[8px] font-black text-neutral-600 uppercase">Sats</span>
                         </div>
                         {!isMe && (
                            <button 
                              onClick={() => onChallenge(p.name)}
                              className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-orange-500 transition-all active:scale-90"
                            >
                              <Swords size={18} />
                            </button>
                         )}
                      </div>
                    </div>
                  );
               })}
            </div>
          </div>
        )}

        {/* FOOTER BUTTON */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
            <Button onClick={onBack} variant="secondary" className="w-full py-4 shadow-2xl flex items-center justify-center gap-2">
                <Home size={20} /> {t('back_home')}
            </Button>
        </div>

      </div>
    </Background>
  );
};

export default LeaderboardView;