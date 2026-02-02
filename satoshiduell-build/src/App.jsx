import React, { useState, useEffect } from 'react';

// --- VIEWS ---
import LandingView from './views/LandingView';
import LoginView from './views/LoginView';
import DashboardView from './views/DashboardView';
import CreateDuelView from './views/CreateDuelView';
import PaymentView from './views/PaymentView';
import GameView from './views/GameView';
import LobbyView from './views/LobbyView';
import ResultView from './views/ResultView';
import ActiveGamesView from './views/ActiveGamesView';
import HistoryView from './views/HistoryView';
import BadgesView from './views/BadgesView';
import LeaderboardView from './views/LeaderboardView'; // <--- 1. NEUER IMPORT

// --- SERVICES & HOOKS ---
import { createDuelEntry, joinDuel, activateDuel, submitGameResult } from './services/supabase';
import { useAuth } from './hooks/useAuth';

export default function App() {
  const { user, logout } = useAuth();
  
  // --- STATE ---
  const [introAccepted, setIntroAccepted] = useState(() => {
    return localStorage.getItem('satoshi_intro_accepted') === 'true';
  });

  const [view, setView] = useState('dashboard');
  const [currentGame, setCurrentGame] = useState(null); 
  const [creationAmount, setCreationAmount] = useState(0); 
  
  const [isJoining, setIsJoining] = useState(false); 

  // --- NAVIGATION (HISTORY API) ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (event.state && event.state.view) {
        setView(event.state.view);
        if (event.state.view === 'dashboard') {
          setIsJoining(false);
          setCurrentGame(null);
        }
      } else {
        setView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
    navigate('create-duel');
  };

  const handleAmountConfirmed = async (amount) => {
    setCreationAmount(amount);
    const { data, error } = await createDuelEntry(user.name, amount);
    
    if (data) {
      setCurrentGame(data); 
      navigate('payment'); 
    } else {
      console.error("Fehler beim Erstellen:", error);
      alert("Fehler beim Erstellen des Spiels.");
    }
  };

  const handleOpenLobby = () => {
    setIsJoining(true); 
    navigate('lobby');
  };

  const handleJoinSelectedDuel = (game) => {
    setCurrentGame(game);           
    setCreationAmount(game.amount); 
    navigate('payment');            
  };

  const handlePaymentDone = async () => {
    if (isJoining && currentGame) {
      console.log(`Joiner ${user.name} hat bezahlt.`);
      const { data, error } = await joinDuel(currentGame.id, user.name);
      if (data) {
        setCurrentGame(data); 
        navigate('game');     
      } else {
        console.error("Fehler beim Joinen:", error);
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

  const handleGameEnd = async (result) => {
    console.log("Spieler fertig:", result);
    if (!currentGame) return;

    const isCreator = user.name === currentGame.creator;
    const role = isCreator ? 'creator' : 'challenger';

    await submitGameResult(currentGame.id, role, result.score, result.totalTime);
    navigateReplace('result'); 
  };


  // --- RENDER LOGIK ---

  if (!introAccepted) {
    return (
      <div className="app h-screen w-screen overflow-hidden text-white select-none bg-[#111]">
        <LandingView onFinish={handleIntroFinish} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app h-screen w-screen overflow-hidden text-white select-none bg-[#111]">
        <LoginView />
      </div>
    );
  }

  return (
    <div className="app h-screen w-screen overflow-hidden text-white select-none bg-[#111] font-sans">
       
       {/* 1. DASHBOARD */}
       {view === 'dashboard' && (
         <DashboardView 
           onCreateDuel={handleStartCreateDuel} 
           onPlay={handleOpenLobby} 
           onLogout={logout}
           onOpenActiveGames={() => navigate('active-games')} 
           onOpenHistory={() => navigate('history')} 
           onOpenBadges={() => navigate('badges')} 
           // --- 2. HIER WIRD LEADERBOARD VERKNÜPFT ---
           onOpenLeaderboard={() => navigate('leaderboard')}
         />
       )}

       {/* 2. CREATOR */}
       {view === 'create-duel' && (
         <CreateDuelView 
           onCancel={() => navigate('dashboard')}
           onConfirm={handleAmountConfirmed}
         />
       )}

       {/* 3. LOBBY */}
       {view === 'lobby' && (
         <LobbyView 
            onJoinDuel={handleJoinSelectedDuel}
            onCancel={() => {
              setIsJoining(false);
              navigate('dashboard');
            }}
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
       {view === 'result' && currentGame && (
         <ResultView 
           gameData={currentGame}
           onHome={() => {
              setCurrentGame(null);
              setCreationAmount(0);
              setIsJoining(false);
              navigateReplace('dashboard');
           }}
         />
       )}

       {/* 7. ACTIVE GAMES LIST */}
       {view === 'active-games' && (
         <ActiveGamesView 
            onBack={() => navigate('dashboard')}
            onSelectGame={(game) => {
               setCurrentGame(game);
               navigate('result'); 
            }}
         />
       )}

       {/* 8. HISTORY VIEW */}
       {view === 'history' && (
         <HistoryView 
            onBack={() => navigate('dashboard')}
            onSelectGame={(game) => {
               setCurrentGame(game);
               navigate('result'); 
            }}
         />
       )}

       {/* 9. BADGES VIEW */}
       {view === 'badges' && (
         <BadgesView 
            onBack={() => navigate('dashboard')}
         />
       )}

       {/* 10. LEADERBOARD VIEW (NEU) */}
       {view === 'leaderboard' && (
         <LeaderboardView 
            onBack={() => navigate('dashboard')}
            onChallenge={(playerName) => {
                // Feature: Direktes Herausfordern
                console.log("Herausforderung an:", playerName);
                navigate('create-duel');
            }}
         />
       )}
       
    </div>
  );
}