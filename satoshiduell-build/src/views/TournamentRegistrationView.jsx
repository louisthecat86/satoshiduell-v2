import React, { useState } from 'react';
import Background from '../components/ui/Background';
import { ArrowLeft, Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { registerForTournament, fetchTournamentByInviteCode, fetchTournamentById } from '../services/supabase';
import { SocialIcon } from '../components/ui/SocialIcons';

const TournamentRegistrationView = ({ tournamentId, inviteCode, onBack, onTokenReceived }) => {
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [identityType, setIdentityType] = useState(null);
  const [identityValue, setIdentityValue] = useState('');
  const [step, setStep] = useState('loading');
  const [resultError, setResultError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    const load = async () => {
      let result;
      if (inviteCode) {
        result = await fetchTournamentByInviteCode(inviteCode);
      } else if (tournamentId) {
        result = await fetchTournamentById(tournamentId);
      }
      if (result?.data) {
        setTournament(result.data);
        setStep('select');
      } else {
        setStep('error');
      }
    };
    load();
  }, [tournamentId, inviteCode]);

  const identityOptions = [
    { type: 'nostr', label: 'Nostr (npub)', desc: 'Automatische Turnier-Benachrichtigungen via Nostr', placeholder: 'npub1...', hasNotifications: true },
    { type: 'telegram', label: 'Telegram', desc: 'Dein Telegram-Handle', placeholder: '@dein_handle' },
    { type: 'twitter', label: 'X / Twitter', desc: 'Dein X/Twitter-Handle', placeholder: '@dein_handle' },
    { type: 'email', label: 'E-Mail', desc: 'Deine E-Mail-Adresse', placeholder: 'name@example.com' },
  ];

  const handleSelectIdentity = (type) => {
    setIdentityType(type);
    setIdentityValue('');
    setResultError('');
    if (type === 'nostr' && user?.npub) setIdentityValue(user.npub);
    setStep('input');
  };

  const handleSubmitRegistration = async () => {
    if (!identityValue.trim()) { setResultError('Bitte ausfüllen'); return; }
    if (identityType === 'nostr' && !identityValue.startsWith('npub')) { setResultError('Bitte eine gültige npub eingeben'); return; }

    setSubmitting(true);
    setResultError('');

    const isVerified = identityType === 'nostr' && user?.npub && identityValue.toLowerCase() === user.npub.toLowerCase();

    const { data, error } = await registerForTournament(
      tournament.id,
      identityType,
      identityValue.trim(),
      isVerified,
      user?.username || null
    );

    setSubmitting(false);

    if (error) { setResultError(error.message || 'Fehler bei der Registrierung'); return; }
    setStep('pending');
  };

  if (step === 'loading') {
    return (
      <Background>
        <div className="flex items-center justify-center h-full">
          <div className="text-neutral-500 text-sm">Lade Turnier...</div>
        </div>
      </Background>
    );
  }

  if (step === 'error') {
    return (
      <Background>
        <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
          <AlertCircle size={48} className="text-red-400" />
          <h2 className="text-lg font-bold text-white">Turnier nicht gefunden</h2>
          <p className="text-sm text-neutral-400 text-center">Der Einladungscode ist ungültig oder das Turnier existiert nicht mehr.</p>
          <button onClick={onBack} className="mt-4 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors">Zurück</button>
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center gap-4 mb-4">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-black text-purple-500 uppercase tracking-widest">Registrieren</h2>
            <p className="text-xs text-neutral-400 mt-1">{tournament?.name}</p>
          </div>
        </div>

        {/* Turnier-Info */}
        {tournament && step !== 'pending' && (
          <div className="px-4 mb-6">
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <h3 className="text-white font-black text-lg mb-2">{tournament.name}</h3>
              {tournament.description && <p className="text-xs text-neutral-400 mb-3">{tournament.description}</p>}
              {tournament.sponsor_name && (
                <p className="text-xs text-neutral-300">Veranstalter: <span className="font-bold text-white">{tournament.sponsor_name}</span></p>
              )}
              <div className="flex gap-4 mt-3 text-[10px] text-neutral-400">
                <span>Format: <span className="text-white font-bold">{tournament.format === 'bracket' ? 'Bracket' : 'Highscore'}</span></span>
                <span>Teilnehmer: <span className="text-white font-bold">{tournament.current_participants}{tournament.max_players ? `/${tournament.max_players}` : ''}</span></span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 px-4">

          {/* ===== STEP: SELECT IDENTITY ===== */}
          {step === 'select' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-6">
                <Shield size={40} className="text-purple-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Kontaktweg hinterlegen</h3>
                <p className="text-sm text-neutral-400">
                  Wähle wie dich der Veranstalter kontaktieren soll.
                </p>
              </div>

              {/* Nostr-Hinweis */}
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 flex items-start gap-2">
                <SocialIcon type="nostr" size={16} />
                <p className="text-[10px] text-purple-300">
                  <span className="font-bold">Tipp:</span> Nur bei Registrierung mit Nostr (npub) wirst du automatisch über den Turnierstand benachrichtigt — direkt in deinem Nostr-Client.
                </p>
              </div>

              <div className="space-y-3">
                {identityOptions.map(option => (
                  <button key={option.type} onClick={() => handleSelectIdentity(option.type)}
                    className={`w-full p-4 rounded-xl border bg-white/5 hover:bg-white/10 transition-all text-left flex items-start gap-3 ${
                      option.hasNotifications ? 'border-purple-500/30 hover:border-purple-500/50' : 'border-white/10 hover:border-white/20'
                    }`}>
                    <div className="mt-1 flex-shrink-0">
                      <SocialIcon type={option.type} size={24} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{option.label}</span>
                        {option.hasNotifications && (
                          <span className="text-[8px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded-full font-bold">🔔 BENACHRICHTIGUNGEN</span>
                        )}
                      </div>
                      <div className="text-[10px] text-neutral-400 mt-1">{option.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP: INPUT VALUE ===== */}
          {step === 'input' && identityType && (
            <div className="space-y-4 animate-in fade-in">
              {(() => {
                const option = identityOptions.find(o => o.type === identityType);
                return (
                  <>
                    <div className="text-center mb-4">
                      <div className="flex justify-center mb-3">
                        <SocialIcon type={identityType} size={40} />
                      </div>
                      <h3 className="text-lg font-bold text-white mt-2">{option.label}</h3>
                    </div>
                    <input type="text" value={identityValue} onChange={e => setIdentityValue(e.target.value)}
                      placeholder={option.placeholder} autoFocus
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-center text-lg outline-none focus:border-purple-500/50 transition-colors font-mono" />
                    {identityType === 'nostr' && user?.npub && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                        <p className="text-xs text-green-400 font-bold">✓ npub aus deinem Profil erkannt</p>
                      </div>
                    )}
                    {identityType === 'nostr' && (
                      <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                        <p className="text-xs text-purple-300">
                          🔔 Du wirst automatisch über Nostr benachrichtigt wenn dein Match ansteht, eine neue Runde startet oder das Turnier beendet ist.
                        </p>
                      </div>
                    )}
                    {identityType !== 'nostr' && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                        <p className="text-xs text-yellow-300">
                          Der Veranstalter sieht diese Kontaktinfo um dich zu erreichen. Bitte gib korrekte Daten an. Automatische Turnier-Benachrichtigungen gibt es nur bei Anmeldung mit Nostr.
                        </p>
                      </div>
                    )}
                    {resultError && <div className="text-center text-xs text-red-400 font-bold p-2">{resultError}</div>}
                    <div className="flex gap-3 mt-4">
                      <button onClick={() => { setStep('select'); setResultError(''); }}
                        className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors">Zurück</button>
                      <button onClick={handleSubmitRegistration} disabled={submitting || !identityValue.trim()}
                        className="flex-1 px-4 py-3 bg-purple-500 text-black rounded-xl font-black hover:bg-purple-400 transition-colors disabled:opacity-60">
                        {submitting ? 'Registriere...' : 'Registrieren'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ===== STEP: PENDING ===== */}
          {step === 'pending' && (
            <div className="space-y-4 animate-in fade-in text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500">
                <Shield size={36} className="text-green-400" />
              </div>
              <h3 className="text-xl font-black text-white">Registrierung erfolgreich!</h3>
              <p className="text-sm text-neutral-400">
                Deine Anmeldung ist beim Veranstalter eingegangen. Sobald er dich genehmigt, wirst du automatisch dem Turnier hinzugefügt.
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left">
                <p className="text-[10px] text-neutral-500 uppercase font-bold mb-2">So geht es weiter</p>
                <div className="space-y-2 text-xs text-neutral-300">
                  <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">1.</span><span>Der Veranstalter prüft deine Anmeldung</span></div>
                  <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">2.</span><span>Bei Genehmigung wirst du automatisch ins Turnier aufgenommen</span></div>
                  <div className="flex items-start gap-2"><span className="text-purple-400 font-bold">3.</span><span>Öffne das Turnier in der Übersicht um deinen Status zu sehen</span></div>
                </div>
              </div>
              {identityType === 'nostr' && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                  <p className="text-xs text-purple-300">🔔 Du wirst über Nostr benachrichtigt wenn es losgeht.</p>
                </div>
              )}
              {tournament?.contact_info && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 mb-1">Kontakt des Veranstalters:</p>
                  <p className="text-sm text-white font-bold">{tournament.contact_info}</p>
                </div>
              )}
              <button onClick={onBack}
                className="mt-4 w-full px-6 py-3 bg-purple-500 text-black rounded-xl font-black hover:bg-purple-400 transition-colors">
                Zurück zur Übersicht
              </button>
            </div>
          )}
        </div>
      </div>
    </Background>
  );
};

export default TournamentRegistrationView;