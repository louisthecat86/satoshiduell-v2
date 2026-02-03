import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Medal, Trophy, Zap, Crown, Flame, Target, Lock, Star, Coins, Gem } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// WICHTIG: Wir laden jetzt das Profil, nicht mehr alle Spiele (viel schneller)
import { fetchUserProfile } from '../services/supabase'; 
import { useTranslation } from '../hooks/useTranslation';

// --- KONFIGURATION DER BADGES ---
// Hier definieren wir die Regeln basierend auf den Daten in der 'profiles' Tabelle
const BADGES = [
  // KATEGORIE: SIEGE
  {
    id: 'first_win',
    title: 'Anfängerglück',
    desc: 'Gewinne dein erstes Spiel',
    icon: Star,
    color: 'text-yellow-400',
    condition: (stats) => (stats.wins || 0) >= 1,
    progress: (stats) => Math.min(stats.wins || 0, 1),
    goal: 1
  },
  {
    id: 'winner_10',
    title: 'Champion',
    desc: 'Gewinne 10 Duelle',
    icon: Trophy,
    color: 'text-orange-500',
    condition: (stats) => (stats.wins || 0) >= 10,
    progress: (stats) => Math.min(stats.wins || 0, 10),
    goal: 10
  },
  {
    id: 'winner_50',
    title: 'Legende',
    desc: 'Gewinne 50 Duelle',
    icon: Crown,
    color: 'text-purple-500',
    condition: (stats) => (stats.wins || 0) >= 50,
    progress: (stats) => Math.min(stats.wins || 0, 50),
    goal: 50
  },

  // KATEGORIE: SATS (Geld)
  {
    id: 'sats_100',
    title: 'Sparschwein',
    desc: 'Gewinne insgesamt 100 Sats',
    icon: Coins,
    color: 'text-blue-400',
    condition: (stats) => (stats.total_sats_won || 0) >= 100,
    progress: (stats) => Math.min(stats.total_sats_won || 0, 100),
    goal: 100
  },
  {
    id: 'sats_1000',
    title: 'High Roller',
    desc: 'Gewinne insgesamt 1.000 Sats',
    icon: Gem,
    color: 'text-cyan-400',
    condition: (stats) => (stats.total_sats_won || 0) >= 1000,
    progress: (stats) => Math.min(stats.total_sats_won || 0, 1000),
    goal: 1000
  },
  {
    id: 'sats_10000',
    title: 'Satoshi Millionär',
    desc: 'Gewinne insgesamt 10.000 Sats',
    icon: Zap,
    color: 'text-yellow-300',
    condition: (stats) => (stats.total_sats_won || 0) >= 10000,
    progress: (stats) => Math.min(stats.total_sats_won || 0, 10000),
    goal: 10000
  },

  // KATEGORIE: ANZAHL SPIELE (Fleiß)
  {
    id: 'games_5',
    title: 'Aufgewärmt',
    desc: 'Spiele 5 Duelle',
    icon: Flame,
    color: 'text-red-500',
    condition: (stats) => (stats.games_played || 0) >= 5,
    progress: (stats) => Math.min(stats.games_played || 0, 5),
    goal: 5
  },
  {
    id: 'games_25',
    title: 'Süchtig',
    desc: 'Spiele 25 Duelle',
    icon: Target,
    color: 'text-red-600',
    condition: (stats) => (stats.games_played || 0) >= 25,
    progress: (stats) => Math.min(stats.games_played || 0, 25),
    goal: 25
  }
];

const BadgesView = ({ onBack }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // State für die Profil-Daten
  const [stats, setStats] = useState({ wins: 0, total_sats_won: 0, games_played: 0 });
  const [loading, setLoading] = useState(true);

  // 1. Profil laden (Daten kommen aus der 'profiles' Tabelle)
  useEffect(() => {
    const loadData = async () => {
      if (user?.name) {
        const { data } = await fetchUserProfile(user.name);
        if (data) {
            setStats(data);
        }
      }
      setLoading(false);
    };
    loadData();
  }, [user]);

  // 2. Berechnen wie viele Badges erreicht sind
  const unlockedCount = BADGES.filter(b => b.condition(stats)).length;
  const progressPercent = Math.round((unlockedCount / BADGES.length) * 100);

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 pb-2 flex items-center gap-4">
            <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="text-white" size={20}/>
            </button>
            <div className="flex flex-col">
                <h2 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
                   <Medal size={24} className="text-yellow-500" /> {t('tile_badges')}
                </h2>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">
                    {unlockedCount} / {BADGES.length} freigeschaltet ({progressPercent}%)
                </span>
            </div>
        </div>

        {/* GLOBAL PROGRESS BAR */}
        <div className="px-6 mb-4">
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-1000"
                    style={{ width: `${progressPercent}%` }}
                />
            </div>
        </div>

        {/* BADGE GRID */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-2 space-y-3 scrollbar-hide">
            {loading ? (
                <div className="text-center py-10 animate-pulse text-neutral-500">Lade Erfolge...</div>
            ) : (
                BADGES.map((badge) => {
                    const isUnlocked = badge.condition(stats);
                    const current = badge.progress(stats);
                    const percent = (current / badge.goal) * 100;
                    
                    return (
                        <div 
                            key={badge.id}
                            className={`relative p-4 rounded-2xl border transition-all overflow-hidden
                                ${isUnlocked 
                                    ? 'bg-[#161616] border-white/10 shadow-lg' 
                                    : 'bg-black/40 border-white/5 opacity-60 grayscale-[0.8]'}
                            `}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                {/* ICON */}
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border flex-shrink-0
                                    ${isUnlocked 
                                        ? `bg-black/40 ${badge.color} border-white/10 shadow-inner` 
                                        : 'bg-black/20 text-neutral-600 border-white/5'}
                                `}>
                                    {isUnlocked ? <badge.icon size={24} /> : <Lock size={20} />}
                                </div>

                                {/* TEXT */}
                                <div className="flex-1 min-w-0">
                                    <h3 className={`text-sm font-black uppercase tracking-wider truncate ${isUnlocked ? 'text-white' : 'text-neutral-500'}`}>
                                        {badge.title}
                                    </h3>
                                    <p className="text-[10px] text-neutral-400 font-medium leading-tight mt-0.5">
                                        {badge.desc}
                                    </p>
                                </div>

                                {/* STATUS / COUNTER */}
                                <div className="text-right flex-shrink-0">
                                    {isUnlocked ? (
                                        <div className="bg-green-500/20 text-green-500 p-1.5 rounded-full">
                                            <Star size={12} fill="currentColor" />
                                        </div>
                                    ) : (
                                        <span className="text-[9px] font-mono text-neutral-600 block bg-white/5 px-2 py-1 rounded">
                                            {current} / {badge.goal}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* MINI PROGRESS BAR (Nur für noch nicht erreichte Badges) */}
                            {!isUnlocked && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5">
                                    <div 
                                        className="h-full bg-neutral-600/50 transition-all duration-1000" 
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            )}
                        </div>
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

export default BadgesView;