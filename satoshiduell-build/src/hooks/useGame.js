// hooks/useGame.js

import { useState, useEffect, useRef } from 'react';
import { generateGameData, calculateScore } from '../utils/game';
import { playSound, TickSound } from '../utils/sound';
import { APP_CONFIG } from '../constants/config';

/**
 * Custom Hook für Game/Quiz Logik
 * @param {Array} questions - Array von Fragen aus der Datenbank
 * @param {boolean} isMuted - Sound aktiviert/deaktiviert
 * @param {string} language - Sprache des Spielers ('de', 'en', 'es')
 */
export const useGame = (questions, isMuted = false, language = 'de') => {
  const [gameData, setGameData] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(APP_CONFIG.maxQuizTime);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isGameActive, setIsGameActive] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);

  const tickSoundRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize tick sound
  useEffect(() => {
    tickSoundRef.current = new TickSound();
    return () => {
      if (tickSoundRef.current) {
        tickSoundRef.current.stop();
      }
    };
  }, []);

  // Timer Logic
  useEffect(() => {
    if (!isGameActive || selectedAnswer !== null) {
      if (tickSoundRef.current) {
        tickSoundRef.current.stop();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      return;
    }

    // Start tick sound
    if (tickSoundRef.current) {
      tickSoundRef.current.start(isMuted);
    }

    // Start timer
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 0.1;
        
        if (newTime <= 0) {
          handleTimeout();
          return 0;
        }
        
        return newTime;
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (tickSoundRef.current) {
        tickSoundRef.current.stop();
      }
    };
  }, [isGameActive, selectedAnswer, currentQuestion, isMuted]);

  /**
   * Startet ein neues Spiel
   */
  const startGame = () => {
    const newGameData = generateGameData(questions, APP_CONFIG.questionsPerGame, language);
    setGameData(newGameData);
    setCurrentQuestion(0);
    setScore(0);
    setTotalTime(0);
    setTimeLeft(APP_CONFIG.maxQuizTime);
    setSelectedAnswer(null);
    setIsGameActive(true);
    setIsGameFinished(false);
  };

  /**
   * Behandelt Antwort-Auswahl
   */
  const handleAnswerSelect = (answerIndex) => {
    if (selectedAnswer !== null || !isGameActive) return;

    const timeTaken = APP_CONFIG.maxQuizTime - timeLeft;
    setTotalTime(prev => prev + timeTaken);

    const currentQ = gameData[currentQuestion];
    const question = questions[currentQ.id];
    const actualAnswerIndex = currentQ.order[answerIndex];
    const isCorrect = actualAnswerIndex === question.correct;

    setSelectedAnswer({ index: answerIndex, isCorrect });

    if (isCorrect) {
      setScore(prev => prev + 1);
      playSound('correct', isMuted);
    } else {
      playSound('wrong', isMuted);
    }

    // Stop tick sound
    if (tickSoundRef.current) {
      tickSoundRef.current.stop();
    }

    // Auto-advance nach 1.5 Sekunden
    setTimeout(() => {
      if (currentQuestion < gameData.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setTimeLeft(APP_CONFIG.maxQuizTime);
        setSelectedAnswer(null);
      } else {
        finishGame();
      }
    }, 1500);
  };

  /**
   * Behandelt Timeout
   */
  const handleTimeout = () => {
    setTotalTime(prev => prev + APP_CONFIG.maxQuizTime);
    setSelectedAnswer({ index: null, isCorrect: false });
    playSound('wrong', isMuted);

    if (tickSoundRef.current) {
      tickSoundRef.current.stop();
    }

    setTimeout(() => {
      if (currentQuestion < gameData.length - 1) {
        setCurrentQuestion(prev => prev + 1);
        setTimeLeft(APP_CONFIG.maxQuizTime);
        setSelectedAnswer(null);
      } else {
        finishGame();
      }
    }, 1500);
  };

  /**
   * Beendet das Spiel
   */
  const finishGame = () => {
    setIsGameActive(false);
    setIsGameFinished(true);

    if (tickSoundRef.current) {
      tickSoundRef.current.stop();
    }
  };

  /**
   * Gibt die aktuelle Frage zurück
   */
  const getCurrentQuestion = () => {
    if (!gameData[currentQuestion] || !questions) return null;
    
    const gameQ = gameData[currentQuestion];
    const question = questions[gameQ.id];
    
    return {
      ...question,
      shuffledOptions: gameQ.order.map(i => question.options?.[i] || ''),
      correctIndex: gameQ.order.indexOf(question.correct),
    };
  };

  /**
   * Berechnet den finalen Score
   */
  const getFinalScore = () => {
    return calculateScore(score, totalTime);
  };

  return {
    // State
    gameData,
    currentQuestion,
    score,
    totalTime,
    timeLeft,
    selectedAnswer,
    isGameActive,
    isGameFinished,
    
    // Methods
    startGame,
    handleAnswerSelect,
    getCurrentQuestion,
    getFinalScore,
    
    // Computed
    progress: gameData.length > 0 ? ((currentQuestion + 1) / gameData.length) * 100 : 0,
  };
};
