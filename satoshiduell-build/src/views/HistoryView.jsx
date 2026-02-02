import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Home, Trophy, AlertCircle, History, Loader2, ArrowRight } from 'lucide-react';
import { fetchUserGames } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation'; // <--- IMPORT

const HistoryView = ({ onBack, onSelectGame }) => {
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
  }, [user]);

  const history = [];

  games.forEach(game => {
    const isCreator = game.creator === user.name;
    const myScore = isCreator ? game.creator_score : game.challenger_score;
    const opScore = isCreator ? game.challenger_score : game.creator_score;
    const opponent = isCreator ? (game.challenger || "???") : game.creator;
    const isFinished = game.creator_score !== null && game.challenger_score !== null;

    if (isFinished) {
       const iWon = myScore > opScore || (myScore === opScore && (isCreator ? game.creator_time < game.challenger_time : game.challenger_time < game.creator_time));
       
       if (!iWon || (iWon && game.is_claimed === true)) {
          history.push({ ...game, opponent, isCreator, status: iWon ? 'won' : 'lost' });
       }
    }
  });

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto p-6 overflow-y-auto scrollbar-hide pb-24 relative">
        
        <h2 className="text-2xl font-black text-white uppercase italic mb-6 flex items-center gap-3">
          <History className="text-blue-500" /> {t('tile_history')}
        </h2>

        {loading ? (
            <div className="flex justify-center mt-10"><Loader2 className="animate-spin text-blue-500" size={40}/></div>
        ) : (
            <div className="space-y-3">
                {history.map(g => (
                    <div 
                      key={g.id}
                      onClick={() => onSelectGame(g)}
                      className="p-4 rounded-xl border border-white/5 bg-neutral-900 flex items-center justify-between cursor-pointer hover:bg-neutral-800 active:scale-95 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${g.status === 'won' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                           {g.status === 'won' ? <Trophy size={16} /> : <AlertCircle size={16} />}
                        </div>
                        <div>
                           <div className="font-black text-sm uppercase text-neutral-300">
                               {g.status === 'won' ? t('result_win_title') : t('result_lose_title')}
                           </div>
                           <div className="text-xs text-neutral-500">vs. {g.opponent}</div>
                        </div>
                      </div>
                      <div className="font-black text-xs text-neutral-600">{g.amount} Sats</div>
                    </div>
                ))}
                
                {history.length === 0 && <div className="text-center text-neutral-500 italic mt-10">{t('history_empty')}</div>}
            </div>
        )}

        <div className="fixed bottom-6 left-0 right-0 w-full px-6 max-w-md mx-auto z-20">
            <Button onClick={onBack} variant="secondary" className="w-full shadow-2xl">
                <Home size={20} className="mr-2" /> {t('back_home')}
            </Button>
        </div>
      </div>
    </Background>
  );
};

export default HistoryView;