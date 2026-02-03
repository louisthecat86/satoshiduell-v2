import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, History, Trophy, Frown, MinusCircle, RefreshCcw, Calendar, Zap } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// WICHTIG: Profil laden für die Stats oben
import { fetchUserHistory, fetchUserProfile } from '../services/supabase'; 
import { useTranslation } from '../hooks/useTranslation';

const HistoryView = ({ onBack, onSelectGame }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); 
  
  // State für die Kacheln oben
  const [stats, setStats] = useState({ wins: 0, total_sats_won: 0 });

  useEffect(() => {
    const loadData = async () => {
      if (user?.name) {
        // 1. Profil Stats laden (für die Kacheln)
        const { data: profile } = await fetchUserProfile(user.name);
        if (profile) setStats(profile);

        // 2. Historie laden (für die Liste)
        const { data: history } = await fetchUserHistory(user.name);
        if (history) {
            const sorted = history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setGames(sorted);
        }
      }
      setLoading(false);
    };
    loadData();
  }, [user]);

  // --- FILTER LOGIK ---
  const filteredGames = games.filter(g => {
      if (g.status !== 'finished' && g.status !== 'refunded') return false;
      if (filter === 'all') return true;
      
      const isCreator = g.creator === user.name;
      const myScore = isCreator ? g.creator_score : g.challenger_score;
      const opScore = isCreator ? g.challenger_score : g.creator_score;
      
      if (g.status === 'refunded') return filter === 'refund';

      const myTime = isCreator ? g.creator_time : g.challenger_time; 
      const opTime = isCreator ? g.challenger_time : g.creator_time;
      
      if (filter === 'win') return myScore > opScore || (myScore === opScore && myTime < opTime);
      if (filter === 'lose') return opScore > myScore || (opScore === myScore && opTime < myTime);
      
      return false; 
  });

  const getGameDetails = (game) => {
      const isCreator = game.creator === user.name;
      const opponentName = isCreator ? (game.challenger || "Unbekannt") : game.creator;
      const myScore = isCreator ? game.creator_score : game.challenger_score;
      const opScore = isCreator ? game.challenger_score : game.creator_score;
      const myTime = isCreator ? game.creator_time : game.challenger_time;
      const opTime = isCreator ? game.challenger_time : game.creator_time;

      if (game.status === 'refunded') {
          return {
              status: 'refund',
              icon: <RefreshCcw size={20} className="text-red-400"/>,
              title: 'RÜCKERSTATTUNG',
              colorClass: 'bg-red-900/10 border-red-500/30',
              textClass: 'text-red-400',
              scoreText: `${game.amount} Sats zurück`
          };
      }

      const iWon = myScore > opScore || (myScore === opScore && myTime < opTime);
      const isDraw = myScore === opScore && myTime === opTime;

      if (iWon) return { status: 'win', icon: <Trophy size={20} className="text-yellow-400"/>, title: 'GEWONNEN', colorClass: 'bg-yellow-900/10 border-yellow-500/30', textClass: 'text-yellow-400', scoreText: `${myScore} : ${opScore}` };
      if (isDraw) return { status: 'draw', icon: <MinusCircle size={20} className="text-neutral-400"/>, title: 'UNENTSCHIEDEN', colorClass: 'bg-neutral-800/50 border-neutral-600/30', textClass: 'text-neutral-400', scoreText: `${myScore} : ${opScore}` };
      return { status: 'lose', icon: <Frown size={20} className="text-neutral-600"/>, title: 'VERLOREN', colorClass: 'bg-neutral-900/50 border-neutral-800', textClass: 'text-neutral-600', scoreText: `${myScore} : ${opScore}` };
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 pb-2 flex items-center gap-4">
            <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="text-white" size={20}/>
            </button>
            <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
               <History size={24} className="text-purple-500" /> Historie
            </h2>
        </div>

        {/* --- STATISTIK KACHELN (Hier eingefügt) --- */}
        <div className="grid grid-cols-2 gap-3 px-4 mb-4 mt-2">
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 p-3 rounded-2xl flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-1">
                    <Trophy size={16} className="text-yellow-500"/>
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-widest">Siege</span>
                </div>
                <span className="text-2xl font-black text-white">{stats.wins}</span>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 p-3 rounded-2xl flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 mb-1">
                    <Zap size={16} className="text-purple-400"/>
                    <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Sats</span>
                </div>
                <span className="text-2xl font-black text-white">{stats.total_sats_won}</span>
            </div>
        </div>

        {/* FILTER BUTTONS */}
        <div className="px-6 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {['all', 'win', 'lose', 'refund'].map(f => (
                <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-1 rounded-full text-xs font-bold uppercase border transition-colors
                        ${filter === f 
                            ? 'bg-white text-black border-white' 
                            : 'bg-transparent text-neutral-500 border-neutral-700 hover:border-neutral-500'}
                    `}
                >
                    {f === 'all' ? 'Alle' : f === 'refund' ? 'Storno' : f === 'win' ? 'Siege' : 'Niederl.'}
                </button>
            ))}
        </div>

        {/* LISTE */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4 space-y-3 scrollbar-hide">
           {loading ? (
               <div className="text-center text-neutral-600 py-10 animate-pulse">Lade Historie...</div>
           ) : filteredGames.length === 0 ? (
               <div className="text-center py-20 opacity-50">
                  <History size={48} className="mx-auto mb-4 text-neutral-700"/>
                  <p className="text-neutral-500 text-sm font-bold uppercase">Keine Einträge gefunden</p>
               </div>
           ) : (
               filteredGames.map(game => {
                   const details = getGameDetails(game);
                   const date = new Date(game.created_at).toLocaleDateString();
                   const isCreator = game.creator === user.name;
                   const opponent = isCreator ? (game.challenger || "Niemand") : game.creator;

                   return (
                       <button 
                         key={game.id} 
                         onClick={() => onSelectGame(game)} 
                         className={`w-full p-4 rounded-2xl border flex items-center justify-between transition-transform hover:scale-[1.01] ${details.colorClass}`}
                       >
                           <div className="flex items-center gap-4">
                               <div className="p-2 rounded-full bg-black/20">
                                   {details.icon}
                               </div>
                               <div className="flex flex-col items-start">
                                   <span className={`text-sm font-black uppercase ${details.textClass}`}>
                                       {details.title}
                                   </span>
                                   <span className="text-xs text-neutral-500 font-bold">
                                       vs {opponent}
                                   </span>
                               </div>
                           </div>
                           <div className="flex flex-col items-end">
                               <span className="text-white font-mono font-bold text-sm">
                                   {details.scoreText}
                               </span>
                               <span className="text-[10px] text-neutral-600 flex items-center gap-1 mt-1">
                                   <Calendar size={10}/> {date}
                               </span>
                           </div>
                       </button>
                   );
               })
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

export default HistoryView;