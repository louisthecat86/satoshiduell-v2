import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import { ArrowLeft, Bell, Volume2, Lock, Save, Loader2, CheckCircle2, Camera, User } from 'lucide-react'; // Camera & User Icons
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { updateUserPin, uploadUserAvatar, fetchUserProfile } from '../services/supabase'; // fetchUserProfile importieren (oder getUser)

const SettingsView = ({ onBack }) => {
  const { t } = useTranslation();
  const { user } = useAuth(); // User Objekt aus Auth
  
  // State
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('satoshi_sound') !== 'false');
  const [notisEnabled, setNotisEnabled] = useState(() => localStorage.getItem('satoshi_notis') !== 'false');
  const [newPin, setNewPin] = useState('');
  const [loadingPin, setLoadingPin] = useState(false);
  const [pinStatus, setPinStatus] = useState('');
  
  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null); 
  const [uploading, setUploading] = useState(false);

  // Beim Laden prüfen, ob wir schon einen Avatar in der DB haben (falls useAuth den nicht aktuell hat)
  useEffect(() => {
    const loadProfile = async () => {
        if(user?.name) {
            // Wir nutzen hier eine einfache Abfrage, falls du fetchUserProfile hast, nimm die.
            // Sonst hier direkt:
            const { data } = await fetchUserProfile(user.name); // Annahme: Du hast so eine Funktion, sonst direkt supabase query
            if(data && data.avatar) {
                setAvatarUrl(data.avatar);
            }
        }
    };
    loadProfile();
  }, [user]);


  // --- HANDLERS ---
  const toggleSound = () => { /* ... wie gehabt ... */ const v = !soundEnabled; setSoundEnabled(v); localStorage.setItem('satoshi_sound', v); };
  const toggleNotis = () => { /* ... wie gehabt ... */ const v = !notisEnabled; setNotisEnabled(v); localStorage.setItem('satoshi_notis', v); };

  const handleSavePin = async () => { /* ... wie gehabt ... */ 
      if (newPin.length !== 4) return alert(t('login_error_pin'));
      setLoadingPin(true);
      const success = await updateUserPin(user.name, newPin);
      setLoadingPin(false);
      if(success) { setPinStatus('success'); setNewPin(''); setTimeout(()=>setPinStatus(''),3000); }
      else setPinStatus('error');
  };

  // AVATAR UPLOAD HANDLER
  const handleAvatarChange = async (event) => {
      try {
          const file = event.target.files[0];
          if (!file) return;

          setUploading(true);
          const newUrl = await uploadUserAvatar(user.name, file);
          
          if (newUrl) {
              setAvatarUrl(newUrl);
              // Optional: Ein Reload erzwingen oder User-Context updaten, damit Dashboard es sofort sieht
              alert("Profilbild aktualisiert! (Ggf. App neu laden)");
          } else {
              alert("Fehler beim Hochladen.");
          }
      } catch (e) {
          console.error(e);
          alert("Upload Fehler");
      } finally {
          setUploading(false);
      }
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6 pt-4">
            <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="text-white" size={20}/>
            </button>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">
               {t('tile_settings')}
            </h2>
        </div>

        <div className="flex flex-col gap-6">

            {/* --- SEKTION 0: PROFILBILD (NEU) --- */}
            <div className="flex flex-col items-center justify-center py-4">
                <div className="relative group">
                    {/* Das Bild */}
                    <div className="w-32 h-32 rounded-full border-4 border-orange-500 overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.3)] bg-neutral-900">
                        {uploading ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/50">
                                <Loader2 className="animate-spin text-orange-500" size={32}/>
                            </div>
                        ) : (
                            <img 
                                // WENN AvatarUrl existiert, nimm die, SONST Dicebear
                                src={avatarUrl || `https://api.dicebear.com/9.x/avataaars/svg?seed=${user?.name}`} 
                                alt="Profil" 
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    {/* Edit Button (Kamera Icon) */}
                    <label className="absolute bottom-0 right-0 bg-white text-black p-2 rounded-full cursor-pointer shadow-lg hover:bg-gray-200 transition-colors border-4 border-[#111]">
                        <Camera size={18} />
                        <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={handleAvatarChange}
                            disabled={uploading}
                        />
                    </label>
                </div>
                <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-4">Profilbild ändern</p>
            </div>

            {/* --- SEKTION 1: ALLGEMEIN --- */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-4 ml-1">{t('settings_general')}</h3>
                
                {/* Sound Toggle */}
                <div className="flex items-center justify-between mb-4 p-2">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${soundEnabled ? 'bg-orange-500/20 text-orange-500' : 'bg-neutral-800 text-neutral-500'}`}><Volume2 size={20} /></div>
                        <span className="font-bold text-white text-sm">{t('settings_sound')}</span>
                    </div>
                    <button onClick={toggleSound} className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${soundEnabled ? 'bg-orange-500 justify-end' : 'bg-neutral-700 justify-start'}`}><div className="w-4 h-4 bg-white rounded-full shadow-md"></div></button>
                </div>

                {/* Noti Toggle */}
                <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${notisEnabled ? 'bg-blue-500/20 text-blue-500' : 'bg-neutral-800 text-neutral-500'}`}><Bell size={20} /></div>
                        <div className="flex flex-col">
                            <span className="font-bold text-white text-sm">{t('settings_notifications')}</span>
                            <span className="text-[10px] text-neutral-500">{t('settings_notifications_desc')}</span>
                        </div>
                    </div>
                    <button onClick={toggleNotis} className={`w-12 h-6 rounded-full p-1 transition-colors flex items-center ${notisEnabled ? 'bg-blue-500 justify-end' : 'bg-neutral-700 justify-start'}`}><div className="w-4 h-4 bg-white rounded-full shadow-md"></div></button>
                </div>
            </div>

            {/* --- SEKTION 2: SICHERHEIT --- */}
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
                <h3 className="text-neutral-500 font-bold text-xs uppercase tracking-widest mb-4 ml-1">{t('settings_security')}</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 rounded-full bg-red-500/10 text-red-500"><Lock size={20} /></div>
                        <span className="font-bold text-white text-sm">{t('settings_change_pin')}</span>
                    </div>
                    <div className="flex gap-2">
                        <input type="tel" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Neue PIN" className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-mono font-bold outline-none focus:border-orange-500 transition-colors"/>
                        <button onClick={handleSavePin} disabled={loadingPin || newPin.length !== 4} className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white p-3 rounded-xl transition-colors">{loadingPin ? <Loader2 className="animate-spin" size={20}/> : <Save size={20}/>}</button>
                    </div>
                    {pinStatus === 'success' && <div className="text-green-500 text-xs font-bold text-center">{t('settings_saved')}</div>}
                    {pinStatus === 'error' && <div className="text-red-500 text-xs font-bold text-center">Fehler.</div>}
                </div>
            </div>
            
            {/* Info Footer */}
            <div className="text-center pb-6">
                <p className="text-neutral-600 text-[10px] uppercase font-bold tracking-widest">Satoshi Duell v0.8</p>
                <p className="text-neutral-700 text-[10px]">{user?.name}</p>
            </div>
        </div>
      </div>
    </Background>
  );
};

export default SettingsView;