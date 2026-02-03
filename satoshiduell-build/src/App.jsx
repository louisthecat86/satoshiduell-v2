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
import LeaderboardView from './views/LeaderboardView'; 
import DonateView from './views/DonateView'; // <--- NEU: Donate View importiert
import SettingsView from './views/SettingsView';

// --- SERVICES & HOOKS ---
import { createDuelEntry, joinDuel, activateDuel, submitGameResult, supabase } from './services/supabase'; 
import { useAuth } from './hooks/useAuth';
import { createWithdrawLink } from './services/lnbits'; 

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
  // Filter für Lobby (null = alle, 'challenges' = nur Challenges)
  const [lobbyFilter, setLobbyFilter] = useState(null);
  
  // State für den Gegner
  const [challengeTarget, setChallengeTarget] = useState(null);

  // --- NAVIGATION (HISTORY API) ---
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

  const handleAmountConfirmed = async (amount, targetPlayer = null) => {
    setCreationAmount(amount);
    
    const { data, error } = await createDuelEntry(user.name, amount, targetPlayer);
    
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
    setLobbyFilter(null);
    navigate('lobby');
  };

  const handleOpenChallengesList = () => {
      setIsJoining(true);
      setLobbyFilter('challenges');
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

  // --- REFUND FUNKTION (Mit Betrag-Check) ---
  const handleRefund = async (game) => {
    console.log("🔍 REFUND DEBUG CHECK:", game);
    
    // SAFETY: Betrag sicherstellen (als Number)
    const refundAmount = Number(game.amount);

    if (!refundAmount || refundAmount <= 0) {
        alert(`FEHLER: Kein gültiger Einsatz gefunden (Betrag: ${game.amount}). Kann nicht erstatten.`);
        return;
    }

    if (!confirm(`Willst du dieses Spiel stornieren und ${refundAmount} Sats zurückholen?`)) return;
    
    console.log(`Starte Refund für ${refundAmount} Sats...`);

    // Withdraw Link erstellen
    const linkData = await createWithdrawLink(refundAmount, game.id);
    
    if (!linkData || !linkData.lnurl) {
        alert("Fehler: Konnte keinen Refund-Link erstellen. Bitte Admin kontaktieren.");
        return;
    }

    // Datenbank updaten
    const { error } = await supabase
        .from('duels')
        .update({ 
            status: 'refunded', 
            withdraw_link: linkData.lnurl 
        })
        .eq('id', game.id);

    if (error) {
        console.error("DB Error:", error);
        alert("Fehler beim Speichern des Refunds.");
        return;
    }

    // Weiterleiten (Daten im State aktualisieren)
    setCurrentGame({ 
        ...game, 
        amount: refundAmount, 
        status: 'refunded', 
        withdraw_link: linkData.lnurl,
        withdraw_id: linkData.id 
    });
    
    navigate('result');
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
           onOpenLeaderboard={() => navigate('leaderboard')}
           onOpenChallenges={handleOpenChallengesList}
           onDonate={() => navigate('donate')} // <--- Spenden Button
           onOpenSettings={() => navigate('settings')}
         />
       )}

       {/* 2. CREATOR */}
       {view === 'create-duel' && (
         <CreateDuelView 
           onCancel={() => navigate('dashboard')}
           onConfirm={handleAmountConfirmed}
           targetPlayer={challengeTarget}
         />
       )}

       {/* 3. LOBBY */}
       {view === 'lobby' && (
         <LobbyView 
            onJoinDuel={handleJoinSelectedDuel}
            onCancel={() => {
              setIsJoining(false);
              setLobbyFilter(null);
              navigate('dashboard');
            }}
            showChallengesOnly={lobbyFilter === 'challenges'}
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
            onRefund={handleRefund} 
            onSelectGame={(game) => {
               let safeGame = { ...game };
               if (typeof safeGame.questions === 'string') {
                   try {
                       safeGame.questions = JSON.parse(safeGame.questions);
                   } catch (e) {
                       console.error("Fehler beim Parsen der Fragen:", e);
                       safeGame.questions = [];
                   }
               }
               setCurrentGame(safeGame);
               
               const isCreator = user.name === game.creator;
               const myScore = isCreator ? game.creator_score : game.challenger_score;

               if (game.status === 'refunded') {
                   navigate('result');
                   return;
               }

               if (myScore === null && game.status !== 'finished') {
                   console.log("👉 Du musst noch spielen -> Navigiere zu GAME");
                   navigate('game');
               } else {
                   console.log("👉 Du hast schon gespielt -> Navigiere zu RESULT");
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

       {/* 10. LEADERBOARD VIEW */}
       {view === 'leaderboard' && (
         <LeaderboardView 
            onBack={() => navigate('dashboard')}
            onChallenge={(playerName) => {
                console.log("Herausforderung an:", playerName);
                setChallengeTarget(playerName); 
                setIsJoining(false);            
                navigate('create-duel');        
            }}
         />
       )}

       {/* 11. DONATE VIEW (NEU) */}
       {view === 'donate' && (
         <DonateView 
            onBack={() => navigate('dashboard')}
         />
       )}

       {/* 12. SETTINGS VIEW */}
       {view === 'settings' && (
         <SettingsView 
            onBack={() => navigate('dashboard')}
         />
       )}
       
    </div>
  );
}