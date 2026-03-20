import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Crown } from 'lucide-react';
import { formatTime } from '../utils/formatters';

const ROUND_ORDER = ['round_of_32', 'round_of_16', 'quarter', 'semi', 'final'];
const ROUND_LABELS = {
  round_of_32: 'Runde der 32',
  round_of_16: 'Achtelfinale',
  quarter: 'Viertelfinale',
  semi: 'Halbfinale',
  final: 'Finale',
};

const fmtTime = (ms) => {
  if (ms === null || ms === undefined) return '-';
  return formatTime(Math.max(0, ms) / 1000);
};

const BracketTree = ({ matches, currentUser }) => {
  const [activeRoundIdx, setActiveRoundIdx] = useState(0);

  if (!matches || matches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-neutral-500">Bracket wird generiert sobald alle Plätze besetzt sind.</p>
      </div>
    );
  }

  // Runden sortiert aufbauen
  const roundsMap = {};
  matches.forEach(m => {
    if (!roundsMap[m.round_name]) roundsMap[m.round_name] = [];
    roundsMap[m.round_name].push(m);
  });

  const sortedRounds = Object.keys(roundsMap).sort(
    (a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b)
  );

  // Aktive Runde finden (erste mit ready/active Matches)
  const findActiveRound = () => {
    for (let i = 0; i < sortedRounds.length; i++) {
      const hasActive = roundsMap[sortedRounds[i]].some(m => m.status === 'ready' || m.status === 'active');
      if (hasActive) return i;
    }
    // Alle fertig → letzte Runde zeigen
    return sortedRounds.length - 1;
  };

  // Initial auf aktive Runde setzen
  useState(() => {
    setActiveRoundIdx(findActiveRound());
  });

  const currentRound = sortedRounds[activeRoundIdx];
  const currentMatches = roundsMap[currentRound] || [];
  const me = (currentUser || '').toLowerCase();

  const canGoLeft = activeRoundIdx > 0;
  const canGoRight = activeRoundIdx < sortedRounds.length - 1;

  const PlayerSlot = ({ name, score, timeMs, isWinner, isLoser, isMe }) => {
    const hasResult = score !== null && score !== undefined;

    return (
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
        isWinner ? 'bg-yellow-500/15 border border-yellow-500/30' :
        isLoser ? 'bg-white/3 border border-white/5 opacity-40' :
        isMe ? 'bg-green-500/10 border border-green-500/20' :
        'bg-white/5 border border-white/10'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {isWinner && <Crown size={12} className="text-yellow-400 flex-shrink-0" />}
          <span className={`text-xs font-bold truncate ${
            isWinner ? 'text-yellow-400' :
            isLoser ? 'text-neutral-600' :
            isMe ? 'text-green-300' :
            name ? 'text-white' : 'text-neutral-600'
          }`}>
            {name || 'TBD'}
          </span>
          {isMe && (
            <span className="text-[7px] bg-green-500/30 text-green-400 px-1 py-0.5 rounded font-bold flex-shrink-0">DU</span>
          )}
        </div>
        {hasResult && (
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className={`text-[10px] font-bold ${isWinner ? 'text-yellow-400' : 'text-neutral-400'}`}>
              {score}
            </span>
            {timeMs !== null && timeMs !== undefined && (
              <span className="text-[9px] text-neutral-600">{fmtTime(timeMs)}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const MatchCard = ({ match, matchNumber }) => {
    const isFinished = match.status === 'finished';
    const isActive = match.status === 'ready' || match.status === 'active';
    const isPending = match.status === 'pending';
    const p1IsMe = me && (match.player1 || '').toLowerCase() === me;
    const p2IsMe = me && (match.player2 || '').toLowerCase() === me;
    const isMyMatch = p1IsMe || p2IsMe;

    return (
      <div className={`rounded-xl overflow-hidden ${
        isMyMatch && isActive ? 'ring-2 ring-green-500/50' :
        isActive ? 'ring-1 ring-yellow-500/30' : ''
      }`}>
        {/* Match Header */}
        <div className={`flex items-center justify-between px-3 py-1.5 ${
          isFinished ? 'bg-white/5' :
          isActive ? 'bg-yellow-500/10' :
          'bg-white/3'
        }`}>
          <span className="text-[9px] text-neutral-500 font-bold">Match {matchNumber}</span>
          {isFinished && <span className="text-[9px] text-neutral-600">✓ Beendet</span>}
          {isActive && isMyMatch && <span className="text-[9px] text-green-400 font-bold animate-pulse">⚔️ Dein Match</span>}
          {isActive && !isMyMatch && <span className="text-[9px] text-yellow-400">Läuft</span>}
          {isPending && <span className="text-[9px] text-neutral-600">Wartet</span>}
        </div>

        {/* Players */}
        <div className="p-2 space-y-1.5 bg-[#0d0d0d]">
          <PlayerSlot
            name={match.player1} score={match.player1_score} timeMs={match.player1_time_ms}
            isWinner={isFinished && match.winner === match.player1}
            isLoser={isFinished && match.winner && match.winner !== match.player1}
            isMe={p1IsMe}
          />
          <div className="flex items-center gap-2 px-2">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-[8px] text-neutral-700 font-bold">VS</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          <PlayerSlot
            name={match.player2} score={match.player2_score} timeMs={match.player2_time_ms}
            isWinner={isFinished && match.winner === match.player2}
            isLoser={isFinished && match.winner && match.winner !== match.player2}
            isMe={p2IsMe}
          />
        </div>

        {/* Winner Bar */}
        {isFinished && match.winner && (
          <div className="bg-yellow-500/10 px-3 py-1.5 flex items-center justify-center gap-1">
            <Crown size={10} className="text-yellow-400" />
            <span className="text-[9px] text-yellow-400 font-bold">{match.winner} → weiter</span>
          </div>
        )}
      </div>
    );
  };

  // Runden-Status berechnen
  const getRoundStatus = (roundName) => {
    const rMatches = roundsMap[roundName] || [];
    const allDone = rMatches.every(m => m.status === 'finished');
    const someActive = rMatches.some(m => m.status === 'ready' || m.status === 'active');
    if (allDone) return 'done';
    if (someActive) return 'active';
    return 'pending';
  };

  return (
    <div>
      {/* Round Tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto scrollbar-hide">
        {sortedRounds.map((round, idx) => {
          const status = getRoundStatus(round);
          const isActive = idx === activeRoundIdx;
          const isFinal = round === 'final';

          return (
            <button
              key={round}
              onClick={() => setActiveRoundIdx(idx)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-purple-500 text-black'
                  : status === 'done'
                  ? 'bg-white/10 text-neutral-400'
                  : status === 'active'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-white/5 text-neutral-600'
              }`}
            >
              {isFinal ? '🏆' : ''} {ROUND_LABELS[round] || round}
              {status === 'done' && !isActive && ' ✓'}
            </button>
          );
        })}
      </div>

      {/* Round Title + Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => canGoLeft && setActiveRoundIdx(activeRoundIdx - 1)}
          disabled={!canGoLeft}
          className={`p-2 rounded-xl transition-colors ${
            canGoLeft ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-neutral-700'
          }`}
        >
          <ChevronLeft size={18} />
        </button>

        <div className="text-center">
          <h4 className="text-sm font-black text-white uppercase tracking-wider">
            {currentRound === 'final' && '🏆 '}{ROUND_LABELS[currentRound] || currentRound}
          </h4>
          <p className="text-[10px] text-neutral-500 mt-0.5">
            {currentMatches.length} {currentMatches.length === 1 ? 'Match' : 'Matches'}
            {getRoundStatus(currentRound) === 'done' && ' — abgeschlossen'}
            {getRoundStatus(currentRound) === 'active' && ' — läuft'}
          </p>
        </div>

        <button
          onClick={() => canGoRight && setActiveRoundIdx(activeRoundIdx + 1)}
          disabled={!canGoRight}
          className={`p-2 rounded-xl transition-colors ${
            canGoRight ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white/5 text-neutral-700'
          }`}
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Matches */}
      <div className="space-y-3">
        {currentMatches.map((match, idx) => (
          <MatchCard key={match.id} match={match} matchNumber={idx + 1} />
        ))}
      </div>

      {/* Round Progress */}
      <div className="flex items-center justify-center gap-1.5 mt-4">
        {sortedRounds.map((round, idx) => {
          const status = getRoundStatus(round);
          return (
            <button
              key={round}
              onClick={() => setActiveRoundIdx(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === activeRoundIdx
                  ? 'w-6 bg-purple-500'
                  : status === 'done'
                  ? 'bg-green-500/50'
                  : status === 'active'
                  ? 'bg-yellow-500/50'
                  : 'bg-white/10'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
};

export default BracketTree;