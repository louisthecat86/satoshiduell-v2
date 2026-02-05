import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { ArrowRight, X, Swords, Loader2, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
// WICHTIG: Hier importieren wir die Logik
import { createDuelEntry, fetchQuestionIds } from '../services/supabase';

const CreateDuelView = ({ onCancel, onConfirm, targetPlayer }) => {
  const { t } = useTranslation();
  const { user } = useAuth(); // User für den Erstellernamen holen

  const [amount, setAmount] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleInputChange = (e) => {
    let val = e.target.value.replace(/\D/g, ''); 
    if (val.length > 1 && val.startsWith('0')) val = val.substring(1);
    if (Number(val) > 9999) val = '9999';
    setAmount(val);
  };

  // --- DIE NEUE LOGIK ---
  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) === 0 || loading) return;
    
    setLoading(true);
    setErrorMsg(null);

    try {
        console.log("🎲 Hole neue Fragen aus DB...");
        
        // 1. Fragen laden (sicher, ohne Rekursion)
        const { data: questionIds, error: questionError } = await fetchQuestionIds(5);

        if (questionError || !questionIds || questionIds.length === 0) {
            throw new Error("Fehler: Keine Fragen geladen.");
        }

        console.log("⚔️ Erstelle Duell...");

        // Sicherheitscheck für Username
        const creatorName = user?.username || user?.name || "Unbekannt";

        // 2. Duell in DB schreiben
        const { data, error } = await createDuelEntry(
            creatorName, 
            parseInt(amount), 
            targetPlayer || null, 
            questionIds
        );

        if (error) throw error;

        // 3. ERFOLG: Wir rufen onConfirm mit der ID auf
        // Die App.jsx wechselt dann zur Invoice-Ansicht
        if (onConfirm) {
            onConfirm(data.id); 
        }

    } catch (err) {
        console.error("Fehler beim Erstellen:", err);
        setErrorMsg("Fehler beim Erstellen des Spiels.");
    } finally {
        setLoading(false);
    }
  };

  const formatName = (name) => {
    if (!name) return '';
    if (name.length > 16) return `${name.substring(0, 6)}...${name.slice(-4)}`;
    return name;
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        
        {/* Close Button */}
        <div className="absolute top-6 left-4 z-50">
          <button onClick={onCancel} className="p-2 text-neutral-500 hover:text-white transition-colors bg-black/20 rounded-full backdrop-blur-sm">
            <X size={24} />
          </button>
        </div>

        {/* ZENTRALER INHALT */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 w-full">
          
          <form onSubmit={handleConfirm} className="w-full flex flex-col items-center">
            
            {/* Titel */}
            <h2 className="text-4xl font-black text-white italic uppercase text-center mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] leading-tight">
              {targetPlayer ? 'CHALLENGE' : t('create_title')}
            </h2>

            {/* Anzeige des Gegners, falls vorhanden */}
            {targetPlayer && (
              <div className="mb-8 flex flex-col items-center animate-in fade-in zoom-in duration-300">
                  <div className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest mb-2">GEGEN</div>
                  <div className="flex items-center gap-3 bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
                      <div className="w-10 h-10 rounded-md bg-neutral-800 overflow-hidden border border-white/20">
                          <img 
                             src={getCryptoPunkAvatar(targetPlayer)} 
                             alt={targetPlayer} 
                             className="w-full h-full object-cover" 
                          />
                      </div>
                      <span className="text-white font-black text-lg uppercase tracking-wider">
                          {formatName(targetPlayer)}
                      </span>
                  </div>
              </div>
            )}
            
            {/* Input Feld Container */}
            <div className="relative w-full max-w-[320px] group mb-2">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-600 to-orange-400 rounded-2xl opacity-40 blur transition duration-200 group-focus-within:opacity-80"></div>
              
              <div className="relative flex items-center bg-[#0a0a0a] rounded-xl px-4 py-5 border border-orange-500/30 group-focus-within:border-orange-500 transition-colors">
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
                <span className="text-xl font-bold text-orange-500 pt-2 w-16">SATS</span>
              </div>
            </div>

            {/* Hinweis Text */}
            <div className="w-full max-w-[320px] text-right mb-6 pr-2">
              <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                {t('create_max_hint')}
              </span>
            </div>

            {/* Fehler Anzeige (NEU) */}
            {errorMsg && (
                <div className="mb-6 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-2 text-red-200 text-xs font-bold animate-in fade-in">
                    <AlertTriangle size={16} /> {errorMsg}
                </div>
            )}

            {/* Button */}
            <Button 
              type="submit"
              variant="primary" 
              disabled={!amount || Number(amount) === 0 || loading}
              className="w-full max-w-[320px] py-4 text-lg font-black italic tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-all transform active:scale-95 disabled:opacity-50 disabled:scale-100"
            >
              {loading ? (
                 <><Loader2 className="animate-spin" size={24}/> LADE...</>
              ) : targetPlayer ? (
                 <> <Swords size={20} className="mr-1"/> HERAUSFORDERN </> 
              ) : (
                 <> {t('btn_start')} <ArrowRight size={20} /> </>
              )}
            </Button>

          </form>

        </div>
      </div>
    </Background>
  );
};

export default CreateDuelView;