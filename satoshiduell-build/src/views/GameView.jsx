// views/GameView.jsx

import React, { useEffect } from 'react';
import { useGame } from '../hooks/useGame';
import { useDuels } from '../hooks/useDuels';
import QuizQuestion from '../components/game/QuizQuestion';
import Background from '../components/Background';
import Button from '../components/Button';
import { Loader2, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';

/**
 * Game View - Quiz Gameplay Screen
 * 
 * Diese View verwaltet:
 * - Quiz Gameplay
 * - Timer
 * - Score Tracking
 * - Speichern des Ergebnisses
 */
const GameView = ({
  questions,
  duelData, // { role: 'creator' | 'challenger', duelId?: number }
  onGameFinish,
  onCancel,
  isMuted = false,
  language = 'de',
}) => {
  const {
    currentQuestion,
    score,
    timeLeft,
    totalTime,
    selectedAnswer,
    isGameActive,
    isGameFinished,
    startGame,
    handleAnswerSelect,
    getCurrentQuestion,
    getFinalScore,
    progress,
  } = useGame(questions, isMuted);

  const { finishDuelAsChallenger, createNewDuel } = useDuels();

  // Start game on mount
  useEffect(() => {
    startGame();
  }, []);

  // Handle game finish
  useEffect(() => {
    if (isGameFinished) {
      handleGameComplete();
    }
  }, [isGameFinished]);

  /**
   * Speichert das Spiel-Ergebnis
   */
  const handleGameComplete = async () => {
    const finalScore = getFinalScore();

    try {
      if (duelData.role === 'challenger') {
        // Speichere als Challenger
        await finishDuelAsChallenger(
          duelData.duelId,
          score,
          totalTime
        );
      } else if (duelData.role === 'creator') {
        // Speichere als Creator
        await createNewDuel({
          creator_score: score,
          creator_time: totalTime,
          amount: duelData.amount,
          target_player: duelData.targetPlayer,
          questions: duelData.gameData,
        });
      }

      // Konfetti bei gutem Score
      if (score >= 4) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }

      // Navigation
      if (onGameFinish) {
        onGameFinish({
          score,
          totalTime,
          finalScore,
        });
      }
    } catch (error) {
      console.error('Error saving game:', error);
      alert('Fehler beim Speichern des Spiels: ' + error.message);
    }
  };

  const currentQ = getCurrentQuestion();

  if (!currentQ) {
    return (
      <Background>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="animate-spin text-orange-500" size={48} />
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {/* Header */}
        <div className="w-full max-w-2xl mb-6">
          <div className="flex justify-between items-center">
            <Button
              variant="ghost"
              onClick={onCancel}
              className="text-neutral-500 hover:text-white"
            >
              <ArrowLeft size={20} />
              Abbrechen
            </Button>

            <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
              Score: {score} / 5
            </div>
          </div>
        </div>

        {/* Quiz Question */}
        <QuizQuestion
          question={currentQ}
          questionNumber={currentQuestion + 1}
          totalQuestions={5}
          timeLeft={timeLeft}
          selectedAnswer={selectedAnswer}
          correctIndex={currentQ.correctIndex}
          onAnswerSelect={handleAnswerSelect}
          language={language}
        />

        {/* Progress Indicator */}
        <div className="w-full max-w-2xl mt-8">
          <div className="flex gap-2 justify-center">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`h-2 w-12 rounded-full transition-all ${
                  i < currentQuestion
                    ? 'bg-green-500'
                    : i === currentQuestion
                    ? 'bg-orange-500'
                    : 'bg-white/20'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Loading Overlay when finishing */}
        {isGameFinished && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center">
              <Loader2 className="animate-spin text-orange-500 mx-auto mb-4" size={48} />
              <p className="text-white font-bold text-xl">
                Speichere Ergebnis...
              </p>
            </div>
          </div>
        )}
      </div>
    </Background>
  );
};

export default GameView;
