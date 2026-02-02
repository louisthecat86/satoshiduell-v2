import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Home, Trophy, User, Users, Globe, Zap, Crown, Medal, Fingerprint, Flame, TrendingUp, Coins, Gem, Star, Rocket, Flag, Share2, Loader2 } from 'lucide-react';
import { fetchUserGames } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';

const BadgesView = ({ onBack }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ 
      played: 0, wins: 0, sats: 0, perfect: 0, 
      speedWin: false, lightSpeed: false, highRoller: false, whaleBet: false, 
      photoFinish: false, currentStreak: 0 
  });

  useEffect(() => {
    const calculateStats = async () => {
      const { data } = await fetchUserGames(user.name);
      
      if (data) {
          let calculated = { 
              played: 0, wins: 0, sats: 0, perfect: 0, 
              speedWin: false, lightSpeed: false, highRoller: false, whaleBet: false, 
              photoFinish: false, currentStreak: 0 
          };

          // Sortieren: Neueste zuerst für Streak-Berechnung
          const sorted = [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          
          let tempStreak = 0;
          let streakActive = true;

          sorted.forEach(d => {
             // Nur fertige Spiele zählen
             const isFinished = d.creator_score !== null && d.challenger_score !== null;
             if (!isFinished) return;

             calculated.played++;

             const isCreator = d.creator === user.name;
             const myScore = isCreator ? d.creator_score : d.challenger_score;
             const opScore = isCreator ? d.challenger_score : d.creator_score;
             const myTime = isCreator ? d.creator_time : d.challenger_time;
             const opTime = isCreator ? d.challenger_time : d.creator_time;

             // Gewonnen?
             const iWon = myScore > opScore || (myScore === opScore && myTime < opTime);

             // Streak Logik
             if (streakActive) {
                if (iWon) tempStreak++;
                else streakActive = false; // Streak gerissen
             }

             if (iWon) {
                 calculated.wins++;
                 calculated.sats += (d.amount || 0);
                 
                 if (myTime < 12.0) calculated.speedWin = true;
                 if (myTime < 8.0) calculated.lightSpeed = true;
                 if (myScore === opScore && myTime < opTime) calculated.photoFinish = true;
             }

             if (myScore === 5) calculated.perfect++;
             
             if (d.amount >= 500) calculated.highRoller = true;
             if (d.amount >= 5000) calculated.whaleBet = true;
          });

          calculated.currentStreak = tempStreak;
          setStats(calculated);
      }
      setLoading(false);
    };

    calculateStats();
  }, [user]);

  // --- BADGE LISTE (1:1 aus deinem Code übernommen) ---
  const BADGES = [
    { id: 'p1', name: t('badge_p1_name'), desc: t('badge_p1_desc'), icon: User, color: 'text-blue-400', achieved: stats.played >= 5 },
    { id: 'p2', name: t('badge_p2_name'), desc: t('badge_p2_desc'), icon: Users, color: 'text-blue-500', achieved: stats.played >= 25 },
    { id: 'p3', name: t('badge_p3_name'), desc: t('badge_p3_desc'), icon: Globe, color: 'text-blue-600', achieved: stats.played >= 100 },
    { id: 'p4', name: t('badge_p4_name'), desc: t('badge_p4_desc'), icon: Zap, color: 'text-purple-500', achieved: stats.played >= 500 },
    { id: 'p5', name: t('badge_p5_name'), desc: t('badge_p5_desc'), icon: Crown, color: 'text-yellow-500', achieved: stats.played >= 1000 },
    
    { id: 'w1', name: t('badge_w1_name'), desc: t('badge_w1_desc'), icon: Trophy, color: 'text-yellow-400', achieved: stats.wins >= 5 },
    { id: 'w2', name: t('badge_w2_name'), desc: t('badge_w2_desc'), icon: Medal, color: 'text-yellow-500', achieved: stats.wins >= 25 },
    { id: 'w3', name: t('badge_w3_name'), desc: t('badge_w3_desc'), icon: Fingerprint, color: 'text-orange-500', achieved: stats.wins >= 100 },
    { id: 'w4', name: t('badge_w4_name'), desc: t('badge_w4_desc'), icon: Crown, color: 'text-red-500', achieved: stats.wins >= 500 },
    
    { id: 'st1', name: t('badge_st1_name'), desc: t('badge_st1_desc'), icon: Flame, color: 'text-orange-400', achieved: stats.currentStreak >= 3 },
    { id: 'st2', name: t('badge_st2_name'), desc: t('badge_st2_desc'), icon: TrendingUp, color: 'text-red-500', achieved: stats.currentStreak >= 5 },
    { id: 'st3', name: t('badge_st3_name'), desc: t('badge_st3_desc'), icon: Crown, color: 'text-purple-500', achieved: stats.currentStreak >= 10 },
    
    { id: 's1', name: t('badge_s1_name'), desc: t('badge_s1_desc'), icon: Coins, color: 'text-green-400', achieved: stats.sats >= 100 },
    { id: 's2', name: t('badge_s2_name'), desc: t('badge_s2_desc'), icon: Coins, color: 'text-green-500', achieved: stats.sats >= 1000 },
    { id: 's3', name: t('badge_s3_name'), desc: t('badge_s3_desc'), icon: Coins, color: 'text-green-600', achieved: stats.sats >= 10000 },
    { id: 's4', name: t('badge_s4_name'), desc: t('badge_s4_desc'), icon: Gem, color: 'text-cyan-400', achieved: stats.sats >= 50000 },
    { id: 's5', name: t('badge_s5_name'), desc: t('badge_s5_desc'), icon: Crown, color: 'text-yellow-400', achieved: stats.sats >= 100000 },
    
    { id: 'sk1', name: t('badge_sk1_name'), desc: t('badge_sk1_desc'), icon: Star, color: 'text-cyan-400', achieved: stats.perfect >= 5 },
    { id: 'sk2', name: t('badge_sk2_name'), desc: t('badge_sk2_desc'), icon: Star, color: 'text-purple-400', achieved: stats.perfect >= 25 },
    { id: 'sk3', name: t('badge_sk3_name'), desc: t('badge_sk3_desc'), icon: Crown, color: 'text-pink-500', achieved: stats.perfect >= 100 },
    
    { id: 'sp1', name: t('badge_sp1_name'), desc: t('badge_sp1_desc'), icon: Rocket, color: 'text-red-500', achieved: stats.speedWin },
    { id: 'sp2', name: t('badge_sp2_name'), desc: t('badge_sp2_desc'), icon: Zap, color: 'text-yellow-300', achieved: stats.lightSpeed },
    { id: 'sp3', name: t('badge_sp3_name'), desc: t('badge_sp3_desc'), icon: Gem, color: 'text-purple-400', achieved: stats.highRoller },
    { id: 'sp4', name: t('badge_sp4_name'), desc: t('badge_sp4_desc'), icon: Flag, color: 'text-pink-500', achieved: stats.photoFinish },
  ];

  const unlockedCount = BADGES.filter(b => b.achieved).length;
  const progressPercent = Math.round((unlockedCount / BADGES.length) * 100);

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto p-4 overflow-y-auto scrollbar-hide pb-24 relative">
        
        {/* Header */}
        <div className="flex items-center justify-between py-4 mb-2">
           <h2 className="text-xl font-black text-white uppercase tracking-widest text-yellow-500 flex items-center gap-2">
             <Medal size={24} /> {t('tile_badges')}
           </h2>
           <div className="flex flex-col text-right">
                <span className="text-xs text-neutral-400 font-bold">{unlockedCount} / {BADGES.length}</span>
                <span className="text-[10px] text-neutral-500">{progressPercent}% Completed</span>
           </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-neutral-800 rounded-full overflow-hidden mb-6 border border-white/5">
            <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
        </div>

        {loading ? (
            <div className="flex justify-center mt-20"><Loader2 className="animate-spin text-yellow-500" size={40}/></div>
        ) : (
            <div className="grid grid-cols-2 gap-3">
                {BADGES.map(badge => {
                   const Icon = badge.icon;
                   const isElite = badge.icon === Crown;
                   
                   return (
                     <div key={badge.id} className={`relative p-4 rounded-xl border flex flex-col items-center gap-2 text-center transition-all ${badge.achieved ? (isElite ? 'bg-gradient-to-br from-neutral-900 to-black border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'bg-neutral-900/80 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]') : 'bg-neutral-900/40 border-white/5 opacity-50 grayscale'}`}>
                        
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-black border ${badge.achieved ? (isElite ? 'border-yellow-400' : 'border-yellow-500/50') : 'border-white/10'}`}>
                            <Icon size={24} className={badge.achieved ? badge.color : 'text-neutral-600'} />
                        </div>

                        <div>
                            <h3 className={`font-black text-xs uppercase ${badge.achieved ? 'text-white' : 'text-neutral-500'}`}>{badge.name}</h3>
                            <p className="text-[9px] text-neutral-400 font-mono mt-1 leading-tight">{badge.desc}</p>
                        </div>
                     </div>
                   );
                })}
            </div>
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

export default BadgesView;