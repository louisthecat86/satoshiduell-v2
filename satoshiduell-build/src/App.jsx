import React, { useState, useEffect } from 'react';

// --- VIEWS ---
import LandingView from './views/LandingView';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import CreateDuelView from './views/CreateDuelView';
import CreateArenaView from './views/CreateArenaView';
import PaymentView from './views/PaymentView';
import GameView from './views/GameView';
import LobbyView from './views/LobbyView';
import ResultView from './views/ResultView';
import ActiveGamesView from './views/ActiveGamesView';
import HistoryView from './views/HistoryView';
import BadgesView from './views/BadgesView';
import LeaderboardView from './views/LeaderboardView'; 
import ChallengesView from './views/ChallengesView';
import DonateView from './views/DonateView'; 
import SettingsView from './views/SettingsView';
import AdminView from './views/AdminView';
import NostrSetupView from './views/NostrSetupView';
import TournamentsView from './views/TournamentsView';
import CreateTournamentView from './views/CreateTournamentView';

// --- SERVICES & UTILS ---
import { joinDuel, joinArena, activateDuel, submitGameResult, submitArenaResult, getGameStatus, fetchUserGames, recalculateUserStats, supabase, createTournament, fetchGameQuestions, uploadTournamentImage, updateTournament, submitTournamentResult } from './services/supabase'; 
import { useAuth } from './hooks/useAuth';
import { createWithdrawLink } from './services/lnbits'; 

export default function App() {
  const { user, logout, refreshUser, pendingNpub } = useAuth();
  const userName = user?.username || user?.name || '';
  
  // --- STATE ---
  const [introAccepted, setIntroAccepted] = useState(() => {
    return localStorage.getItem('satoshi_intro_accepted') === 'true';
  });

  const [view, setView] = useState('dashboard');
  const [previousView, setPreviousView] = useState('dashboard');
  const [currentGame, setCurrentGame] = useState(null); 
  const [currentTournamentGame, setCurrentTournamentGame] = useState(null);
  const [creationAmount, setCreationAmount] = useState(0); 
  const [isJoining, setIsJoining] = useState(false); 
  const [lobbyFilter, setLobbyFilter] = useState(null);
  const [challengeTarget, setChallengeTarget] = useState(null);

  // --- HELPER: Sicherer Namensvergleich (CASE INSENSITIVE) ---
  const normalize = (str) => (str || "").toLowerCase().trim();

  // --- NAVIGATION ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
        if (event.state.view === 'dashboard') {
          setIsJoining(false);
          setCurrentGame(null);
          setChallengeTarget(null); 
        }
      } else {
        setView('dashboard');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Duel-Link aus URL übernehmen
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const duelId = params.get('duel') || params.get('challenge');
    if (duelId) {
      localStorage.setItem('satoshi_pending_duel', duelId);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Pending Duel nach Login öffnen
  useEffect(() => {
    const openPendingDuel = async () => {
      if (!userName) return;
      const duelId = localStorage.getItem('satoshi_pending_duel');
      if (!duelId) return;

      const { data } = await getGameStatus(duelId);
      localStorage.removeItem('satoshi_pending_duel');

      if (!data) return;

      if (normalize(userName) === normalize(data.creator)) {
        navigate('active-games');
        return;
      }

      setCurrentGame(data);
      setCreationAmount(data.amount);
      setIsJoining(true);
      navigate('payment');
    };

    openPendingDuel();
  }, [userName]);

  const navigate = (newView) => {
    setView(newView);
    window.history.pushState({ view: newView }, '', '');
  };

  const navigateReplace = (newView) => {
    setView(newView);
    window.history.replaceState({ view: newView }, '', '');
  };

  // --- HANDLERS ---
  const handleIntroFinish = () => {
    setIntroAccepted(true);
    localStorage.setItem('satoshi_intro_accepted', 'true');
  };

  const handleStartCreateDuel = () => {
    setIsJoining(false); 
    setChallengeTarget(null); 
    navigate('create-duel');
  };

  const handleStartCreateArena = () => {
    setIsJoining(false);
    setChallengeTarget(null);
    navigate('create-arena');
  };

  const handleDuelCreated = async (gameId) => {
      console.log("App: Duell erstellt mit ID:", gameId);
      const { data, error } = await getGameStatus(gameId);
      if (data) {
          setCurrentGame(data);
          setCreationAmount(data.amount);
          navigate('payment');
      } else {
          console.error("Fehler beim Laden:", error);
          alert("Fehler beim Laden des Spiels.");
      }
  };

  const handleTournamentCreated = async (tournamentForm) => {
    if (!userName) {
      return { ok: false, message: 'LOGIN_REQUIRED' };
    }

    const questions = await fetchGameQuestions(tournamentForm.questionCount || 1, 'de');
    if (!questions || questions.length === 0) {
      return { ok: false, message: 'NO_QUESTIONS' };
    }

    const tournamentPayload = {
      name: tournamentForm.name,
      description: tournamentForm.description,
      creator: userName,
      max_players: tournamentForm.maxPlayers ? parseInt(tournamentForm.maxPlayers, 10) : null,
      total_prize_pool: tournamentForm.prizePool ? parseInt(tournamentForm.prizePool, 10) : 0,
      access_level: tournamentForm.accessLevel,
      question_count: tournamentForm.questionCount,
      play_until: tournamentForm.playUntil ? new Date(tournamentForm.playUntil).toISOString() : null,
      contact_info: tournamentForm.contactInfo || null,
      questions: questions,
    };

    const { data, error } = await createTournament(tournamentPayload);
    if (error || !data) {
      console.error('Fehler beim Erstellen des Turniers:', error);
      return { ok: false, message: error?.message || 'CREATE_FAILED' };
    }

    if (tournamentForm.imageFile) {
      try {
        const { url, path } = await uploadTournamentImage(data.id, tournamentForm.imageFile);
        if (url && path) {
          await updateTournament(data.id, { image_url: url, image_path: path });
        }
      } catch (uploadError) {
        console.error('Fehler beim Hochladen des Turnierbilds:', uploadError);
      }
    }

    navigate('tournaments');
    return { ok: true };
  };

  const handleStartTournament = (tournament) => {
    if (!tournament) return;
    let questions = tournament.questions || [];
    if (typeof questions === 'string') {
      try {
        questions = JSON.parse(questions);
      } catch (e) {
        questions = [];
      }
    }
    setCurrentTournamentGame({ ...tournament, questions, mode: 'tournament' });
    navigate('tournament-game');
  };

  const handleTournamentGameEnd = async (result) => {
    if (!currentTournamentGame || !userName) return;

    const { data, error } = await submitTournamentResult(
      currentTournamentGame.id,
      userName,
      result.score,
      result.totalTime
    );

    if (error) {
      console.error('Tournament result submit error:', error);
      return;
    }

    if (data) {
      setCurrentTournamentGame({ ...data, mode: 'tournament' });
      navigate('result');
    }
  };

  const handleOpenLobby = () => {
    setIsJoining(true); 
    setLobbyFilter(null);
    navigate('lobby');
  };

  const handleOpenChallengesList = () => {
      setIsJoining(true);
      setLobbyFilter(null);
      navigate('challenges');
  };

  const handleOpenAdmin = () => {
    navigate('admin');
  };

  const handleJoinSelectedDuel = (game) => {
    setCurrentGame(game);           
    setCreationAmount(game.amount); 
    navigate('payment');            
  };

  const handlePaymentDone = async () => {
    if (isJoining && currentGame) {
      console.log(`Joiner ${userName} hat bezahlt.`);
      const { data, error } = currentGame.mode === 'arena'
        ? await joinArena(currentGame.id, userName)
        : await joinDuel(currentGame.id, userName);
      if (data) {
        setCurrentGame(data); 
        navigate('game');     
      } else {
        console.error("Join Error:", error);
        alert("Fehler beim Beitreten.");
        navigate('dashboard');
      }
    } else {
      console.log("Creator hat bezahlt.");
      if (currentGame) {
        await activateDuel(currentGame.id);
        navigate('game');
      }
    }
  };

  // --- FIX: HIER WAR DER HUND BEGRABEN ---
  const handleGameEnd = async (result) => {
    console.log("Spieler fertig:", result);
    if (!currentGame) return;

    // 1. Wir normalisieren BEIDE Namen -> Damit ist Groß/Klein egal
    const isCreator = normalize(userName) === normalize(currentGame.creator);
    
    // 2. Rolle sicher bestimmen
    const role = isCreator ? 'creator' : 'challenger';

    console.log(`💾 Speichere als ${role.toUpperCase()} (User: ${userName}, Creator: ${currentGame.creator})`);

    // 3. Speichern
    try {
      if (currentGame.mode === 'arena') {
        const { data, error } = await submitArenaResult(currentGame.id, userName, result.score, result.totalTime);
        if (data) setCurrentGame(data);
        if (error) console.error('Arena submit error:', error);
      } else {
        const { data, error } = await submitGameResult(currentGame.id, role, result.score, result.totalTime);
        if (data) setCurrentGame(data);
        if (error) console.error('Duel submit error:', error);
      }
    } catch (err) {
      console.error('Submit error:', err);
    }
    if (userName) await recalculateUserStats(userName);
    
    if(refreshUser) refreshUser(); 
    navigateReplace('result'); 
  };

  const handleRefund = async (game) => {
    const refundAmount = Number(game.amount);
    if (!refundAmount || refundAmount <= 0) {
        alert(`FEHLER: Kein gültiger Einsatz.`);
        return;
    }
    if (!confirm(`Willst du dieses Spiel stornieren und ${refundAmount} Sats zurückholen?`)) return;
    
    const linkData = await createWithdrawLink(refundAmount, game.id);
    if (!linkData || !linkData.lnurl) {
        alert("Fehler: Konnte keinen Refund-Link erstellen.");
        return;
    }

    if (game.mode === 'arena') {
      const currentLinks = game.refund_links || {};
      const currentIds = game.refund_ids || {};
      const userKey = (userName || '').toLowerCase();

      const nextLinks = { ...currentLinks, [userKey]: linkData.lnurl };
      const nextIds = { ...currentIds, [userKey]: linkData.id };

      const { error } = await supabase
        .from('duels')
        .update({ refund_links: nextLinks, refund_ids: nextIds })
        .eq('id', game.id);

      if (error) {
        alert("Fehler beim Speichern des Refund-Links.");
      }
      return;
    }

    const { error } = await supabase
      .from('duels')
      .update({ status: 'refunded', withdraw_link: linkData.lnurl, withdraw_id: linkData.id })
      .eq('id', game.id);

    if (error) alert("Fehler beim Speichern des Refund-Links.");
  };
  
  // Da ich oben 'supabase' nicht importieren kann ohne die Datei zu ändern, hier die Korrektur:
  // Du musst `import { supabase } from './services/supabase';` oben hinzufügen!
  // Ich habe es im Code-Block unten ergänzt.


  // --- RENDER LOGIK ---

  if (!introAccepted) return <div className="app bg-[#111]"><LandingView onFinish={handleIntroFinish} /></div>;
  if (!user && pendingNpub) return <div className="app bg-[#111]"><NostrSetupView /></div>;
  if (!user) return <div className="app bg-[#111]"><LoginView /></div>;

  return (
    <div className="app h-screen w-screen overflow-hidden text-white select-none bg-[#111] font-sans">
       
       {/* 1. DASHBOARD */}
       {view === 'dashboard' && (
         <DashboardView 
           onCreateDuel={handleStartCreateDuel} 
           onCreateArena={handleStartCreateArena}
           onPlay={handleOpenLobby} 
           onLogout={logout}
           onOpenActiveGames={() => navigate('active-games')} 
           onOpenHistory={() => navigate('history')} 
           onOpenBadges={() => navigate('badges')} 
           onOpenLeaderboard={() => navigate('leaderboard')}
           onOpenChallenges={handleOpenChallengesList}
           onDonate={() => navigate('donate')}
           onOpenSettings={() => navigate('settings')}
           onOpenTournaments={() => navigate('tournaments')}
         />
       )}

       {/* 2. CREATOR */}
       {view === 'create-duel' && (
         <CreateDuelView 
           onCancel={() => navigate('dashboard')}
           onConfirm={handleDuelCreated} 
           targetPlayer={challengeTarget}
         />
       )}

       {view === 'create-arena' && (
         <CreateArenaView
           onCancel={() => navigate('dashboard')}
           onConfirm={handleDuelCreated}
         />
       )}

       {/* 3. LOBBY */}
       {view === 'lobby' && (
         <LobbyView 
            onJoinDuel={handleJoinSelectedDuel}
            onCancel={() => { setIsJoining(false); setLobbyFilter(null); navigate('dashboard'); }}
         />
       )}

       {/* 3b. CHALLENGES */}
       {view === 'challenges' && (
         <ChallengesView
            onAcceptChallenge={handleJoinSelectedDuel}
            onCancel={() => { setIsJoining(false); navigate('dashboard'); }}
         />
       )}

       {/* 4. PAYMENT */}
       {view === 'payment' && currentGame && (
         <PaymentView 
           amount={creationAmount}
           onPaymentSuccess={handlePaymentDone}
         />
       )}
       
       {/* 5. GAME */}
       {view === 'game' && currentGame && (
         <GameView 
            gameData={currentGame}
            onGameEnd={handleGameEnd}
         />
       )}
       
       {/* 6. RESULT */}
       {view === 'result' && (currentGame || currentTournamentGame) && (
         <ResultView 
           gameData={currentTournamentGame || currentGame}
           onHome={() => {
              if (currentTournamentGame) {
                setCurrentTournamentGame(null);
                navigateReplace('tournaments');
                return;
              }
              setCurrentGame(null);
              setCreationAmount(0);
              setIsJoining(false);
              const backTo = previousView === 'history' ? 'history' : 'dashboard';
              setPreviousView('dashboard');
              navigateReplace(backTo);
           }}
         />
       )}

       {/* 7. ACTIVE GAMES LIST */}
       {view === 'active-games' && (
         <ActiveGamesView 
            onBack={() => navigate('dashboard')}
            onRefund={handleRefund} 
            onSelectGame={(game) => {
               let safeGame = { ...game };
               if (typeof safeGame.questions === 'string') {
                   try { safeGame.questions = JSON.parse(safeGame.questions); } 
                   catch (e) { safeGame.questions = []; }
               }
               setCurrentGame(safeGame);
               
               // Auch hier normalisieren für korrekte Weiterleitung
               const isCreator = normalize(userName) === normalize(game.creator);
               const myScore = isCreator ? game.creator_score : game.challenger_score;

               if (game.status === 'refunded') {
                   navigate('result');
               } else if (myScore === null && game.status !== 'finished') {
                   navigate('game');
               } else {
                   navigate('result'); 
               }
            }}
         />
       )}

       {/* 8. HISTORY VIEW */}
       {view === 'history' && (
         <HistoryView 
            onBack={() => navigate('dashboard')}
            onSelectGame={(game) => {
               setCurrentGame(game);
               setPreviousView('history');
               navigate('result'); 
            }}
         />
       )}

       {/* 9. BADGES VIEW */}
       {view === 'badges' && (
         <BadgesView onBack={() => navigate('dashboard')} />
       )}

       {/* 10. LEADERBOARD VIEW */}
       {view === 'leaderboard' && (
         <LeaderboardView 
            onBack={() => navigate('dashboard')}
            onChallenge={(playerName) => {
                setChallengeTarget(playerName); 
                setIsJoining(false);            
                navigate('create-duel');        
            }}
         />
       )}

       {/* 11. DONATE VIEW */}
       {view === 'donate' && (
         <DonateView onBack={() => navigate('dashboard')} />
       )}

       {/* 12. SETTINGS VIEW */}
       {view === 'settings' && (
         <SettingsView 
            onBack={() => navigate('dashboard')}
            onOpenAdmin={handleOpenAdmin}
         />
       )}

       {/* 13. ADMIN VIEW */}
       {view === 'admin' && (
         <AdminView onBack={() => navigate('dashboard')} />
       )}

       {/* 14. TOURNAMENTS VIEW */}
       {view === 'tournaments' && (
         <TournamentsView 
            onBack={() => navigate('dashboard')}
            onCreateTournament={() => navigate('create-tournament')}
          onStartTournament={handleStartTournament}
         />
       )}

       {/* 15. CREATE TOURNAMENT VIEW */}
       {view === 'create-tournament' && (
         <CreateTournamentView 
            onCancel={() => navigate('tournaments')}
            onConfirm={handleTournamentCreated}
         />
       )}

       {view === 'tournament-game' && currentTournamentGame && (
         <GameView
           gameData={currentTournamentGame}
           onGameEnd={handleTournamentGameEnd}
         />
       )}

       {/* Tournament payment views removed in simplified flow */}
       
    </div>
  );
}