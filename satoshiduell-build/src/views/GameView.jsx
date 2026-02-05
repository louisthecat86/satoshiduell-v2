import React, { useState, useEffect, useRef } from 'react';
import Background from '../components/ui/Background';
import { Timer } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { playSound, TickSound } from '../utils/sound';

const GameView = ({ gameData, onGameEnd }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userName = user?.username || user?.name || '';

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  
  // Timer State (countdown)
  const [timeLeft, setTimeLeft] = useState(15);
  const [totalTimeUsed, setTotalTimeUsed] = useState(0);
  const totalTimeUsedRef = useRef(0);
  const timerRef = useRef(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);

  // --- TÜRSTEHER: Habe ich schon gespielt? ---
  useEffect(() => {
    if (gameData.mode === 'arena') {
      const scores = gameData.participant_scores || {};
      const myScoreInDB = scores[userName?.toLowerCase()] ?? scores[userName];
      if (myScoreInDB !== null && myScoreInDB !== undefined) {
        setAlreadyPlayed(true);
        onGameEnd({ score: myScoreInDB, totalTime: 0 });
      }
      return;
    }

    if (gameData.mode === 'tournament') {
      const scores = gameData.participant_scores || {};
      const times = gameData.participant_times || {};
      const key = userName?.toLowerCase();
      const myScoreInDB = scores[key] ?? scores[userName];
      if (myScoreInDB !== null && myScoreInDB !== undefined) {
        setAlreadyPlayed(true);
        const myTime = times[key] ?? times[userName] ?? 0;
        onGameEnd({ score: myScoreInDB, totalTime: myTime });
      }
      return;
    }

    const isCreator = userName === gameData.creator;
    const myScoreInDB = isCreator ? gameData.creator_score : gameData.challenger_score;

    if (myScoreInDB !== null && myScoreInDB !== undefined) {
      setAlreadyPlayed(true);
      onGameEnd({ score: myScoreInDB, totalTime: 0 }); 
    }
  }, []);

  // --- TIMER LOGIK (COUNTDOWN) ---
  useEffect(() => {
    timerRef.current = setInterval(() => {
      if (!hasSubmitted && selectedAnswer === null) {
        setTimeLeft(prev => {
          const next = Math.max(0, prev - 0.1);
          if (next <= 0) {
            handleAnswerClick(-1, true);
          }
          return next;
        });
      }
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [hasSubmitted, selectedAnswer, currentQuestionIndex]);

  // --- SOUND: Tick Sound Management ---
  const tickRef = useRef(null);
  useEffect(() => {
    if (!tickRef.current) tickRef.current = new TickSound();
    // stop tick on unmount
    return () => tickRef.current && tickRef.current.stop();
  }, []);


  useEffect(() => {
    const raw = Array.isArray(gameData?.questions) ? gameData.questions : [];
    const next = raw.map((q) => {
      if (!q || !Array.isArray(q.a)) return q;
      const indices = q.a.map((_, idx) => idx);
      for (let i = indices.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      const answers = indices.map(idx => q.a[idx]);
      const correctIndex = indices.indexOf(q.c);
      return { ...q, a: answers, c: correctIndex };
    });
    setShuffledQuestions(next);
  }, [gameData?.questions]);

  const question = shuffledQuestions[currentQuestionIndex];
  const totalQuestions = shuffledQuestions.length;
  const hasValidQuestion = question && Array.isArray(question.a);

  useEffect(() => {
    setTimeLeft(15);
  }, [currentQuestionIndex]);

  const handleAnswerClick = (index, isTimeout = false) => {
    if (!hasValidQuestion) return;
    if (selectedAnswer !== null || hasSubmitted) return; 

    const muted = localStorage.getItem('satoshi_sound') === 'false';
    if (!isTimeout) {
      // Click sound
      playSound('click', muted);
    }

    setSelectedAnswer(index);

    const isCorrect = index === question.c;
    if (isCorrect) {
      setScore((prev) => prev + 1);
      // Play correct sound
      playSound('correct', muted);
    } else {
      // Play wrong sound
      playSound('wrong', muted);
    }

    // Accumulate time used for this question (15s - timeLeft)
    const used = Math.min(15, Math.max(0, 15 - timeLeft));
    const usedMs = used * 1000;
    setTotalTimeUsed(prev => {
      const next = prev + usedMs;
      totalTimeUsedRef.current = next;
      return next;
    });

    // Stop tick on answer
    tickRef.current && tickRef.current.stop();

    // Kurze Pause vor der nächsten Frage
    setTimeout(() => {
      if (currentQuestionIndex < totalQuestions - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
        setSelectedAnswer(null);
        // Start tick again for next question (if not muted)
        const mutedAfter = localStorage.getItem('satoshi_sound') === 'false';
        tickRef.current && tickRef.current.start(mutedAfter);
      } else {
        finishGame(isCorrect ? score + 1 : score);
      }
    }, 1000);
  };

  const finishGame = (finalScore) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);
    clearInterval(timerRef.current);
    
    onGameEnd({ score: finalScore, totalTime: totalTimeUsedRef.current });
  };

  // Anti-Cheat Blank Screen
    if (alreadyPlayed) {
      return (
        <Background>
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="text-neutral-400 text-sm font-bold uppercase tracking-widest">
              Ergebnis wird geladen...
            </div>
          </div>
        </Background>
      );
    }

  // Formatierung der Zeit (Countdown)
  const formattedTime = timeLeft.toFixed(1);

  // Start/stop tick when question becomes active
  useEffect(() => {
    // If not answered yet, start tick
    const muted = localStorage.getItem('satoshi_sound') === 'false';
    if (selectedAnswer === null && !hasSubmitted) {
      tickRef.current && tickRef.current.start(muted);
    } else {
      tickRef.current && tickRef.current.stop();
    }

    // stop on unmount or game end
    return () => tickRef.current && tickRef.current.stop();
  }, [currentQuestionIndex, selectedAnswer, hasSubmitted]);

  if (!hasValidQuestion) {
    return (
      <Background>
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <div className="text-lg font-bold text-red-300 mb-2">
            {t('game_questions_error')}
          </div>
          <div className="text-xs text-neutral-400">
            {t('game_questions_error_hint')}
          </div>
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto p-6">
        
        {/* Header: Progress & Live Timer */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-neutral-500 font-bold tracking-widest">
              {t('game_question')}
            </span>
            <span className="text-2xl font-black text-white italic">
              {currentQuestionIndex + 1} <span className="text-neutral-600 text-lg">/ {totalQuestions}</span>
            </span>
          </div>
          
          {/* DER VISUELLE TIMER */}
          <div className="flex flex-col gap-2 min-w-[160px]">
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 shadow-lg">
              <Timer className={`w-5 h-5 ${parseFloat(formattedTime) < 5 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`} />
              <span className="text-xl font-bold text-white font-mono min-w-[60px] text-right">
                {formattedTime} <span className="text-sm text-neutral-500">s</span>
              </span>
            </div>
            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden border border-white/10">
              <div
                className={`h-full transition-[width] duration-100 ${parseFloat(formattedTime) < 5 ? 'bg-red-500' : 'bg-orange-500'}`}
                style={{ width: `${Math.max(0, (timeLeft / 15) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question Card */}
        <div className="flex-grow flex flex-col justify-center mb-8 animate-in slide-in-from-bottom-4 duration-500">
           <h2 className="text-2xl font-bold text-white text-center leading-tight drop-shadow-lg mb-8 min-h-[80px] flex items-center justify-center">
             {question.q}
           </h2>

           <div className="grid grid-cols-1 gap-3">
             {question.a.map((answer, index) => {
               let btnClass = "bg-[#161616] border-white/5 hover:bg-[#222]";
               
               if (selectedAnswer !== null) {
                 if (index === question.c) btnClass = "bg-green-500 text-black border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] scale-[1.02]";
                 else if (index === selectedAnswer) btnClass = "bg-red-500 text-white border-red-500 opacity-80";
                 else btnClass = "bg-[#161616] border-white/5 opacity-30 blur-[1px]"; // Fokus auf die gewählte Antwort
               }

               return (
                 <button
                   key={index}
                   onClick={() => handleAnswerClick(index)}
                   disabled={selectedAnswer !== null}
                   className={`p-4 rounded-xl border text-left font-bold transition-all duration-200 ${btnClass} ${selectedAnswer === null ? 'active:scale-95' : ''}`}
                 >
                   <span className="mr-2 text-neutral-400 font-black">{String.fromCharCode(65 + index)}.</span>
                   {answer}
                 </button>
               );
             })}
           </div>
        </div>

      </div>
    </Background>
  );
};

export default GameView;