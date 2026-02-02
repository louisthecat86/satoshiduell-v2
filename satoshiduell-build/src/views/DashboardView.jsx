import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import Background from '../components/ui/Background';
import { 
  Plus, Trophy, Users, Swords, PlayCircle, History, 
  Trophy as TrophyIcon, Medal, Heart, LogOut, Settings, Volume2 
} from 'lucide-react';

import { getOpenDuelCount, fetchUserGames } from '../services/supabase';

// WICHTIG: onOpenLeaderboard in den Props hinzufügen
const DashboardView = ({ 
  onCreateDuel, 
  onPlay, 
  onLogout, 
  onOpenActiveGames, 
  onOpenHistory, 
  onOpenBadges, 
  onOpenLeaderboard // <--- NEU
}) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  const [lobbyCount, setLobbyCount] = useState(0);     
  const [actionCount, setActionCount] = useState(0);   
  const [tournamentCount, setTournamentCount] = useState(0); 

  // 1. Lobby Zähler
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

  // 2. Action Zähler (Meine Games)
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

            // Fall A: Spiel fertig & gewonnen
            if (isFinished) {
                 const iWon = myScore > opScore || (myScore === opScore && (isCreator ? g.creator_time < g.challenger_time : g.challenger_time < g.creator_time));
                 
                 // Nur zählen, wenn noch NICHT abgeholt
                 if (iWon && g.is_claimed !== true) {
                     count++;
                 }
            }
            // Fall B: Spiel läuft & ich muss ziehen
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


  // --- UI KOMPONENTE: Kachel ---
  const DashboardCard = ({ title, icon: Icon, colorClass, onClick, disabled, subText, badgeCount, badgeColor = "bg-orange-500" }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border border-white/5 transition-all duration-200
        ${disabled ? 'bg-[#111] opacity-60 cursor-not-allowed' : 'bg-[#161616] hover:bg-[#1f1f1f] hover:scale-[1.02] active:scale-95 shadow-lg'}
        h-32 w-full group
      `}
    >
      {subText && (
        <span className="absolute top-2 right-2 text-[9px] bg-white/10 px-2 py-0.5 rounded-full text-neutral-400">
          {subText}
        </span>
      )}

      {/* BADGE */}
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
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6 bg-[#161616] p-3 rounded-2xl border border-white/5 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#222] border border-white/10 overflow-hidden">
               <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.name}`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            
            <div className="flex flex-col">
              <h2 className="text-lg font-black text-white uppercase tracking-wider leading-none">
                {user?.name || 'SPIELER'}
              </h2>
              <p className="text-[10px] text-orange-500 font-bold mt-1">
                {user?.score || 0} {t('sats_won').toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex gap-1">
              <button className="p-2 text-neutral-500 hover:text-white transition-colors"><Volume2 size={18}/></button>
              <button className="p-2 text-neutral-500 hover:text-white transition-colors"><Settings size={18}/></button>
              <button onClick={onLogout} className="p-2 text-neutral-500 hover:text-red-500 transition-colors"><LogOut size={18}/></button>
          </div>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          
          {/* 1. NEUES DUELL */}
          <button 
            onClick={onCreateDuel} 
            className="col-span-1 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg shadow-orange-900/20 active:scale-95 transition-all h-32 relative"
          >
            <Plus size={32} className="mb-2" />
            <span className="text-xs font-black uppercase tracking-widest">{t('dashboard_new_duel')}</span>
          </button>

          {/* 2. TURNIER */}
          <button className="col-span-1 bg-[#111] border border-white/5 text-neutral-600 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-visible h-32 group hover:border-white/20 transition-all">
            {tournamentCount === 0 && (
              <div className="absolute top-2 right-2 text-[9px] bg-neutral-800 text-neutral-500 px-2 py-0.5 rounded-full font-bold">SOON</div>
            )}
            {tournamentCount > 0 && (
               <span className="absolute -top-2 -right-2 w-7 h-7 bg-neutral-700 text-neutral-300 font-bold text-xs flex items-center justify-center rounded-full border-2 border-[#111] shadow-lg z-10">
                 {tournamentCount}
               </span>
            )}
            <Trophy size={32} className="mb-2 opacity-50 group-hover:opacity-80 transition-opacity" />
            <span className="text-xs font-black uppercase tracking-widest opacity-50 group-hover:opacity-80 transition-opacity">{t('dashboard_new_tournament')}</span>
          </button>

          {/* 3. LOBBY */}
          <DashboardCard 
            title={t('tile_lobby')} 
            icon={Users} 
            colorClass="text-orange-500" 
            onClick={onPlay} 
            badgeCount={lobbyCount} 
            badgeColor="bg-orange-500" 
          />
          
          {/* 4. CHALLENGES */}
          <DashboardCard title={t('tile_challenges')} icon={Swords} colorClass="text-purple-500" onClick={() => alert("Challenges")} />
          
          {/* 5. LAUFENDE SPIELE */}
          <DashboardCard 
             title={t('tile_active_games')} 
             icon={PlayCircle} 
             colorClass="text-green-500" 
             onClick={onOpenActiveGames} 
             badgeCount={actionCount}    
             badgeColor="bg-green-500"   
          />

          {/* 6. HISTORIE */}
          <DashboardCard 
            title={t('tile_history')} 
            icon={History} 
            colorClass="text-blue-500" 
            onClick={onOpenHistory} 
          />
        </div>

        {/* BOTTOM GRID */}
        <div className="grid grid-cols-2 gap-3 mb-6">
           
           {/* 7. LEADERBOARD (Klickbar gemacht) */}
           <button 
              onClick={onOpenLeaderboard} // <--- HIER VERKNÜPFT
              className="bg-[#161616] hover:bg-[#1f1f1f] border border-white/5 rounded-2xl p-4 h-40 flex flex-col items-center justify-center transition-all relative overflow-hidden text-left"
           >
              {/* Header */}
              <div className="flex items-center gap-2 mb-3 z-10 w-full justify-start">
                  <TrophyIcon size={14} className="text-yellow-500" />
                  <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">{t('tile_leaderboard')}</span>
              </div>
              
              {/* Vorschau (Dummy Data, dient als Teaser) */}
              <div className="flex flex-col gap-2 overflow-hidden w-full z-10 opacity-70">
                <div className="flex justify-between text-[10px] font-bold text-white w-full"><span className="text-orange-500">1.</span> DRAGSUGG <span className="text-neutral-500">...</span></div>
                <div className="flex justify-between text-[10px] font-bold text-white w-full"><span className="text-white">2.</span> LBUG <span className="text-neutral-500">...</span></div>
              </div>
              
              {/* Deko im Hintergrund */}
              <TrophyIcon size={80} className="absolute -bottom-6 -right-6 text-yellow-500/5 rotate-12" />
           </button>

           {/* 8. BADGES / ERFOLGE */}
           <button 
              onClick={onOpenBadges} 
              className="bg-[#161616] hover:bg-[#1f1f1f] border border-white/5 rounded-2xl p-4 h-40 flex flex-col items-center justify-center transition-all"
           >
              <Medal size={40} className="text-yellow-500 mb-3" />
              <span className="text-xs font-black uppercase text-yellow-500 tracking-widest">{t('tile_badges')}</span>
           </button>
        </div>

        {/* SPENDEN */}
        <button className="w-full py-4 rounded-xl bg-[#161616] border border-white/5 flex items-center justify-center gap-2 hover:bg-[#1f1f1f] transition-all group">
           <Heart size={16} className="text-orange-500 fill-orange-500 group-hover:scale-110 transition-transform" />
           <span className="text-xs font-black uppercase tracking-widest text-white">{t('dashboard_donate')}</span>
        </button>

      </div>
    </Background>
  );
};

export default DashboardView;