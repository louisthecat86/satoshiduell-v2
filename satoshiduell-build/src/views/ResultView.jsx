import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { Trophy, Frown, Loader2, Home, Clock, Target, Zap, CheckCircle2, RefreshCw, RefreshCcw, Wallet, Copy } from 'lucide-react'; 
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { getGameStatus, markGameAsClaimed } from '../services/supabase';
import { createWithdrawLink, getWithdrawLinkStatus } from '../services/lnbits';
import confetti from 'canvas-confetti';
import { QRCodeCanvas } from 'qrcode.react'; // WICHTIG: Importieren!

const ResultView = ({ gameData, onHome }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [status, setStatus] = useState('waiting_for_opponent'); 
  const [withdrawData, setWithdrawData] = useState(null); 
  const [isClaimed, setIsClaimed] = useState(gameData.is_claimed || gameData.claimed || false); 
  const [finalGameData, setFinalGameData] = useState(gameData);
  const [isChecking, setIsChecking] = useState(false);

  const isCreator = user.name === gameData.creator;
  
  const myData = {
    name: isCreator ? gameData.creator : gameData.challenger,
    score: isCreator ? finalGameData.creator_score : finalGameData.challenger_score,
    time: isCreator ? finalGameData.creator_time : finalGameData.challenger_time,
  };

  const opData = {
    name: isCreator ? (gameData.challenger || "Gegner") : gameData.creator,
    score: isCreator ? finalGameData.challenger_score : finalGameData.creator_score,
    time: isCreator ? finalGameData.challenger_time : finalGameData.creator_time,
  };

  // --- 0. INITIAL CHECK (REFUND) ---
  useEffect(() => {
     if (gameData.withdraw_id) {
         setWithdrawData({ lnurl: gameData.withdraw_link, id: gameData.withdraw_id });
         setStatus('refund');
     } 
     else if (gameData.status === 'refunded' && gameData.withdraw_link) {
         setWithdrawData({ lnurl: gameData.withdraw_link, id: null });
         setStatus('refund');
     }
  }, [gameData]);

  // --- 1. ZENTRALE ERFOLGS-FUNKTION ---
  const handleSuccess = async () => {
     if (isClaimed) return; 
     
     console.log("🎉 SUCCESS: Auszahlung bestätigt. Schließe Fenster...");
     setIsClaimed(true);

     if (status !== 'refund') {
        try { confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } }); } catch(e){}
     }

     await markGameAsClaimed(gameData.id); 

     setTimeout(() => {
         console.log("🏠 Navigiere zum Dashboard...");
         onHome();
     }, 2000);
  };

  // --- 2. MANUELLER CHECK ---
  const checkWithdrawStatus = async () => {
    if (!withdrawData?.id || isClaimed) return;
    setIsChecking(true);
    const claimed = await getWithdrawLinkStatus(withdrawData.id);
    setIsChecking(false);
    if (claimed) await handleSuccess(); 
  };

  // --- 3. AUTO POLLING (LNBITS) ---
  useEffect(() => {
    let interval;
    if (withdrawData?.id && !isClaimed) {
      interval = setInterval(async () => {
          const claimed = await getWithdrawLinkStatus(withdrawData.id);
          if (claimed) {
              clearInterval(interval); 
              await handleSuccess();
          }
      }, 2000); 
    }
    return () => clearInterval(interval);
  }, [withdrawData, isClaimed]);

  // --- 4. STATUS LADEN ---
  useEffect(() => {
    if (status === 'refund') return;

    const interval = setInterval(async () => {
      if (status === 'waiting_for_opponent' || finalGameData.status !== 'finished') {
          const { data } = await getGameStatus(gameData.id);
          if (data) {
            setFinalGameData(data);
            
            if (data.status === 'refunded') {
                setWithdrawData({ lnurl: data.withdraw_link, id: data.id });
                setStatus('refund');
                return;
            }

            if (data.creator_score !== null && data.challenger_score !== null) {
              evaluateResult(data);
            }
          }
      }
    }, 2000); 
    return () => clearInterval(interval);
  }, [status]);


  const evaluateResult = async (data) => {
    const myScore = isCreator ? data.creator_score : data.challenger_score;
    const opScore = isCreator ? data.challenger_score : data.creator_score;
    const myTime = isCreator ? data.creator_time : data.challenger_time;
    const opTime = isCreator ? data.challenger_time : data.creator_time;

    let result = 'draw';
    if (myScore > opScore) result = 'win';
    else if (opScore > myScore) result = 'lose';
    else {
      if (myTime < opTime) result = 'win';
      else if (opTime < myTime) result = 'lose';
      else result = 'draw';
    }

    setStatus(result);

    if (result === 'win') {
      if (data.is_claimed || data.claimed) {
          setIsClaimed(true);
      } else {
          if (!withdrawData) {
              const winAmount = data.amount * 2; 
              const dataLink = await createWithdrawLink(winAmount, data.id);
              if (dataLink && dataLink.lnurl && dataLink.id) {
                setWithdrawData(dataLink);
              }
          }
      }
    }
  };

  const PlayerStatCard = ({ name, score, time, isMe, winStatus }) => {
    let borderColor = "border-white/10";
    if (status !== 'waiting_for_opponent') {
       if (winStatus === 'win' && isMe) borderColor = "border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]";
       if (winStatus === 'lose' && isMe) borderColor = "border-red-500/50";
       if (winStatus === 'win' && !isMe) borderColor = "border-green-500/50";
    }

    return (
      <div className={`flex flex-col items-center bg-[#161616] border ${borderColor} rounded-2xl p-4 transition-all w-full`}>
        <div className="w-12 h-12 rounded-full bg-neutral-800 border border-white/10 overflow-hidden mb-2 shadow-inner">
           <img src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${name}`} alt={name} className="w-full h-full object-cover" />
        </div>
        <span className={`text-xs font-black uppercase tracking-wider mb-3 ${isMe ? 'text-white' : 'text-neutral-400'}`}>
          {name} {isMe && <span className="text-orange-500">{t('result_you_marker')}</span>}
        </span>
        <div className="grid grid-cols-2 gap-2 w-full">
            <div className="flex flex-col items-center bg-black/30 rounded-lg p-2">
                <Target size={14} className="text-orange-500 mb-1" />
                <span className="text-lg font-black text-white leading-none">{score !== null ? score : '-'}</span>
            </div>
            <div className="flex flex-col items-center bg-black/30 rounded-lg p-2">
                <Clock size={14} className="text-blue-500 mb-1" />
                <span className="text-lg font-black text-white leading-none">{time !== null ? (time / 1000).toFixed(1) : '-'} <span className="text-[8px] text-neutral-500">s</span></span>
            </div>
        </div>
      </div>
    );
  };

  // =========================================================
  // ANSICHT 1: REFUND (Rückerstattung - ROTES DESIGN)
  // =========================================================
  if (status === 'refund') {
    return (
        <Background>
          <div className="w-full max-w-md mx-auto relative p-6 flex flex-col items-center justify-center min-h-[80vh]">
              
              {/* Header */}
              <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500 mb-6 animate-pulse">
                 <RefreshCcw size={48} className="text-red-500"/>
              </div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Rückerstattung</h2>
              <p className="text-neutral-400 text-sm text-center mb-8 px-4">
                  Dein Gegner ist nicht rechtzeitig erschienen. Hier sind deine Sats zurück.
              </p>
              
              {/* QR Code Bereich */}
              {!isClaimed ? (
                  <>
                     <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(239,68,68,0.2)] mb-6 relative group">
                          {withdrawData?.lnurl ? (
                            <div className="flex flex-col gap-4">
                               <div className="flex justify-center">
                                  <QRCodeCanvas value={`lightning:${withdrawData.lnurl}`} size={200} />
                               </div>
                               
                               {/* Copy Button */}
                               <button 
                                  onClick={() => {navigator.clipboard.writeText(withdrawData.lnurl); alert(t('nostr_copied'));}}
                                  className="absolute top-4 right-4 bg-black/5 hover:bg-black/10 p-2 rounded-lg transition-colors"
                               >
                                  <Copy size={16} className="text-black/50" />
                               </button>
                            </div>
                          ) : (
                            <div className="w-48 h-48 flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400 w-10 h-10" /></div>
                          )}
                     </div>
                     
                     {/* ACTIONS */}
                     <div className="w-full flex flex-col gap-3 px-4">
                        {withdrawData?.lnurl && (
                             <a 
                                href={`lightning:${withdrawData.lnurl}`}
                                className="w-full bg-gradient-to-r from-red-500 to-orange-500 hover:scale-[1.02] transition-transform py-4 rounded-xl flex items-center justify-center gap-2 text-white font-black uppercase text-sm shadow-lg"
                             >
                                <Wallet size={20}/> {t('btn_wallet')}
                             </a>
                        )}

                        <button onClick={checkWithdrawStatus} disabled={isChecking} className="w-full text-xs bg-white/10 hover:bg-white/20 px-3 py-3 rounded-xl text-neutral-300 flex items-center justify-center gap-2 transition-colors">
                            <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
                            {isChecking ? t('checking') : t('check_status')}
                        </button>
                     </div>
                  </>
              ) : (
                // Erfolg Screen beim Refund
                <div className="bg-green-500/10 border border-green-500/50 rounded-2xl p-8 w-full flex flex-col items-center animate-in zoom-in duration-500">
                   <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                      <CheckCircle2 size={40} className="text-black" />
                   </div>
                   <h3 className="text-2xl font-black uppercase text-white mb-2 italic">Erstattet!</h3>
                   <p className="text-green-200 text-sm text-center font-bold">Deine Sats sind zurück.</p>
                </div>
              )}

              <Button onClick={onHome} variant="secondary" className="mt-8 w-full">Zum Dashboard</Button>
          </div>
        </Background>
    );
  }

  // =========================================================
  // ANSICHT 2: NORMALES ERGEBNIS (Win/Lose/Draw)
  // =========================================================
  return (
    <Background>
      <div className="flex flex-col h-[100vh] w-full max-w-md mx-auto relative overflow-y-auto p-4 pb-20 scrollbar-hide">
        
        <div className="flex-1 flex flex-col items-center pt-8">
          
          {/* HEADER STATUS */}
          <div className="mb-8 text-center min-h-[120px] flex flex-col items-center justify-center">
              {status === 'waiting_for_opponent' && (
                <>
                  <Loader2 size={48} className="text-orange-500 animate-spin mb-4" />
                  <h2 className="text-2xl font-black text-white uppercase italic animate-pulse">{t('result_waiting_title')}</h2>
                  <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest">{t('result_waiting_subtitle')}</p>
                </>
              )}
              {status === 'win' && (
                <>
                  <Trophy size={64} className="text-yellow-400 mb-4 drop-shadow-[0_0_25px_rgba(250,204,21,0.5)]" />
                  <h2 className="text-4xl font-black text-white uppercase italic drop-shadow-lg">{t('result_win_title')}</h2>
                  <p className="text-orange-500 font-bold tracking-widest uppercase mt-2 text-sm bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">+{finalGameData.amount * 2} {t('result_win_subtitle')}</p>
                </>
              )}
              {status === 'lose' && (
                <>
                   <Frown size={64} className="text-neutral-600 mb-4" />
                   <h2 className="text-4xl font-black text-neutral-500 uppercase italic">{t('result_lose_title')}</h2>
                   <p className="text-neutral-600 text-xs mt-2 uppercase tracking-widest">{t('result_lose_subtitle')}</p>
                </>
              )}
              {status === 'draw' && (
                <>
                   <div className="text-6xl mb-4">🤝</div>
                   <h2 className="text-4xl font-black text-white uppercase italic">{t('result_draw_title')}</h2>
                   <p className="text-neutral-500 text-xs mt-2 uppercase tracking-widest">{t('result_draw_subtitle')}</p>
                </>
              )}
          </div>

          {/* STATS BOARD */}
          <div className="w-full flex items-center justify-center gap-2 mb-8 relative">
              <div className="flex-1 max-w-[160px]"><PlayerStatCard name={myData.name} score={myData.score} time={myData.time} isMe={true} winStatus={status} /></div>
              <div className="flex flex-col items-center justify-center z-10 -mx-2">
                 <div className="w-8 h-8 rounded-full bg-[#222] border-2 border-[#333] flex items-center justify-center"><span className="text-[8px] font-black text-neutral-500">VS</span></div>
              </div>
              <div className="flex-1 max-w-[160px]"><PlayerStatCard name={opData.name} score={opData.score} time={opData.time} isMe={false} winStatus={status === 'win' ? 'lose' : (status === 'lose' ? 'win' : 'draw')} /></div>
          </div>

          {/* GEWINN BEREICH (MIT WALLET BUTTON) */}
          {status === 'win' && (
            <div className="animate-in slide-in-from-bottom-4 duration-700 w-full mb-8 flex flex-col items-center">
              
              {!isClaimed ? (
                <>
                  <h3 className="font-black uppercase italic text-xl mb-4 text-white drop-shadow-md">{t('result_claim_title')}</h3>
                  <div className="bg-white p-4 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4 relative group">
                    {withdrawData?.lnurl ? (
                      <div className="flex flex-col gap-4">
                         <div className="flex justify-center">
                             <QRCodeCanvas value={`lightning:${withdrawData.lnurl}`} size={200} />
                         </div>
                         {/* Copy Button */}
                         <button 
                              onClick={() => {navigator.clipboard.writeText(withdrawData.lnurl); alert(t('nostr_copied'));}}
                              className="absolute top-4 right-4 bg-black/5 hover:bg-black/10 p-2 rounded-lg transition-colors"
                           >
                              <Copy size={16} className="text-black/50" />
                           </button>
                      </div>
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center"><Loader2 className="animate-spin text-neutral-400 w-10 h-10" /></div>
                    )}
                  </div>
                  
                  {/* ACTIONS */}
                  <div className="flex flex-col items-center gap-3 mt-2 w-full px-8">
                      {withdrawData?.lnurl && (
                          <a 
                             href={`lightning:${withdrawData.lnurl}`}
                             className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:scale-[1.02] transition-transform py-4 rounded-xl flex items-center justify-center gap-2 text-black font-black uppercase text-sm shadow-lg"
                          >
                             <Wallet size={20} className="text-black"/> {t('btn_wallet')}
                          </a>
                      )}

                      <button onClick={checkWithdrawStatus} disabled={isChecking} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg text-neutral-300 flex items-center gap-2 transition-colors">
                         <RefreshCw size={12} className={isChecking ? "animate-spin" : ""} />
                         {isChecking ? t('checking') : t('check_status')}
                      </button>
                  </div>
                </>
              ) : (
                // --- ERFOLG ---
                <div className="bg-green-500/10 border border-green-500/50 rounded-2xl p-8 w-full flex flex-col items-center animate-in zoom-in duration-500">
                   <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.6)]">
                      <CheckCircle2 size={40} className="text-black" />
                   </div>
                   <h3 className="text-2xl font-black uppercase text-white mb-2 italic">{t('withdraw_success_title')}</h3>
                   <p className="text-green-200 text-sm text-center font-bold">{t('withdraw_success_msg')}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- HOME BUTTON --- */}
        <div className="pb-6">
          <Button onClick={onHome} variant="secondary" className="w-full py-4 flex items-center justify-center gap-2 shadow-lg hover:bg-white/10">
            <Home size={20} /> {t('back_home')}
          </Button>
        </div>

      </div>
    </Background>
  );
};

export default ResultView;