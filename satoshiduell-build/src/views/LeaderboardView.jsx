import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { Home, Swords, Loader2, Star, Crown, Medal, ArrowLeft } from 'lucide-react';
import { fetchLeaderboard, recalculateUserStats } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { playSound } from '../utils/sound';

const LeaderboardView = ({ onBack, onChallenge }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const userName = user?.username || user?.name || '';
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Namen kürzen
  const formatName = (name) => {
    if (!name) return '';
    if (name.length > 16) {
      return `${name.substring(0, 6)}...${name.slice(-4)}`;
    }
    return name;
  };

  // Helper für korrekte Grammatik (Singular/Plural)
  const getWinText = (wins) => {
      if (wins === 1) return "1 Kampf gewonnen";
      return `${wins} Kämpfe gewonnen`;
  };

  // Daten laden (neu: auch neu laden wenn sich der User ändert)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (userName) {
        await recalculateUserStats(userName);
      }
      const { data } = await fetchLeaderboard();
      if (data) {
        setLeaderboard(data);
      }
      setLoading(false);
    };
    loadData();
  }, [userName]);

  // Hilfskomponente Podium
  const PodiumPlace = ({ player, rank }) => {
    if (!player) return <div className="flex-1 min-w-0" />;
    
    const isFirst = rank === 1;
    const isMe = user && player.username === userName;

    const size = isFirst ? "w-20 h-20" : "w-14 h-14";
    const color = rank === 1 ? "text-yellow-400" : rank === 2 ? "text-slate-300" : "text-amber-600";
    const border = rank === 1 ? "border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.4)]" : rank === 2 ? "border-slate-300" : "border-amber-600";

    return (
      <div className={`flex flex-col items-center ${isFirst ? '-mt-8 z-10' : 'mt-4'} flex-1 min-w-0`}>
        <div className="relative group cursor-pointer">
          <div className={`rounded-md border-4 overflow-hidden bg-neutral-900 ${size} ${border} transition-transform group-hover:scale-105`} onClick={() => { const muted = localStorage.getItem('satoshi_sound') === 'false'; playSound('click', muted); if(!isMe) onChallenge(player.username); }}>
            {/* AVATAR LOGIK: Eigener Avatar oder Dicebear Fallback */}
            <img 
                src={player.avatar || getCryptoPunkAvatar(player.username)} 
                alt={player.username} 
                className="w-full h-full object-cover" 
            />
          </div>
           <div className={`absolute -bottom-2 -right-1 bg-black rounded-full p-1 border ${border}`}>
             {rank === 1 ? <Crown size={14} className={color} /> : <Medal size={14} className={color} />}
          </div>
        </div>

        <span className="text-white font-black uppercase text-[10px] mt-2 tracking-widest truncate w-full px-1 text-center">
            {formatName(player.username)} {isMe && <span className="text-orange-500">*</span>}
        </span>
        
        <span className={`${color} font-mono text-xs font-bold mb-1`}>{(player.total_sats_won || 0).toLocaleString()}</span>

        {/* Challenge Button im Podium */}
        {!isMe && (
            <button 
                onClick={() => { const muted = localStorage.getItem('satoshi_sound') === 'false'; playSound('click', muted); onChallenge(player.username); }}
                className="mt-1 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-orange-500 transition-all active:scale-90 border border-white/5"
            >
                <Swords size={14} />
            </button>
        )}
      </div>
    );
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        
        {/* HEADER */}
        <div className="p-6 pb-2 relative flex items-center justify-center">
            <button 
              onClick={onBack}
              className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all active:scale-95"
            >
              <ArrowLeft size={20} />
            </button>
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

            {/* TOP 10 LISTE */}
            <div className="flex-1 overflow-y-auto px-4 pb-28 space-y-2 scrollbar-hide">
              {leaderboard.slice(3, 10).map((p, i) => {
                  const isMe = user && p.username === userName;
                  return (
                    <div 
                      key={p.username} 
                      className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${isMe ? 'bg-orange-500/10 border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'bg-[#161616] border-white/5 hover:border-white/10'}`}
                    >
                      {/* LINKER BEREICH: Rang, Bild, Name */}
                      <div className="flex items-center gap-4 flex-1 min-w-0 mr-4">
                        <span className="font-mono font-black text-neutral-600 w-6 italic flex-shrink-0">#{i + 4}</span>
                        <div className="w-10 h-10 rounded-md bg-neutral-800 border border-white/5 overflow-hidden flex-shrink-0">
                           {/* AVATAR LOGIK AUCH HIER */}
                           <img 
                                src={p.avatar || getCryptoPunkAvatar(p.username)} 
                                alt={p.username} 
                                className="w-full h-full object-cover" 
                           />
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className={`text-sm font-black uppercase tracking-tight truncate ${isMe ? 'text-orange-500' : 'text-white'}`}>
                             {formatName(p.username)} {isMe && <span className="text-[10px] opacity-70 ml-1">{t('result_you_marker')}</span>}
                           </span>
                           <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest truncate">
                             {getWinText(p.wins)}
                           </span>
                        </div>
                      </div>

                      {/* RECHTER BEREICH: Stats & Challenge Button */}
                      <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                             <span className="block font-mono font-black text-sm text-yellow-500 leading-none">{(p.total_sats_won || 0).toLocaleString()}</span>
                             <span className="text-[8px] font-black text-neutral-600 uppercase">Sats</span>
                          </div>
                          {!isMe && (
                             <button 
                               onClick={() => onChallenge(p.username)} 
                               className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-orange-500 transition-all active:scale-90"
                             >
                               <Swords size={18} />
                             </button>
                          )}
                      </div>
                    </div>
                  );
               })}

               {/* SUCHE */}
               <div className="mt-6">
                 <label className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Spieler suchen</label>
                 <input
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   placeholder="Name eingeben..."
                   className="mt-2 w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-orange-500"
                 />
                 {search.trim() && (
                   (() => {
                     const term = search.trim().toLowerCase();
                     const found = leaderboard.find(p => (p.username || '').toLowerCase().includes(term));
                     if (!found) {
                       return <p className="text-xs text-neutral-500 mt-2">Kein Spieler gefunden.</p>;
                     }
                     const isMe = user && found.username === userName;
                     return (
                       <div className="mt-3 flex items-center justify-between p-3 rounded-2xl border bg-[#161616] border-white/5">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-md bg-neutral-800 border border-white/5 overflow-hidden">
                             <img src={found.avatar || getCryptoPunkAvatar(found.username)} alt={found.username} className="w-full h-full object-cover" />
                           </div>
                           <div className="flex flex-col">
                             <span className="text-sm font-black uppercase text-white">{formatName(found.username)} {isMe && <span className="text-orange-500">*</span>}</span>
                             <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">{getWinText(found.wins)}</span>
                           </div>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="text-right">
                             <span className="block font-mono font-black text-sm text-yellow-500 leading-none">{(found.total_sats_won || 0).toLocaleString()}</span>
                             <span className="text-[8px] font-black text-neutral-600 uppercase">Sats</span>
                           </div>
                           {!isMe && (
                             <button
                               onClick={() => onChallenge(found.username)}
                               className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-orange-500 transition-all active:scale-90"
                             >
                               <Swords size={18} />
                             </button>
                           )}
                         </div>
                       </div>
                     );
                   })()
                 )}
               </div>
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