// components/game/QuizQuestion.jsx

import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatTime } from '../../utils/formatters';

/**
 * Quiz-Fragen Komponente
 * Zeigt eine einzelne Frage mit Antwort-Optionen
 */
const QuizQuestion = ({
  question,
  questionNumber,
  totalQuestions,
  timeLeft,
  selectedAnswer,
  correctIndex,
  onAnswerSelect,
  language = 'de',
}) => {
  if (!question) return null;

  const { q, options } = question[language] || question.de;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
          Frage {questionNumber} / {totalQuestions}
        </div>
        <div className="flex items-center gap-2 text-orange-500 font-mono">
          <Clock size={16} />
          <span className="font-bold">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-black/40 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all duration-100"
          style={{ width: `${(timeLeft / 15) * 100}%` }}
        />
      </div>

      {/* Frage */}
      <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-6 backdrop-blur-sm">
        <h2 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
          {q}
        </h2>
      </div>

      {/* Antwort-Optionen */}
      <div className="grid grid-cols-1 gap-3">
        {options?.map((option, index) => {
          const isSelected = selectedAnswer?.index === index;
          const isCorrect = index === correctIndex;
          const showResult = selectedAnswer !== null;

          let bgClass = 'bg-black/40 hover:bg-white/10 border-white/10';
          let iconClass = null;

          if (showResult) {
            if (isSelected && isCorrect) {
              bgClass = 'bg-green-500/20 border-green-500';
              iconClass = <CheckCircle className="text-green-500" size={24} />;
            } else if (isSelected && !isCorrect) {
              bgClass = 'bg-red-500/20 border-red-500';
              iconClass = <XCircle className="text-red-500" size={24} />;
            } else if (isCorrect) {
              bgClass = 'bg-green-500/10 border-green-500/50';
              iconClass = <CheckCircle className="text-green-500/50" size={24} />;
            }
          }

          return (
            <button
              key={index}
              onClick={() => !showResult && onAnswerSelect(index)}
              disabled={showResult}
              className={`
                w-full p-4 rounded-xl border-2 transition-all duration-300
                ${bgClass}
                ${!showResult ? 'cursor-pointer active:scale-95' : 'cursor-default'}
                backdrop-blur-sm
                flex items-center justify-between gap-4
              `}
            >
              <span className="text-left text-white font-medium flex-1">
                {option}
              </span>
              {iconClass && (
                <div className="flex-shrink-0">
                  {iconClass}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuizQuestion;
