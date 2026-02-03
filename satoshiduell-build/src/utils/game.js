// utils/game.js

/**
 * Generiert Spieldaten mit zufälligen, nicht-wiederholenden Fragen
 * @param {Array} questionsSource - Array aller verfügbaren Fragen (aus DB)
 * @param {number} count - Anzahl der zu generierenden Fragen (default 12)
 * @param {string} language - Sprache des Spielers ('de', 'en', 'es')
 * @returns {Array} Array von Spielfragen mit gemischten Antworten
 */
export const generateGameData = (questionsSource, count = 12, language = 'de') => {
  if (!questionsSource || questionsSource.length === 0) return [];

  // WICHTIG: Filtere Fragen nach Sprache des Spielers
  const languageFilteredQuestions = questionsSource.filter(q => q.language === language);
  
  if (languageFilteredQuestions.length === 0) {
    console.warn(`Keine Fragen für Sprache "${language}" gefunden. Nutze alle verfügbaren Fragen.`);
    return generateGameData(questionsSource, count, 'de'); // Fallback auf Deutsch
  }

  // Wenn weniger Fragen als angefordert existieren, nutze alle
  const targetCount = Math.min(count, languageFilteredQuestions.length);

  // Fisher-Yates Shuffle: Selektiere zufällig ohne Duplikate
  const indices = languageFilteredQuestions.map((_, i) => i);
  
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const selectedIndices = indices.slice(0, targetCount);

  // Generiere Spieldaten mit gemischten Antwort-Optionen
  return selectedIndices.map(id => {
    const question = languageFilteredQuestions[id];
    
    // Erstelle ein Array mit den Antwort-Indizes [0, 1, 2, 3]
    const answerOrder = [0, 1, 2, 3];
    
    // Shuffle: Die richtige Antwort landet an zufälliger Position
    for (let i = answerOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [answerOrder[i], answerOrder[j]] = [answerOrder[j], answerOrder[i]];
    }

    // Finde die neue Position der richtigen Antwort
    const correctPosition = answerOrder.indexOf(question.correct);

    return {
      id, // Index in languageFilteredQuestions
      questionData: question, // Die komplette Frage aus DB
      answerOrder, // [z.B. 2, 0, 3, 1] - Reihenfolge der Antworten
      correctPosition // Neue Position der richtigen Antwort nach dem Shuffle
    };
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
