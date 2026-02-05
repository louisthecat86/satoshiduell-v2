import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowRight, X, Users, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { createArenaEntry, fetchQuestionIds } from '../services/supabase';

const CreateArenaView = ({ onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(3);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 1 && val.startsWith('0')) val = val.substring(1);
    if (Number(val) > 9999) val = '9999';
    setAmount(val);
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) === 0 || loading) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: questionIds, error: questionError } = await fetchQuestionIds(5);
      if (questionError || !questionIds || questionIds.length === 0) {
        throw new Error('Fehler: Keine Fragen geladen.');
      }

      const creatorName = user?.username || user?.name || 'Unbekannt';
      const { data, error } = await createArenaEntry(creatorName, parseInt(amount), maxPlayers, questionIds);
      if (error) throw error;

      if (onConfirm) onConfirm(data.id);
    } catch (err) {
      console.error('Fehler beim Erstellen:', err);
      setErrorMsg(t('arena_create_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        <div className="absolute top-6 left-4 z-50">
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white transition-colors bg-black/20 rounded-full backdrop-blur-sm">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full">
          <form onSubmit={handleConfirm} className="w-full flex flex-col items-center">
            <h2 className="text-4xl font-black text-white italic uppercase text-center mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] leading-tight">
              {t('arena_title')}
            </h2>

            <div className="w-full max-w-[320px] mb-6">
              <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2 block">
                {t('arena_players_label')}
              </label>
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, idx) => {
                  const val = idx + 3;
                  const active = val === maxPlayers;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMaxPlayers(val)}
                      className={`py-3 rounded-xl text-xs font-black border transition-all ${active ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-[#111] border-white/10 text-neutral-400 hover:text-white'}`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative w-full max-w-[320px] group mb-2">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-600 to-orange-400 rounded-2xl opacity-40 blur transition duration-200 group-focus-within:opacity-80"></div>
              <div className="relative flex items-center bg-[#0a0a0a] rounded-xl px-4 py-5 border border-yellow-500/30 group-focus-within:border-yellow-500 transition-colors">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={handleInputChange}
                  placeholder="0"
                  autoFocus
                  className="w-full bg-transparent text-5xl font-black text-white outline-none placeholder-neutral-800 text-right pr-3 tracking-wider"
                />
                <span className="text-xl font-bold text-yellow-500 pt-2 w-16">SATS</span>
              </div>
            </div>

            <div className="w-full max-w-[320px] text-right mb-6 pr-2">
              <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                {t('create_max_hint')}
              </span>
            </div>

            {errorMsg && (
              <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-200 text-xs font-bold animate-in fade-in">
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={!amount || Number(amount) === 0 || loading}
              className="w-full max-w-[320px] py-4 text-lg font-black italic tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(234,179,8,0.3)] hover:shadow-[0_0_30px_rgba(234,179,8,0.6)] transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              {loading ? (
                <><Loader2 className="animate-spin" size={24}/> {t('arena_creating')}</>
              ) : (
                <> <Users size={20} className="mr-1"/> {t('arena_create_btn')} <ArrowRight size={20} /> </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </Background>
  );
};

export default CreateArenaView;
