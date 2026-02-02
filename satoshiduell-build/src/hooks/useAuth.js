// hooks/useAuth.js

import { useState, useEffect } from 'react';
import { hashPin } from '../utils/crypto';
import { validateUsername, validatePin } from '../utils/validators';
import { 
  getPlayerByName, 
  getPlayerByPubkey, 
  createPlayer, 
  updatePlayer 
} from '../services/supabase';
import { 
  connectNostrExtension, 
  npubToHex,
  fetchNostrProfile 
} from '../services/nostr';
import { fetchNostrImage, getRobotAvatar } from '../utils/avatar';

/**
 * Custom Hook für Authentication
 */
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('satoshi_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error('Failed to parse saved user', e);
        localStorage.removeItem('satoshi_user');
      }
    }
  }, []);

  /**
   * Klassischer Login mit Username und PIN
   */
  const login = async (username, pin) => {
    setIsLoading(true);
    setError('');

    try {
      // Validierung
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        throw new Error(usernameValidation.error);
      }

      const pinValidation = validatePin(pin);
      if (!pinValidation.valid) {
        throw new Error(pinValidation.error);
      }

      // Hash PIN
      const hashedPin = await hashPin(pin);

      // Check if user exists
      const existingUser = await getPlayerByName(username);

      if (existingUser) {
        // Verify PIN
        if (existingUser.pin !== hashedPin) {
          throw new Error('Falscher PIN');
        }

        // Login successful
        const userData = {
          name: existingUser.name,
          pubkey: existingUser.pubkey,
          is_admin: existingUser.is_admin,
          avatar: existingUser.avatar || getRobotAvatar(existingUser.name),
        };

        setUser(userData);
        localStorage.setItem('satoshi_user', JSON.stringify(userData));
        
        return userData;
      } else {
        // Create new user
        const newPlayer = await createPlayer({
          name: username,
          pin: hashedPin,
          avatar: getRobotAvatar(username),
          pubkey: null,
          is_admin: false,
        });

        const userData = {
          name: newPlayer.name,
          pubkey: null,
          is_admin: false,
          avatar: newPlayer.avatar,
        };

        setUser(userData);
        localStorage.setItem('satoshi_user', JSON.stringify(userData));

        return userData;
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Nostr Extension Login
   */
  const loginWithNostrExtension = async () => {
    setIsLoading(true);
    setError('');

    try {
      const pubkey = await connectNostrExtension();
      const nostrImage = await fetchNostrImage(pubkey);

      const existingUser = await getPlayerByPubkey(pubkey);

      if (existingUser) {
        const userData = {
          name: existingUser.name,
          pubkey: existingUser.pubkey,
          is_admin: existingUser.is_admin,
          avatar: existingUser.avatar || nostrImage || getRobotAvatar(existingUser.name),
        };

        setUser(userData);
        localStorage.setItem('satoshi_user', JSON.stringify(userData));

        return userData;
      } else {
        // User needs to setup account
        return { 
          needsSetup: true, 
          pubkey,
          avatar: nostrImage 
        };
      }
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Amber Login (Mobile)
   */
  const loginWithAmber = (callbackUrl) => {
    const intentUrl = `intent:#Intent;scheme=nostrsigner;S.compressionType=none;S.returnType=signature;S.type=get_public_key;S.callbackUrl=${encodeURIComponent(callbackUrl)};end`;
    window.location.href = intentUrl;
  };

  /**
   * Nostr Setup abschließen
   */
  const completeNostrSetup = async (pubkey, username, pin) => {
    setIsLoading(true);
    setError('');

    try {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        throw new Error(usernameValidation.error);
      }

      const pinValidation = validatePin(pin);
      if (!pinValidation.valid) {
        throw new Error(pinValidation.error);
      }

      // Check if username already exists
      const existingUser = await getPlayerByName(username);
      if (existingUser) {
        throw new Error('Name bereits vergeben');
      }

      const hashedPin = await hashPin(pin);
      const nostrImage = await fetchNostrImage(pubkey);

      const newPlayer = await createPlayer({
        name: username,
        pin: hashedPin,
        pubkey: pubkey,
        avatar: nostrImage || getRobotAvatar(username),
        is_admin: false,
      });

      const userData = {
        name: newPlayer.name,
        pubkey: newPlayer.pubkey,
        is_admin: false,
        avatar: newPlayer.avatar,
      };

      setUser(userData);
      localStorage.setItem('satoshi_user', JSON.stringify(userData));

      return userData;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * PIN ändern
   */
  const changePin = async (oldPin, newPin) => {
    if (!user) throw new Error('Nicht eingeloggt');

    setIsLoading(true);
    setError('');

    try {
      const pinValidation = validatePin(newPin);
      if (!pinValidation.valid) {
        throw new Error(pinValidation.error);
      }

      const oldHashedPin = await hashPin(oldPin);
      const existingUser = await getPlayerByName(user.name);

      if (existingUser.pin !== oldHashedPin) {
        throw new Error('Alter PIN ist falsch');
      }

      const newHashedPin = await hashPin(newPin);
      await updatePlayer(user.name, { pin: newHashedPin });

      return true;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Avatar aktualisieren
   */
  const updateAvatar = async (avatarUrl) => {
    if (!user) throw new Error('Nicht eingeloggt');

    try {
      await updatePlayer(user.name, { avatar: avatarUrl });
      
      const updatedUser = { ...user, avatar: avatarUrl };
      setUser(updatedUser);
      localStorage.setItem('satoshi_user', JSON.stringify(updatedUser));

      return updatedUser;
    } catch (e) {
      setError(e.message);
      throw e;
    }
  };

  /**
   * Logout
   */
  const logout = () => {
    setUser(null);
    localStorage.clear();
  };

  return {
    user,
    isLoading,
    error,
    login,
    loginWithNostrExtension,
    loginWithAmber,
    completeNostrSetup,
    changePin,
    updateAvatar,
    logout,
    isAuthenticated: !!user,
  };
};
