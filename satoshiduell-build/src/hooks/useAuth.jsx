import React, { createContext, useContext, useState, useEffect } from 'react';
// Wir importieren verifyLogin UND createPlayer
import { verifyLogin, createPlayer } from '../services/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Beim Start: Prüfen ob User im LocalStorage ist
  useEffect(() => {
    const savedUser = localStorage.getItem('satoshi_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const login = async (name, pin) => {
    setLoading(true);
    setError(null);
    
    try {
      console.log(`🚀 Auth-Versuch für: ${name}`);

      // 1. VERSUCH: LOGIN
      const { data: existingUser, error: loginError } = await verifyLogin(name, pin);

      if (existingUser) {
        console.log("✅ Login erfolgreich!");
        saveUser(existingUser);
        return true;
      }

      // 2. VERSUCH: REGISTRIERUNG (Falls Login nicht klappte)
      // Wir gehen davon aus: Wenn Login fehlschlägt, ist der User vielleicht neu.
      // (Oder der Pin war wirklich falsch - das merken wir gleich).
      
      console.log("⚠️ Login ging nicht. Versuche Registrierung...");
      
      const { data: newUser, error: createError } = await createPlayer(name, pin);

      if (createError) {
        // Falls Fehler Code '23505' ist, gibt es den Namen schon -> Dann war der PIN falsch!
        if (createError.code === '23505') {
          throw new Error("Falsche PIN (Name existiert bereits)");
        }
        throw new Error("Fehler beim Erstellen: " + createError.message);
      }

      if (newUser) {
        console.log("🎉 Neuer Spieler registriert!");
        saveUser(newUser);
        return true;
      }

      throw new Error("Konnte weder einloggen noch registrieren.");

    } catch (err) {
      console.error("Login Fehler:", err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('satoshi_user');
  };

  const saveUser = (userData) => {
    setUser(userData);
    localStorage.setItem('satoshi_user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);