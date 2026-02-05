import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import { getCryptoPunkAvatar } from '../utils/avatar';
import { ArrowLeft, Bell, Volume2, Lock, Save, Loader2, Camera, ShieldCheck } from 'lucide-react'; 
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { updateUserPin, uploadUserAvatar, fetchUserProfile, createSubmission } from '../services/supabase';

const SettingsView = ({ onBack, onOpenAdmin }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth(); 
  
  // WICHTIG: Die neue DB-Tabelle nutzt 'username', alte Versionen nutzten 'name'.
  // Wir nehmen hier das, was da ist, bevorzugt 'username'.
  const currentUsername = user?.username || user?.name;

  // State
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('satoshi_sound') !== 'false');
  const [notisEnabled, setNotisEnabled] = useState(() => localStorage.getItem('satoshi_notis') !== 'false');
  const [newPin, setNewPin] = useState('');
  const [loadingPin, setLoadingPin] = useState(false);
  const [pinStatus, setPinStatus] = useState('');
  
  // Avatar State
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null); 
  const [uploading, setUploading] = useState(false);

  // Beim Laden prüfen, ob wir schon einen Avatar in der DB haben
  useEffect(() => {
    const loadProfile = async () => {
        if(currentUsername) {
            const { data } = await fetchUserProfile(currentUsername);
            if(data && data.avatar) {
                setAvatarUrl(data.avatar);
            }
        }
    };
    loadProfile();
  }, [currentUsername]);


  // --- HANDLERS ---
  const toggleSound = () => { 
      const v = !soundEnabled; 
      setSoundEnabled(v); 
      localStorage.setItem('satoshi_sound', v); 
  };
  
  const toggleNotis = () => { 
      const v = !notisEnabled; 
      setNotisEnabled(v); 
      localStorage.setItem('satoshi_notis', v); 
  };

  const handleSavePin = async () => { 
      if (newPin.length !== 4) return alert(t('login_error_pin'));
      setLoadingPin(true);
      // Nutzung von currentUsername
      const success = await updateUserPin(currentUsername, newPin);
      setLoadingPin(false);
      if(success) { 
          setPinStatus('success'); 
          setNewPin(''); 
          setTimeout(()=>setPinStatus(''),3000); 
      }
      else setPinStatus('error');
  };

  // AVATAR UPLOAD HANDLER
  const handleAvatarChange = async (event) => {
      try {
          const file = event.target.files[0];
          if (!file) return;

          setUploading(true);
          // Nutzung von currentUsername
          const newUrl = await uploadUserAvatar(currentUsername, file);
          
          if (newUrl) {
              setAvatarUrl(newUrl);
              // Aktualisiere den globalen User state
              if (refreshUser) await refreshUser();
              alert("Profilbild aktualisiert!");
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

  // --- QUESTION SUBMIT FORM ---
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [qText, setQText] = useState('');
  const [opts, setOpts] = useState(['', '', '', '']);
  const [correctIdx, setCorrectIdx] = useState(0);
  const [submittingQ, setSubmittingQ] = useState(false);
  const [questionLang, setQuestionLang] = useState('de');

  const handleOptionChange = (idx, value) => {
    const next = [...opts]; next[idx] = value; setOpts(next);
  };

  const handleSubmitQuestion = async () => {
    if (!qText || opts.some(o => !o)) return alert(t('submit_question_required'));
    setSubmittingQ(true);
    try {
      const { error } = await createSubmission({ 
          submitter: currentUsername, 
          language: questionLang,
          question: qText, 
          options: opts, 
          correct: correctIdx 
      });
      if (error) throw error;
      alert(t('submit_question_success'));
      setShowSubmitModal(false);
      setQText(''); setOpts(['', '', '', '']); setCorrectIdx(0); setQuestionLang('de');
    } catch (e) {
      console.error(e); alert(t('submit_question_error'));
    } finally { setSubmittingQ(false); }
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 mb-6 pt-4">
            <div className="flex items-center gap-4">
              <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
                <ArrowLeft className="text-white" size={20}/>
              </button>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">
                 {t('tile_settings')}
              </h2>
            </div>
            
            {/* ADMIN BUTTON (Nur sichtbar wenn is_admin = true) */}
            {user?.is_admin && (
              <button 
                onClick={onOpenAdmin} 
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg flex items-center gap-2 transition-all active:scale-95"
              >
                <ShieldCheck size={14} />
                Admin
              </button>
            )}
        </div>

        <div className="flex flex-col gap-6">

            {/* --- SEKTION 0: PROFILBILD --- */}
            <div className="flex flex-col items-center justify-center py-4">
                <div className="relative group">
                    {/* Das Bild */}
                    <div className="w-32 h-32 rounded-2xl border-4 border-orange-500 overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.3)] bg-neutral-900">
                        {uploading ? (
                            <div className="w-full h-full flex items-center justify-center bg-black/50">
                                <Loader2 className="animate-spin text-orange-500" size={32}/>
                            </div>
                        ) : (
                            <img 
                                src={avatarUrl || getCryptoPunkAvatar(currentUsername)} 
                                alt="Profil" 
                                className="w-full h-full object-cover"
                            />
                        )}
                    </div>

                    {/* Edit Button */}
                    <label className="absolute -bottom-2 -right-2 bg-white text-black p-2.5 rounded-xl cursor-pointer shadow-lg hover:bg-gray-200 transition-colors border-2 border-[#111]">
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
                <div className="mt-3 text-center">
                    <p className="text-white font-bold text-lg">{currentUsername}</p>
                    <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-widest">Profilbild ändern</p>
                </div>
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
                    {pinStatus === 'error' && <div className="text-red-500 text-xs font-bold text-center">Fehler beim Speichern.</div>}
                </div>
            </div>
            
            {/* SUBMIT QUESTION */}
            {!user?.is_admin && (
              <div className="text-center mt-4">
                <button onClick={() => setShowSubmitModal(true)} className="bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10 px-6 py-3 rounded-xl font-bold text-sm transition-colors">
                    Frage einreichen ✍️
                </button>
              </div>
            )}

            {/* Info Footer */}
            <div className="text-center pb-6 mt-4">
                <p className="text-neutral-600 text-[10px] uppercase font-bold tracking-widest">Satoshi Duell v0.8</p>
                <p className="text-neutral-700 text-[10px]">{currentUsername}</p>
            </div>

            {/* SUBMIT MODAL */}
            {showSubmitModal && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-[#111] border border-white/10 p-6 rounded-2xl w-full max-w-xl animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-white font-black text-xl mb-4">{t('submit_question_title')}</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-neutral-400 uppercase">{t('submit_question_language')}</label>
                      <select value={questionLang} onChange={(e) => setQuestionLang(e.target.value)} className="bg-black/30 border border-white/10 text-white px-3 py-2 rounded-xl text-xs font-bold">
                        <option value="de">DE</option>
                        <option value="en">EN</option>
                        <option value="es">ES</option>
                      </select>
                    </div>
                    <textarea value={qText} onChange={(e) => setQText(e.target.value)} rows={3} placeholder={t('submit_question_placeholder')} className="w-full bg-black/30 border border-white/10 text-white p-3 rounded-xl outline-none focus:border-orange-500" />
                    {opts.map((o, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input 
                            type="radio" 
                            name="correct_answer"
                            checked={correctIdx === i} 
                            onChange={() => setCorrectIdx(i)} 
                            className="accent-orange-500 w-4 h-4"
                        />
                        <input value={o} onChange={(e) => handleOptionChange(i, e.target.value)} placeholder={`${t('submit_question_option')} ${i+1}`} className="flex-1 bg-black/30 border border-white/10 text-white p-3 rounded-xl outline-none focus:border-white/30 text-sm" />
                      </div>
                    ))}
                    <p className="text-neutral-500 text-xs mt-2">{t('submit_question_hint')}</p>
                    <div className="flex items-center gap-2 justify-end mt-4">
                      <button onClick={() => setShowSubmitModal(false)} className="px-4 py-2 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 font-bold text-sm">{t('btn_cancel')}</button>
                      <button onClick={handleSubmitQuestion} disabled={submittingQ} className="px-4 py-2 rounded-xl bg-orange-500 text-black font-bold text-sm hover:bg-orange-400">{submittingQ ? t('submit_question_sending') : t('submit_question_send')}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </Background>
  );
};

export default SettingsView;