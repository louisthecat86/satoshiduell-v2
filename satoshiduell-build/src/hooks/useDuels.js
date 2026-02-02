// hooks/useDuels.js

import { useState, useEffect } from 'react';
import {
  createDuel,
  updateDuel,
  getDuel,
  getPublicDuels,
  getTargetedDuels,
  getPlayerDuels,
  subscribeToDuels,
  subscribeToDuel,
} from '../services/supabase';
import { determineWinner } from '../utils/game';

/**
 * Custom Hook für Duel Management
 */
export const useDuels = (user) => {
  const [publicDuels, setPublicDuels] = useState([]);
  const [targetedDuels, setTargetedDuels] = useState([]);
  const [myDuels, setMyDuels] = useState([]);
  const [activeDuel, setActiveDuel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Lädt alle Duels
   */
  const loadDuels = async () => {
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      const [publicData, targetedData, myData] = await Promise.all([
        getPublicDuels(),
        getTargetedDuels(user.name),
        getPlayerDuels(user.name),
      ]);

      setPublicDuels(publicData);
      setTargetedDuels(targetedData);
      setMyDuels(myData);
    } catch (e) {
      setError(e.message);
      console.error('Load duels error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Erstellt ein neues Duel
   */
  const createNewDuel = async (duelData) => {
    setIsLoading(true);
    setError('');

    try {
      const newDuel = await createDuel({
        ...duelData,
        creator: user.name,
        creator_avatar: user.avatar,
        status: 'open',
      });

      // Reload duels
      await loadDuels();

      return newDuel;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Nimmt ein Duel an
   */
  const acceptDuel = async (duelId) => {
    setIsLoading(true);
    setError('');

    try {
      const duel = await getDuel(duelId);
      setActiveDuel(duel);
      return duel;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Beendet ein Duel als Challenger
   */
  const finishDuelAsChallenger = async (duelId, score, time) => {
    setIsLoading(true);
    setError('');

    try {
      const updatedDuel = await updateDuel(duelId, {
        challenger: user.name,
        challenger_score: score,
        challenger_time: time,
        challenger_avatar: user.avatar,
        status: 'finished',
      });

      setActiveDuel(updatedDuel);
      await loadDuels();

      return updatedDuel;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Lädt ein spezifisches Duel
   */
  const loadDuel = async (duelId) => {
    setIsLoading(true);
    setError('');

    try {
      const duel = await getDuel(duelId);
      setActiveDuel(duel);
      return duel;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Bestimmt Gewinner eines Duels
   */
  const getDuelWinner = (duel) => {
    if (!duel || duel.status !== 'finished') return null;

    return determineWinner(
      { score: duel.creator_score, time: duel.creator_time },
      { score: duel.challenger_score, time: duel.challenger_time }
    );
  };

  /**
   * Prüft ob User der Gewinner ist
   */
  const isUserWinner = (duel) => {
    if (!user || !duel) return false;

    const winner = getDuelWinner(duel);
    
    if (winner === 'draw') return false;
    if (winner === 'creator' && duel.creator === user.name) return true;
    if (winner === 'challenger' && duel.challenger === user.name) return true;
    
    return false;
  };

  // Realtime Subscriptions
  useEffect(() => {
    if (!user) return;

    // Subscribe to all duels
    const subscription = subscribeToDuels((payload) => {
      console.log('Duel changed:', payload);
      loadDuels();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  // Subscribe to active duel
  useEffect(() => {
    if (!activeDuel) return;

    const subscription = subscribeToDuel(activeDuel.id, (payload) => {
      console.log('Active duel updated:', payload);
      setActiveDuel(payload.new);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [activeDuel?.id]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadDuels();
    }
  }, [user]);

  return {
    // State
    publicDuels,
    targetedDuels,
    myDuels,
    activeDuel,
    isLoading,
    error,

    // Methods
    loadDuels,
    createNewDuel,
    acceptDuel,
    finishDuelAsChallenger,
    loadDuel,
    getDuelWinner,
    isUserWinner,
    setActiveDuel,
  };
};

/**
 * Hook für Duel-Statistiken
 */
export const useDuelStats = (myDuels, userName) => {
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    total: 0,
    satsWon: 0,
  });

  useEffect(() => {
    if (!myDuels || myDuels.length === 0) {
      setStats({ wins: 0, losses: 0, total: 0, satsWon: 0 });
      return;
    }

    const finishedDuels = myDuels.filter(d => d.status === 'finished');
    
    let wins = 0;
    let losses = 0;
    let satsWon = 0;

    finishedDuels.forEach(duel => {
      const winner = determineWinner(
        { score: duel.creator_score, time: duel.creator_time },
        { score: duel.challenger_score, time: duel.challenger_time }
      );

      const isWin = 
        (winner === 'creator' && duel.creator === userName) ||
        (winner === 'challenger' && duel.challenger === userName);

      if (isWin) {
        wins++;
        satsWon += duel.amount * 2; // Winner takes pot
      } else if (winner !== 'draw') {
        losses++;
      }
    });

    setStats({
      wins,
      losses,
      total: finishedDuels.length,
      satsWon,
    });
  }, [myDuels, userName]);

  return stats;
};
