import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Users, Search, RefreshCw, Swords, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { fetchOpenDuels, fetchProfiles } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';

const LobbyView = ({ onJoinDuel, onCancel }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Spiele laden und mit Avataren anreichern
  const loadGames = async () => {
    setLoading(true);
    // Falls kein eingelogger User vorhanden ist, breche früh ab
    if (!user?.name) {
      setGames([]);
      setLoading(false);
      return;
    }

    // Wir übergeben den eigenen Namen, damit wir unsere eigenen Spiele nicht sehen
    const { data } = await fetchOpenDuels(user.name);
    if (data) {
      // Lade zugehörige Profile (creator + target_player)
      const usernames = Array.from(new Set(data.flatMap(g => [g.creator, g.target_player]).filter(Boolean)));
      const { data: profiles } = await fetchProfiles(usernames);
      const profileMap = {};
      profiles?.forEach(p => profileMap[p.username] = p);

      const enriched = data.map(g => ({
        ...g,
        creatorAvatar: profileMap[g.creator]?.avatar || null,
        targetAvatar: profileMap[g.target_player]?.avatar || null
      }));

      setGames(enriched);
    } else {
      setGames([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadGames();
    // Auto-Refresh alle 5 Sekunden, damit man neue Spiele sieht
    const interval = setInterval(loadGames, 5000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <Background>
      <div className="flex flex-col h-[100vh] w-full max-w-md mx-auto relative overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between p-6 pb-2">
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-black text-white italic uppercase tracking-wider flex items-center gap-2">
            <Users className="text-orange-500" size={20} /> {t('tile_lobby')}
          </h2>
          <button 
            onClick={loadGames} 
            className={`p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-all ${loading ? 'animate-spin' : ''}`}
          >
            <RefreshCw size={20} />
          </button>
        </div>

        {/* LISTE DER SPIELE */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          
          {/* Status: Laden */}
          {loading && games.length === 0 && (
            <div className="text-center text-neutral-500 mt-20 animate-pulse flex flex-col items-center">
              <Search className="mb-2 opacity-50" />
              {t('lobby_wait')}
            </div>
          )}

          {/* Status: Leer */}
          {!loading && games.length === 0 && (
            <div className="flex flex-col items-center justify-center mt-20 text-neutral-600">
              <div className="bg-neutral-900 p-6 rounded-full mb-4">
                <Swords size={48} className="opacity-20" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">{t('no_challenges')}</p>
            </div>
          )}

          {/* Status: Spiele vorhanden */}
          {games.map((game) => (
            <div 
              key={game.id} 
              className="bg-[#161616] border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-lg group hover:border-orange-500/50 hover:bg-[#1a1a1a] transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {/* Infos (Avatar + Name + Betrag) */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-md bg-neutral-800 overflow-hidden border border-white/10 shadow-inner">
                  <img 
                    src={game.creatorAvatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${game.creator}`} 
                    alt={game.creator} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                  />
                </div>
                
                <div className="flex flex-col">
                  <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Gegner</span>
                  <span className="text-white font-black uppercase text-lg leading-none truncate max-w-[120px]">
                    {game.creator}
                  </span>
                  <span className="text-orange-500 font-bold text-xs mt-1 bg-orange-500/10 px-2 py-0.5 rounded w-fit">
                    {game.amount} SATS
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <Button 
                onClick={() => onJoinDuel(game)} 
                className="px-5 py-3 bg-white text-black hover:bg-orange-500 hover:text-white text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-lg hover:shadow-orange-500/20"
              >
                {t('lobby_fight')} <Swords size={16} />
              </Button>
            </div>
          ))}
        </div>

      </div>
    </Background>
  );
};

export default LobbyView;