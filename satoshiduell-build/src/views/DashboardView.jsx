import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import Background from '../components/ui/Background';
import { 
  Plus, Trophy, Users, Swords, PlayCircle, History, 
  Medal, Heart, LogOut, Settings, Volume2 
} from 'lucide-react';
import { supabase } from '../services/supabase';
import { getOpenDuelCount, fetchUserGames, recalculateUserStats } from '../services/supabase';

const DashboardView = ({ 
  onCreateDuel, 
  onPlay, 
  onLogout, 
  onOpenActiveGames, 
  onOpenHistory, 
  onOpenBadges, 
  onOpenLeaderboard,
  onOpenChallenges,
  onDonate, 
  onOpenSettings, // Prop für Settings
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [lobbyCount, setLobbyCount] = useState(0);     
  const [actionCount, setActionCount] = useState(0);   
  const [incomingChallenges, setIncomingChallenges] = useState([]); 
  
  // Stats im Hintergrund aktualisieren
  useEffect(() => {
    if (user?.name) {
        recalculateUserStats(user.name);
    }
  }, [user]);

  // --- 1. Lobby Zähler ---
  useEffect(() => {
    const fetchLobbyCount = async () => {
      if (user?.name) {
        const count = await getOpenDuelCount(user.name);
        setLobbyCount(count);
      }
    };
    fetchLobbyCount(); 
    const interval = setInterval(fetchLobbyCount, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // --- 2. Action Zähler ---
  useEffect(() => {
    const fetchMyActionCount = async () => {
      if (!user?.name) return;
      const { data } = await fetchUserGames(user.name);
      if (data) {
        let count = 0;
        data.forEach(g => {
            const isCreator = g.creator === user.name;
            const myScore = isCreator ? g.creator_score : g.challenger_score;
            const opScore = isCreator ? g.challenger_score : g.creator_score;
            const isFinished = g.creator_score !== null && g.challenger_score !== null;

            if (isFinished) {
                 const iWon = myScore > opScore || (myScore === opScore && (isCreator ? g.creator_time < g.challenger_time : g.challenger_time < g.creator_time));
                 if (iWon && g.is_claimed !== true) count++;
            }
            else if (g.status === 'active' && myScore === null) {
                count++;
            }
        });
        setActionCount(count);
      }
    };
    fetchMyActionCount();
    const interval = setInterval(fetchMyActionCount, 3000); 
    return () => clearInterval(interval);
  }, [user]);

  // --- 3. Challenges Logik ---
  useEffect(() => {
    const fetchChallenges = async () => {
      if (!user?.name) return;
      const { data } = await supabase
        .from('duels')
        .select('*')
        .eq('status', 'open') 
        .ilike('target_player', user.name);
      if (data) setIncomingChallenges(data);
    };
    fetchChallenges();
    const interval = setInterval(fetchChallenges, 5000);
    return () => clearInterval(interval);
  }, [user]);

  // UI Helper Component für Kacheln
  const DashboardCard = ({ title, icon: Icon, colorClass, onClick, disabled, badgeCount, badgeColor = "bg-orange-500" }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 transition-all duration-200
        ${disabled ? 'bg-[#111] opacity-60 cursor-not-allowed' : 'bg-[#161616] hover:bg-[#1f1f1f] hover:scale-[1.02] active:scale-95 shadow-lg'}
        h-32 w-full group
      `}
    >
      {badgeCount > 0 && (
        <span className={`absolute -top-2 -right-2 w-7 h-7 ${badgeColor} text-white font-bold text-xs flex items-center justify-center rounded-full border-2 border-[#111] shadow-lg z-10`}>
          {badgeCount}
        </span>
      )}
      <Icon size={32} className={`mb-3 ${colorClass} group-hover:scale-110 transition-transform`} />
      <span className={`text-xs font-black uppercase tracking-widest ${colorClass}`}>
        {title}
      </span>
    </button>
  );

  return (
    <Background>
      <div className="flex flex-col h-full px-4 py-6 max-w-md mx-auto relative overflow-y-auto pb-20 scrollbar-hide">
        
        {/* HEADER (Avatar angepasst) */}
        <div className="flex justify-between items-center mb-6 bg-[#161616] p-3 rounded-2xl border border-white/5 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#222] border border-white/10 overflow-hidden relative">
               {/* HIER IST DIE ÄNDERUNG: WENN AVATAR EXISTIERT, NIMM IHN, SONST ROBOTER */}
               <img 
                  src={user?.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.name}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover" 
               />
            </div>
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-white uppercase tracking-wider leading-none">
                {user?.name || 'SPIELER'}
              </h2>
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1">Ready to fight</span>
            </div>
          </div>
          <div className="flex gap-1">
              <button className="p-2 text-neutral-500 hover:text-white transition-colors"><Volume2 size={18}/></button>
              
              {/* Settings Button */}
              <button onClick={onOpenSettings} className="p-2 text-neutral-500 hover:text-white transition-colors">
                  <Settings size={18}/>
              </button>
              
              <button onClick={onLogout} className="p-2 text-neutral-500 hover:text-red-500 transition-colors"><LogOut size={18}/></button>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          
          <button 
            onClick={onCreateDuel} 
            className="col-span-1 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-orange-900/20 active:scale-95 transition-all h-32 relative"
          >
            <Plus size={32} className="mb-2" />
            <span className="text-xs font-black uppercase tracking-widest">{t('dashboard_new_duel')}</span>
          </button>

          <button className="col-span-1 bg-[#111] border border-white/5 text-neutral-600 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-visible h-32 group hover:border-white/20 transition-all">
              <div className="absolute top-2 right-2 text-[9px] bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full font-bold">SOON</div>
              <Trophy size={32} className="mb-2 opacity-50 group-hover:opacity-80 transition-opacity" />
              <span className="text-xs font-black uppercase tracking-widest opacity-50 group-hover:opacity-80 transition-opacity">{t('dashboard_new_tournament')}</span>
          </button>

          <DashboardCard title={t('tile_lobby')} icon={Users} colorClass="text-orange-500" onClick={onPlay} badgeCount={lobbyCount} />
          
          <button 
            onClick={onOpenChallenges}
            className={`relative border rounded-2xl p-4 h-32 flex flex-col items-center justify-center transition-all overflow-hidden group text-left shadow-lg
              ${incomingChallenges.length > 0 
                ? 'bg-[#1a1120] border-purple-500 hover:bg-[#251830] hover:scale-[1.02]' 
                : 'bg-[#161616] hover:bg-[#1f1f1f] border-white/5'}
            `}
          >
              {incomingChallenges.length > 0 ? (
                <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                   <span className="text-4xl font-black text-white mb-1 drop-shadow-lg">
                     {incomingChallenges.length}
                   </span>
                   <span className="text-[9px] font-bold text-purple-400 uppercase tracking-widest">
                     Anfragen
                   </span>
                </div>
              ) : (
                <>
                   <Swords size={32} className="mb-3 text-purple-500/50 transition-transform group-hover:scale-110 group-hover:text-purple-500" />
                   <span className="text-xs font-black uppercase tracking-widest text-purple-500/50 group-hover:text-purple-500 transition-colors">
                      {t('tile_challenges')}
                   </span>
                </>
              )}
          </button>
          
          <DashboardCard title={t('tile_active_games')} icon={PlayCircle} colorClass="text-green-500" onClick={onOpenActiveGames} badgeCount={actionCount} badgeColor="bg-green-500" />
          <DashboardCard title={t('tile_history')} icon={History} colorClass="text-blue-500" onClick={onOpenHistory} />
        </div>

        {/* BOTTOM GRID */}
        <div className="grid grid-cols-2 gap-3 mb-6">
           <button onClick={onOpenLeaderboard} className="bg-[#161616] hover:bg-[#1f1f1f] border border-white/5 rounded-2xl p-4 h-40 flex flex-col items-center justify-center transition-all group">
              <div className="mb-3 text-yellow-500 group-hover:scale-110 transition-transform">
                  <Trophy size={40} />
              </div>
              <span className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em]">{t('tile_leaderboard')}</span>
           </button>

           <button onClick={onOpenBadges} className="bg-[#161616] hover:bg-[#1f1f1f] border border-white/5 rounded-2xl p-4 h-40 flex flex-col items-center justify-center transition-all">
              <Medal size={40} className="text-yellow-500 mb-3" />
              <span className="text-xs font-black uppercase text-yellow-500 tracking-widest">{t('tile_badges')}</span>
           </button>
        </div>

        {/* SPENDEN */}
        <button 
           onClick={onDonate} 
           className="w-full py-4 rounded-xl bg-[#161616] border border-white/5 flex items-center justify-center gap-2 hover:bg-[#1f1f1f] transition-all group"
        >
           <Heart size={16} className="text-orange-500 fill-orange-500 group-hover:scale-110 transition-transform" />
           <span className="text-xs font-black uppercase tracking-widest text-white">{t('dashboard_donate')}</span>
        </button>

      </div>
    </Background>
  );
};

export default DashboardView;