import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import Background from '../components/ui/Background';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { 
  Plus, Trophy, Users, Swords, PlayCircle, History, 
  Medal, Heart, LogOut, Settings 
} from 'lucide-react';
import { supabase, fetchUserProfile, getOpenDuelCount, fetchUserGames, recalculateUserStats } from '../services/supabase';

const DashboardView = ({ 
  onCreateDuel, 
  onCreateArena,
  onPlay, 
  onLogout, 
  onOpenActiveGames, 
  onOpenHistory, 
  onOpenBadges, 
  onOpenLeaderboard,
  onOpenChallenges,
  onDonate, 
  onOpenSettings,
  onOpenTournaments,
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const userName = user?.username || user?.name || '';
  const baseUrl = import.meta.env.BASE_URL || '/';
  
  // State für Dashboard-Daten
  const [lobbyCount, setLobbyCount] = useState(0);     
  const [actionCount, setActionCount] = useState(0);   
  const [incomingChallenges, setIncomingChallenges] = useState([]); 
  const [showNewGameMenu, setShowNewGameMenu] = useState(false);
  
  // NEU: Lokaler State für das Profil (genau wie im Leaderboard)
  const [userProfile, setUserProfile] = useState(null);

  // 1. PROFIL LADEN (Datenbank-Quelle der Wahrheit)
  useEffect(() => {
    const loadProfileData = async () => {
        if (userName) {
            // Wir holen die frischen Daten direkt aus der DB
          const { data } = await fetchUserProfile(userName);
            if (data) {
                console.log("Dashboard: Profil geladen", data);
                setUserProfile(data);
            }
        }
    };
    loadProfileData();
      }, [userName]); // Lädt neu, wenn user sich ändert

  // 2. STATS UPDATE (Im Hintergrund)
  useEffect(() => {
    if (userName) {
        recalculateUserStats(userName);
    }
  }, [userName]);

  // 3. LOBBY COUNT
  useEffect(() => {
    const fetchLobbyCount = async () => {
      if (userName) {
        const count = await getOpenDuelCount(userName);
        setLobbyCount(count);
      }
    };
    fetchLobbyCount(); 
    const interval = setInterval(fetchLobbyCount, 5000);
    return () => clearInterval(interval);
  }, [userName]);

  // 4. ACTION COUNT (Eigene Spiele)
  useEffect(() => {
    const fetchMyActionCount = async () => {
      if (!userName) return;
      const { data } = await fetchUserGames(userName);
      if (data) {
        let count = 0;
        data.forEach(g => {
            const isCreator = g.creator === userName;
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
  }, [userName]);

  // 5. CHALLENGES
  useEffect(() => {
    const fetchChallenges = async () => {
      if (!userName) return;
      const { data } = await supabase
        .from('duels')
        .select('*')
        .eq('status', 'open') 
        .ilike('target_player', userName);
      if (data) setIncomingChallenges(data);
    };
    fetchChallenges();
    const interval = setInterval(fetchChallenges, 5000);
    return () => clearInterval(interval);
  }, [userName]);

  // UI Helper Component
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
        <span className={`absolute -top-2 -right-2 w-7 h-7 ${badgeColor} text-white font-bold text-xs flex items-center justify-center rounded-full border-2 border-[#111] shadow-lg z-10 animate-bounce`}>
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
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto pb-20 scrollbar-hide">
        {/* Watermark */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <img
            src={`${baseUrl}logo.png`}
            alt=""
            className="w-[36rem] max-w-[90%] h-auto opacity-40 blur-[1px] object-contain"
          />
        </div>
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 bg-[#161616] p-3 rounded-2xl border border-white/5 shadow-md">
          <div className="flex items-center gap-3">
            
            {/* AVATAR BEREICH */}
            <div className="w-12 h-12 rounded-xl bg-[#222] border border-white/10 overflow-hidden relative shadow-inner">
               <img 
                  // PRIORITÄT: 1. DB-Profil, 2. Lokaler User, 3. Platzhalter
                  src={userProfile?.avatar || user?.avatar || getCryptoPunkAvatar(user?.name || 'User')} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  onError={(e) => { 
                      e.target.onerror = null; 
                      e.target.src=getCryptoPunkAvatar(user?.name); 
                  }}
               />
            </div>
            
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-white uppercase tracking-wider leading-none break-all">
                {userName || 'SPIELER'}
              </h2>
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Online
              </span>
            </div>
          </div>
          
          <div className="flex gap-1">
              <button onClick={onOpenSettings} className="p-2 bg-white/5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                  <Settings size={18}/>
              </button>
              
              <button onClick={onLogout} className="p-2 bg-white/5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                  <LogOut size={18}/>
              </button>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          
          <button 
            onClick={() => setShowNewGameMenu(true)} 
            className="col-span-1 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-orange-900/20 active:scale-95 transition-all h-32 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <Plus size={32} className="mb-2 drop-shadow-md" />
            <span className="text-xs font-black uppercase tracking-widest drop-shadow-sm">{t('dashboard_new_game')}</span>
          </button>

          <button 
            onClick={onOpenTournaments}
            className="col-span-1 bg-gradient-to-br from-purple-500 to-pink-600 hover:from-purple-400 hover:to-pink-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-purple-900/20 active:scale-95 transition-all h-32 relative group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <Trophy size={32} className="mb-2 drop-shadow-md" />
            <span className="text-xs font-black uppercase tracking-widest drop-shadow-sm">{t('dashboard_new_tournament')}</span>
          </button>

          <DashboardCard title={t('tile_lobby')} icon={Users} colorClass="text-orange-500" onClick={onPlay} badgeCount={lobbyCount} />
          
          <DashboardCard title={t('tile_challenges')} icon={Swords} colorClass="text-purple-500" onClick={onOpenChallenges} badgeCount={incomingChallenges.length} badgeColor="bg-purple-500" />
          
          <DashboardCard title={t('tile_active_games')} icon={PlayCircle} colorClass="text-green-500" onClick={onOpenActiveGames} badgeCount={actionCount} badgeColor="bg-green-500" />
          <DashboardCard title={t('tile_history')} icon={History} colorClass="text-blue-500" onClick={onOpenHistory} />
        </div>

        {/* BOTTOM GRID */}
        <div className="grid grid-cols-2 gap-3 mb-6">
             <button onClick={onOpenLeaderboard} className="bg-[#161616] hover:bg-[#1f1f1f] border border-white/5 rounded-2xl p-4 h-32 flex flex-col items-center justify-center transition-all group shadow-lg">
              <div className="mb-2 text-yellow-500 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                <Trophy size={32} />
              </div>
              <span className="text-[10px] font-black uppercase text-yellow-500 tracking-[0.2em]">{t('tile_leaderboard')}</span>
           </button>

             <button onClick={onOpenBadges} className="bg-[#161616] hover:bg-[#1f1f1f] border border-white/5 rounded-2xl p-4 h-32 flex flex-col items-center justify-center transition-all group shadow-lg">
              <div className="mb-2 text-yellow-500 group-hover:scale-110 transition-transform drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                <Medal size={32} />
              </div>
              <span className="text-xs font-black uppercase text-yellow-500 tracking-widest">{t('tile_badges')}</span>
           </button>
        </div>

      </div>

      {showNewGameMenu && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-black text-lg uppercase tracking-wider mb-4">{t('dashboard_new_game')}</h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => { setShowNewGameMenu(false); onCreateDuel(); }}
                className="w-full bg-orange-500 text-black py-3 rounded-xl font-black uppercase tracking-widest"
              >
                {t('dashboard_new_duel')}
              </button>
              <button
                onClick={() => { setShowNewGameMenu(false); onCreateArena(); }}
                className="w-full bg-yellow-500 text-black py-3 rounded-xl font-black uppercase tracking-widest"
              >
                {t('dashboard_new_arena')}
              </button>
              <button
                onClick={() => setShowNewGameMenu(false)}
                className="w-full bg-white/10 text-white py-3 rounded-xl font-bold"
              >
                {t('btn_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Background>
  );
};

export default DashboardView;