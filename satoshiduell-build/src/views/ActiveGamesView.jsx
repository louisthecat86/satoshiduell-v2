import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Home, Trophy, Clock, Loader2, Play, ArrowRight } from 'lucide-react';
import { fetchUserGames } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation'; // <--- IMPORT

const ActiveGamesView = ({ onBack, onSelectGame }) => {
  const { user } = useAuth();
  const { t } = useTranslation(); // <--- HOOK
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await fetchUserGames(user.name);
      if (data) setGames(data);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [user]);

  const actionRequired = []; 
  const waiting = [];        

  games.forEach(game => {
    const isCreator = game.creator === user.name;
    const myScore = isCreator ? game.creator_score : game.challenger_score;
    const opScore = isCreator ? game.challenger_score : game.creator_score;
    const opponent = isCreator ? (game.challenger || "???") : game.creator;
    const isFinished = game.creator_score !== null && game.challenger_score !== null;
    const isWaitingForPayment = game.status === 'pending_payment';
    const displayItem = { ...game, opponent, isCreator };

    if (isFinished) {
       const iWon = myScore > opScore || (myScore === opScore && (isCreator ? game.creator_time < game.challenger_time : game.challenger_time < game.creator_time));
       if (iWon && game.is_claimed !== true) {
          actionRequired.push({ ...displayItem, status: 'won' });
       } 
    } else if (isWaitingForPayment) {
        // Ignorieren
    } else if (game.status === 'waiting') {
        waiting.push({ ...displayItem, status: 'lobby' }); 
    } else {
        if (myScore === null) {
            actionRequired.push({ ...displayItem, status: 'your_turn' }); 
        } else {
            waiting.push({ ...displayItem, status: 'waiting_opp' }); 
        }
    }
  });

  const GameCard = ({ item, color, icon, label, subLabel }) => (
    <div 
      onClick={() => onSelectGame(item)}
      className={`relative p-4 rounded-xl border flex items-center justify-between transition-all cursor-pointer active:scale-95 hover:brightness-110 mb-3 shadow-lg ${color}`}
    >
      <div className="flex items-center gap-4">
        <div className="p-2 bg-black/20 rounded-full">{icon}</div>
        <div>
           <div className="font-black text-sm uppercase">{label}</div>
           <div className="text-xs opacity-80">{subLabel}</div>
        </div>
      </div>
      <div className="text-right">
         <div className="font-black text-xs bg-black/30 px-2 py-1 rounded mb-1">{item.amount} Sats</div>
         <ArrowRight size={14} className="ml-auto opacity-50" />
      </div>
    </div>
  );

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto p-6 overflow-y-auto scrollbar-hide pb-24 relative">
        
        <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-3">
          <Play className="text-green-500" /> {t('active_games_title')}
        </h2>

        {loading ? (
            <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-orange-500" size={40}/></div>
        ) : (
            <>
                {/* 1. HANDLUNG ERFORDERLICH */}
                {actionRequired.length > 0 && (
                    <div className="mb-8 animate-in slide-in-from-left duration-500">
                        <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3 pl-1">{t('active_your_actions')}</h3>
                        {actionRequired.map(g => (
                            <GameCard 
                                key={g.id} item={g}
                                color={g.status === 'won' ? "bg-green-600 border-green-400 text-white" : "bg-orange-500 border-orange-400 text-white"}
                                icon={g.status === 'won' ? <Trophy size={18} /> : <Play size={18} />}
                                label={g.status === 'won' ? t('result_win_title') : t('active_your_turn')}
                                subLabel={g.status === 'won' ? t('active_claim_now') : t('active_start_quiz')}
                            />
                        ))}
                    </div>
                )}

                {/* 2. WARTEN */}
                {waiting.length > 0 && (
                    <div className="mb-8">
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 pl-1">{t('active_waiting_list')}</h3>
                        {waiting.map(g => (
                            <GameCard 
                                key={g.id} item={g}
                                color="bg-neutral-800 border-neutral-700 text-neutral-300"
                                icon={g.status === 'lobby' ? <Loader2 size={18} className="animate-spin"/> : <Clock size={18} />}
                                label={g.status === 'lobby' ? t('active_in_lobby') : t('active_opponent_playing')}
                                subLabel={g.status === 'lobby' ? t('active_waiting_join') : `vs. ${g.opponent}`}
                            />
                        ))}
                    </div>
                )}

                {actionRequired.length === 0 && waiting.length === 0 && (
                    <div className="text-center text-neutral-500 mt-10 italic">
                        {t('active_no_games')}<br/>
                        <span className="text-xs">{t('active_check_history')}</span>
                    </div>
                )}
            </>
        )}

        {/* BACK BUTTON */}
        <div className="fixed bottom-6 left-0 right-0 w-full px-6 max-w-md mx-auto z-20">
            <Button onClick={onBack} variant="secondary" className="w-full shadow-2xl">
                <Home size={20} className="mr-2" /> {t('back_home')}
            </Button>
        </div>

      </div>
    </Background>
  );
};

export default ActiveGamesView;