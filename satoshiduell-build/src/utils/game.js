// utils/game.js

/**
 * Generiert Spieldaten mit zufälligen, nicht-wiederholenden Fragen
 * @param {Array} questionsSource - Array aller verfügbaren Fragen
 * @param {number} count - Anzahl der zu generierenden Fragen
 * @returns {Array} Array von Spielfragen mit gemischten Antworten
 */
export const generateGameData = (questionsSource, count = 5) => {
  if (!questionsSource || questionsSource.length === 0) return [];

  // Lade bereits gespielte Fragen aus localStorage
  let playedIds = JSON.parse(localStorage.getItem('played_questions') || '[]');
  
  // Finde verfügbare Fragen (die noch nicht gespielt wurden)
  let availableIndices = questionsSource
    .map((_, i) => i)
    .filter(id => !playedIds.includes(id));

  // Wenn weniger als 5 Fragen verfügbar sind, reset den Verlauf
  if (availableIndices.length < count) {
    playedIds = [];
    availableIndices = questionsSource.map((_, i) => i);
  }

  // Fisher-Yates Shuffle
  for (let i = availableIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
  }

  // Wähle die ersten 'count' Fragen
  const selectedIndices = availableIndices.slice(0, count);

  // Speichere die gespielten Fragen
  const newHistory = [...playedIds, ...selectedIndices];
  localStorage.setItem('played_questions', JSON.stringify(newHistory));

  // Generiere Spieldaten mit gemischten Antwort-Optionen
  return selectedIndices.map(id => {
    const order = [0, 1, 2, 3];
    
    // Shuffle der Antwort-Reihenfolge
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    return { id, order };
  });
};

/**
 * Berechnet den finalen Score basierend auf Richtigkeit und Zeit
 * @param {number} correctAnswers - Anzahl korrekter Antworten
 * @param {number} totalTime - Gesamtzeit in Sekunden
 * @param {number} maxScore - Maximaler Score pro Frage
 * @returns {number} Berechneter Score
 */
export const calculateScore = (correctAnswers, totalTime, maxScore = 1000) => {
  // Basis-Score: 1000 Punkte pro richtige Antwort
  const baseScore = correctAnswers * maxScore;
  
  // Zeit-Bonus: Je schneller, desto mehr Bonus (max 500 Punkte)
  const timeBonus = Math.max(0, 500 - (totalTime * 10));
  
  return Math.round(baseScore + timeBonus);
};

/**
 * Bestimmt den Gewinner eines Duells
 * @param {Object} creator - Creator-Daten {score, time}
 * @param {Object} challenger - Challenger-Daten {score, time}
 * @returns {string} 'creator', 'challenger' oder 'draw'
 */
export const determineWinner = (creator, challenger) => {
  if (creator.score > challenger.score) return 'creator';
  if (challenger.score > creator.score) return 'challenger';
  
  // Bei gleichem Score entscheidet die Zeit
  if (creator.time < challenger.time) return 'creator';
  if (challenger.time < creator.time) return 'challenger';
  
  return 'draw';
};

/**
 * Prüft ob ein Duel für Refund berechtigt ist
 * @param {string} createdAt - Erstellungs-Zeitstempel
 * @param {number} timeoutMs - Timeout in Millisekunden
 * @returns {boolean} Ob Refund möglich ist
 */
export const canRefund = (createdAt, timeoutMs = 3 * 24 * 60 * 60 * 1000) => {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  return (now - created) >= timeoutMs;
};
