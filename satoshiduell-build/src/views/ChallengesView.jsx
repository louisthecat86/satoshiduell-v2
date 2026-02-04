import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { ArrowLeft, Swords, RefreshCw } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { supabase, fetchProfiles } from '../services/supabase';

const ChallengesView = ({ onAcceptChallenge, onCancel }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userName = user?.username || user?.name || '';

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadChallenges = async () => {
    setLoading(true);
    if (!userName) {
      setChallenges([]);
      setLoading(false);
      return;
    }

    // Lade offene Challenges, die an mich gerichtet sind
    const { data } = await supabase
      .from('duels')
      .select('*')
      .eq('status', 'open')
      .ilike('target_player', userName)
      .order('created_at', { ascending: false });

    if (data) {
      const usernames = Array.from(new Set(data.flatMap(g => [g.creator, g.challenger, g.target_player]).filter(Boolean)));
      const { data: profiles } = await fetchProfiles(usernames);
      const profileMap = {};
      profiles?.forEach(p => profileMap[p.username] = p);

      const enriched = data.map(g => ({
        ...g,
        creatorAvatar: profileMap[g.creator]?.avatar || null,
        targetAvatar: profileMap[g.target_player]?.avatar || null
      }));

      setChallenges(enriched);
    } else {
      setChallenges([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadChallenges();
    const interval = setInterval(loadChallenges, 5000);
    return () => clearInterval(interval);
  }, [userName]);

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">

        <div className="flex items-center justify-between p-6 pb-2">
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-black text-white italic uppercase tracking-wider flex items-center gap-2">
            <Swords className="text-purple-500" size={20} /> {t('tile_challenges')}
          </h2>
          <button 
            onClick={loadChallenges} 
            className={`p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-all ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {loading && challenges.length === 0 && (
            <div className="text-center text-neutral-500 mt-20 animate-pulse flex flex-col items-center">
              {t('no_challenges')}
            </div>
          )}

          {!loading && challenges.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-neutral-600">
              <div className="bg-neutral-900 p-6 rounded-full mb-4">
                <Swords size={48} className="opacity-20" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">{t('no_challenges')}</p>
            </div>
          )}

          {challenges.map((game) => (
            <div key={game.id} className="bg-[#161616] border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-lg group hover:border-purple-500/50 hover:bg-[#201526] transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-md bg-neutral-800 overflow-hidden border border-white/10 shadow-inner">
                  <img src={game.creatorAvatar || getCryptoPunkAvatar(game.creator)} alt={game.creator} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">{t('challenge_sent')}</span>
                  <span className="text-white font-black uppercase text-lg leading-none truncate max-w-[140px]">{game.creator}</span>
                  <span className="text-purple-400 font-bold text-xs mt-1 bg-purple-500/10 px-2 py-0.5 rounded w-fit">{game.amount} SATS</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={() => onAcceptChallenge(game)} className="px-4 py-2 bg-white text-black hover:bg-purple-500 hover:text-white text-xs font-black uppercase tracking-widest">{t('btn_share') /* reuse label 'Challenge!' as 'Accept' isn't defined */}</Button>
              </div>
            </div>
          ))}

        </div>

      </div>
    </Background>
  );
};

export default ChallengesView;
