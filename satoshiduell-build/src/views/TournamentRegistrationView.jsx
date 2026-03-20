import React, { useState } from 'react';
import Background from '../components/ui/Background';
import { ArrowLeft, Shield, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';
import { registerForTournament, redeemRegistrationToken, fetchTournamentByInviteCode, fetchTournamentById } from '../services/supabase';

const TournamentRegistrationView = ({ tournamentId, inviteCode, onBack, onTokenReceived }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [identityType, setIdentityType] = useState(null);
  const [identityValue, setIdentityValue] = useState('');
  const [step, setStep] = useState('loading'); // loading, select, input, result
  const [resultToken, setResultToken] = useState(null);
  const [resultError, setResultError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Turnier laden
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
      setLoading(false);
    };
    load();
  }, [tournamentId, inviteCode]);

  const identityOptions = [
    {
      type: 'nostr',
      icon: '🔑',
      label: 'Nostr (npub)',
      desc: 'Kryptographisch verifiziert via Amber/NIP-55',
      placeholder: 'npub1...',
      verifiable: true,
    },
    {
      type: 'telegram',
      icon: '✈️',
      label: 'Telegram',
      desc: 'Dein Telegram-Handle',
      placeholder: '@dein_handle',
      verifiable: false,
    },
    {
      type: 'twitter',
      icon: '🐦',
      label: 'X / Twitter',
      desc: 'Dein X/Twitter-Handle',
      placeholder: '@dein_handle',
      verifiable: false,
    },
  ];

  const handleSelectIdentity = (type) => {
    setIdentityType(type);
    setIdentityValue('');
    setResultError('');

    // Nostr: Automatisch npub aus Profil nehmen wenn vorhanden
    if (type === 'nostr' && user?.npub) {
      setIdentityValue(user.npub);
    }

    setStep('input');
  };

  const handleSubmit = async () => {
    if (!identityValue.trim()) {
      setResultError('Bitte ausfüllen');
      return;
    }

    if (identityType === 'nostr' && !identityValue.startsWith('npub')) {
      setResultError('Bitte eine gültige npub eingeben');
      return;
    }

    setSubmitting(true);
    setResultError('');

    const isVerified = identityType === 'nostr' && user?.npub
      && identityValue.toLowerCase() === user.npub.toLowerCase();

    const { data, error, token } = await registerForTournament(
      tournament.id,
      identityType,
      identityValue.trim(),
      isVerified
    );

    setSubmitting(false);

    if (error) {
      setResultError(error.message || 'Fehler bei der Registrierung');
      return;
    }

    if (token) {
      // Token sofort einlösen (nur bei auto-approve / public)
      if (user?.username) {
        const { data: joinData, error: joinError } = await redeemRegistrationToken(
          tournament.id, token, user.username
        );
        if (!joinError && joinData) {
          setStep('success');
          setTimeout(() => {
            if (onTokenReceived) onTokenReceived(tournament.id, token);
          }, 1500);
          return;
        }
      }
      // Fallback: Token anzeigen
      setResultToken(token);
      setStep('result');
    } else if (data?.status === 'pending') {
    } else {
      setResultError('Registrierung eingegangen, aber kein Token erhalten. Bitte kontaktiere den Veranstalter.');
    }
  };

  const handleCopyAndContinue = () => {
    if (resultToken) {
      navigator.clipboard.writeText(resultToken);
    }
    if (onTokenReceived) {
      onTokenReceived(tournament.id, resultToken);
    }
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
          <p className="text-sm text-neutral-400 text-center">
            Der Einladungscode ist ungültig oder das Turnier existiert nicht mehr.
          </p>
          <button
            onClick={onBack}
            className="mt-4 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
          >
            Zurück
          </button>
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center gap-4 mb-6">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20}/>
          </button>
          <div className="flex-1">
            <h2 className="text-lg font-black text-purple-500 uppercase tracking-widest">
              Turnier beitreten
            </h2>
            <p className="text-xs text-neutral-400 mt-1">{tournament?.name}</p>
          </div>
        </div>

        <div className="flex-1 px-4">

          {/* ===== STEP: SELECT IDENTITY TYPE ===== */}
          {step === 'select' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-center mb-6">
                <Shield size={40} className="text-purple-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-2">Identität bestätigen</h3>
                <p className="text-sm text-neutral-400">
                  Wähle eine Methode um dich zu identifizieren. Jede Identität kann nur einmal an diesem Turnier teilnehmen.
                </p>
              </div>

              <div className="space-y-3">
                {identityOptions.map(option => (
                  <button
                    key={option.type}
                    onClick={() => handleSelectIdentity(option.type)}
                    className="w-full p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/30 transition-all text-left flex items-start gap-3"
                  >
                    <span className="text-2xl mt-0.5">{option.icon}</span>
                    <div>
                      <div className="text-sm font-bold text-white">{option.label}</div>
                      <div className="text-[10px] text-neutral-400 mt-1">{option.desc}</div>
                      {option.verifiable && (
                        <div className="text-[10px] text-green-400 mt-1 font-bold">
                          ✓ Kryptographisch verifizierbar
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ===== STEP: INPUT IDENTITY VALUE ===== */}
          {step === 'input' && identityType && (
            <div className="space-y-4 animate-in fade-in">
              {(() => {
                const option = identityOptions.find(o => o.type === identityType);
                return (
                  <>
                    <div className="text-center mb-4">
                      <span className="text-4xl">{option.icon}</span>
                      <h3 className="text-lg font-bold text-white mt-2">{option.label}</h3>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={identityValue}
                        onChange={e => setIdentityValue(e.target.value)}
                        placeholder={option.placeholder}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white text-center text-lg outline-none focus:border-purple-500/50 transition-colors font-mono"
                        autoFocus
                      />
                    </div>

                    {identityType === 'nostr' && user?.npub && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 text-center">
                        <p className="text-xs text-green-400 font-bold">
                          ✓ npub aus deinem Profil erkannt
                        </p>
                      </div>
                    )}

                    {identityType !== 'nostr' && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                        <p className="text-xs text-yellow-300">
                          Hinweis: Der Veranstalter sieht diesen Handle und kontaktiert dich darüber für die Preisübergabe. Bitte gib einen korrekten Handle an.
                        </p>
                      </div>
                    )}

                    {resultError && (
                      <div className="text-center text-xs text-red-400 font-bold p-2">{resultError}</div>
                    )}

                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => { setStep('select'); setResultError(''); }}
                        className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors"
                      >
                        Zurück
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={submitting || !identityValue.trim()}
                        className="flex-1 px-4 py-3 bg-purple-500 text-black rounded-xl font-black hover:bg-purple-400 transition-colors disabled:opacity-60"
                      >
                        {submitting ? 'Registriere...' : 'Registrieren'}
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* ===== STEP: TOKEN RESULT ===== */}
          {step === 'result' && resultToken && (
            <div className="space-y-4 animate-in fade-in text-center">
              <CheckCircle2 size={64} className="text-green-400 mx-auto" />
              <h3 className="text-xl font-black text-white">Registrierung erfolgreich!</h3>
              <p className="text-sm text-neutral-400">
                Dein persönlicher Teilnahme-Token:
              </p>

              <div className="bg-black/40 border border-green-500/30 rounded-xl p-4">
                <div className="font-mono text-lg text-green-300 break-all">{resultToken}</div>
              </div>

              <p className="text-xs text-neutral-500">
                Gib diesen Token auf der Turnier-Seite ein um beizutreten. Jeder Token kann nur einmal verwendet werden.
              </p>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resultToken);
                    alert('Token kopiert!');
                  }}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2"
                >
                  <Copy size={16} /> Kopieren
                </button>
                <button
                  onClick={handleCopyAndContinue}
                  className="flex-1 px-4 py-3 bg-green-500 text-black rounded-xl font-black hover:bg-green-400 transition-colors"
                >
                  Zum Turnier
                </button>
              </div>
            </div>
          )}

          {/* ===== STEP: AUTO-JOIN SUCCESS ===== */}
          {step === 'success' && (
            <div className="space-y-4 animate-in fade-in text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-green-500">
                <CheckCircle2 size={40} className="text-green-400" />
              </div>
              <h3 className="text-xl font-black text-white">Du bist dabei!</h3>
              <p className="text-sm text-neutral-400">
                Du wurdest erfolgreich zum Turnier hinzugefügt.
              </p>
            </div>
          )}

          {/* ===== STEP: PENDING APPROVAL ===== */}
          {step === 'pending' && (
            <div className="space-y-4 animate-in fade-in text-center">
              <div className="w-20 h-20 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto border-2 border-orange-500">
                <Shield size={36} className="text-orange-400" />
              </div>
              <h3 className="text-xl font-black text-white">Registrierung eingegangen</h3>
              <p className="text-sm text-neutral-400">
                Deine Anmeldung muss noch vom Veranstalter genehmigt werden. Du erhältst deinen Token sobald die Genehmigung erteilt wurde.
              </p>
              {tournament?.contact_info && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-neutral-500 mb-1">Kontakt des Veranstalters:</p>
                  <p className="text-sm text-white font-bold">{tournament.contact_info}</p>
                </div>
              )}
              <button
                onClick={onBack}
                className="mt-6 px-6 py-3 bg-white/10 text-white rounded-xl font-bold hover:bg-white/20 transition-colors"
              >
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
