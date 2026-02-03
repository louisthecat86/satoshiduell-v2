import React, { useState, useEffect, useRef } from 'react';
import Background from '../components/ui/Background';
import { Timer } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { playSound, TickSound } from '../utils/sound';

const GameView = ({ gameData, onGameEnd }) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);
  
  // Timer State
  const [startTime] = useState(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const [hasSubmitted, setHasSubmitted] = useState(false);

  // --- TÜRSTEHER: Habe ich schon gespielt? ---
  useEffect(() => {
    const isCreator = user.name === gameData.creator;
    const myScoreInDB = isCreator ? gameData.creator_score : gameData.challenger_score;

    if (myScoreInDB !== null && myScoreInDB !== undefined) {
      // Wenn schon gespielt, sofort raus hier
      onGameEnd({ score: myScoreInDB, totalTime: 0 }); 
    }
  }, []);

  // --- TIMER LOGIK ---
  useEffect(() => {
    // Aktualisiert die Anzeige alle 100ms
    timerRef.current = setInterval(() => {
      if (!hasSubmitted) {
        setElapsed(Date.now() - startTime);
      }
    }, 100);

    return () => clearInterval(timerRef.current);
  }, [startTime, hasSubmitted]);

  // --- SOUND: Tick Sound Management ---
  const tickRef = useRef(null);
  useEffect(() => {
    if (!tickRef.current) tickRef.current = new TickSound();
    // stop tick on unmount
    return () => tickRef.current && tickRef.current.stop();
  }, []);


  const question = gameData.questions[currentQuestionIndex];
  const totalQuestions = gameData.questions.length;

  const handleAnswerClick = (index) => {
    if (selectedAnswer !== null || hasSubmitted) return; 

    const muted = localStorage.getItem('satoshi_sound') === 'false';
    // Click sound
    playSound('click', muted);

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
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    onGameEnd({ score: finalScore, totalTime });
  };

  // Anti-Cheat Blank Screen
  const isCreator = user.name === gameData.creator;
  if ((isCreator ? gameData.creator_score : gameData.challenger_score) !== null) {
      return <div className="h-screen bg-black" />;
  }

  // Formatierung der Zeit (z.B. 12.5 s)
  const formattedTime = (elapsed / 1000).toFixed(1);

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
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10 shadow-lg">
            <Timer className={`w-5 h-5 ${parseFloat(formattedTime) > 10 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`} />
            <span className="text-xl font-bold text-white font-mono min-w-[60px] text-right">
              {formattedTime} <span className="text-sm text-neutral-500">s</span>
            </span>
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