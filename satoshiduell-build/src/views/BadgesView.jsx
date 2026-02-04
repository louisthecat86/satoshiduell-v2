import React, { useState, useEffect, useMemo } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Medal, Trophy, Zap, Crown, Flame, Target, Lock, Star, Coins, Gem } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// WICHTIG: Wir laden jetzt das Profil, nicht mehr alle Spiele (viel schneller)
import { fetchUserProfile, recalculateUserStats, supabase } from '../services/supabase'; 
import { useTranslation } from '../hooks/useTranslation';

// --- KONFIGURATION DER BADGES ---
const BADGE_CONFIG = [
  {
    key: 'wins',
    stat: 'wins',
    icon: Trophy,
    color: 'text-orange-500',
    thresholds: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150, 250, 500]
  },
  {
    key: 'games',
    stat: 'games_played',
    icon: Flame,
    color: 'text-red-500',
    thresholds: [5, 10, 15, 25, 40, 60, 100, 150, 250, 400, 600, 1000]
  },
  {
    key: 'sats',
    stat: 'total_sats_won',
    icon: Coins,
    color: 'text-yellow-400',
    thresholds: [100, 250, 500, 1000, 2500, 5000, 7500, 10000, 20000, 50000, 100000, 250000]
  },
  {
    key: 'draws',
    stat: 'draws',
    icon: Star,
    color: 'text-blue-400',
    thresholds: [1, 3, 5, 10, 25, 50]
  },
  {
    key: 'daily',
    stat: 'login_days',
    icon: Target,
    color: 'text-emerald-400',
    thresholds: [1, 3, 7, 14, 30, 60, 100, 180, 365]
  }
];

const BadgesView = ({ onBack }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const userName = user?.username || user?.name || '';
  const [expandedCategory, setExpandedCategory] = useState('wins');
  
  // State für die Profil-Daten
  const [stats, setStats] = useState({ wins: 0, total_sats_won: 0, games_played: 0 });
  const [loading, setLoading] = useState(true);

  // 1. Profil laden (Daten kommen aus der 'profiles' Tabelle)
  useEffect(() => {
    const loadData = async () => {
      if (userName) {
        await recalculateUserStats(userName);
        const { data } = await fetchUserProfile(userName);
        if (data) {
            const today = new Date().toISOString().slice(0, 10);
            const lastLogin = data.last_login || null;
            let loginDays = Number(data.login_days || 0);

            if (lastLogin !== today) {
              loginDays += 1;
              await supabase
                .from('profiles')
                .update({ last_login: today, login_days: loginDays })
                .eq('username', userName);
            }

            setStats({ ...data, login_days: loginDays, last_login: today });
        }
      }
      setLoading(false);
    };
    loadData();
  }, [userName]);

  const BADGE_GROUPS = useMemo(() => {
    return BADGE_CONFIG.map(cfg => ({
      key: cfg.key,
      icon: cfg.icon,
      color: cfg.color,
      title: t(`badge_category_${cfg.key}`),
      items: cfg.thresholds.map(count => ({
        id: `${cfg.key}_${count}`,
        title: t(`badge_${cfg.key}_title`, { count }),
        desc: t(`badge_${cfg.key}_desc`, { count }),
        icon: cfg.icon,
        color: cfg.color,
        condition: (s) => (s[cfg.stat] || 0) >= count,
        progress: (s) => Math.min(s[cfg.stat] || 0, count),
        goal: count
      }))
    }));
  }, [t]);

  // 2. Berechnen wie viele Badges erreicht sind
  const allBadges = BADGE_GROUPS.flatMap(g => g.items);
  const unlockedCount = allBadges.filter(b => b.condition(stats)).length;
  const progressPercent = Math.round((unlockedCount / allBadges.length) * 100);

  const handleShareBadges = async () => {
    try {
      const shareText = `${t('share_text_prefix')} ${unlockedCount} ${t('share_text_suffix')}`;
      if (navigator.share) {
        await navigator.share({ title: t('share_title'), text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        alert(t('share_clipboard'));
      }
    } catch (err) {
      console.error('Badge share error:', err);
    }
  };

  return (
    <Background allowScroll>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide pb-8">
        
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
                  {t('badge_unlocked', { unlocked: unlockedCount, total: allBadges.length, percent: progressPercent })}
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
        <div className="flex-1 px-4 pb-10 pt-2 flex flex-col gap-4">
          {loading ? (
            <div className="text-center py-10 animate-pulse text-neutral-500">{t('badge_loading')}</div>
          ) : (
            BADGE_GROUPS.map(group => {
            const isOpen = expandedCategory === group.key;
            return (
              <div key={group.key} className="bg-black/30 border border-white/5 rounded-2xl overflow-hidden">
                    <button
                onClick={() => setExpandedCategory(isOpen ? null : group.key)}
                      className="w-full flex items-center justify-between p-5 text-left"
              >
                <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${group.color} bg-black/40 border-white/10`}>
                          <group.icon size={22} />
                </div>
                <div>
                          <div className="text-white font-black uppercase tracking-wider text-base">{group.title}</div>
                          <div className="text-[11px] text-neutral-500">{t('badge_section_hint')}</div>
                </div>
                </div>
                <span className="text-neutral-400 text-xs">{isOpen ? '−' : '+'}</span>
              </button>

                    {isOpen && (
                      <div className="px-4 pb-4 grid grid-cols-1 gap-4">
                {group.items.map((badge) => {
                  const isUnlocked = badge.condition(stats);
                  const current = badge.progress(stats);
                  const percent = (current / badge.goal) * 100;

                  return (
                  <div 
                    key={badge.id}
                              className={`relative p-6 rounded-2xl border transition-all overflow-hidden min-h-[170px]
                      ${isUnlocked 
                        ? 'bg-[#161616] border-white/10 shadow-lg' 
                        : 'bg-black/40 border-white/5 opacity-60 grayscale-[0.8]'}
                    `}
                  >
                    <div className="flex items-start gap-4 relative z-10">
                                  <div className={`w-16 h-16 rounded-xl flex items-center justify-center border flex-shrink-0
                          ${isUnlocked 
                            ? `bg-black/40 ${badge.color} border-white/10 shadow-inner` 
                            : 'bg-black/20 text-neutral-600 border-white/5'}
                        `}>
                                    {isUnlocked ? <badge.icon size={30} /> : <Lock size={24} />}
                      </div>

                      <div className="flex-1 min-w-0">
                                      <h3 className={`text-xl font-black uppercase tracking-wider truncate ${isUnlocked ? 'text-white' : 'text-neutral-500'}`}>
                          {badge.title}
                        </h3>
                                      <p className="text-sm text-neutral-400 font-medium leading-tight mt-2">
                          {badge.desc}
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0">
                          {isUnlocked ? (
                            <div className="bg-green-500/20 text-green-500 p-3 rounded-full">
                              <Star size={18} fill="currentColor" />
                            </div>
                          ) : (
                            <span className="text-xs font-mono text-neutral-600 block bg-white/5 px-3 py-1 rounded">
                            {current} / {badge.goal}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isUnlocked && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/5">
                        <div 
                          className="h-full bg-neutral-600/50 transition-all duration-1000" 
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
                </div>
              )}
              </div>
            );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="mt-6 px-6">
            <div className="flex flex-col gap-2">
              <Button onClick={handleShareBadges} variant="primary" className="w-full py-4 shadow-2xl flex items-center justify-center gap-2">
                {t('share_badges_btn')}
              </Button>
              <Button onClick={onBack} variant="secondary" className="w-full py-4 shadow-2xl flex items-center justify-center gap-2">
                {t('back_home')}
              </Button>
            </div>
        </div>

      </div>
    </Background>
  );
};

export default BadgesView;