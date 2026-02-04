import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

const NostrSetupView = () => {
  const { t } = useTranslation();
  const { pendingNpub, completeNpubSignup, cancelNpubSignup, loading, error: authError } = useAuth();

  const [username, setUsername] = useState('');
  const [viewError, setViewError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setViewError('');

    if (username.trim().length < 3) {
      setViewError(t('login_error_name'));
      return;
    }

    const success = await completeNpubSignup(username.trim());
    if (!success && !authError) {
      setViewError(t('login_error_taken'));
    }
  };

  if (!pendingNpub) return null;

  const shortNpub = pendingNpub.length > 18
    ? `${pendingNpub.slice(0, 8)}...${pendingNpub.slice(-6)}`
    : pendingNpub;

  return (
    <Background>
      <div className="flex flex-col items-center justify-center min-h-screen text-white">
        <div className="w-full max-w-sm bg-[#1a1a1a]/80 rounded-2xl p-6 border border-white/10 shadow-xl">
          <h2 className="text-2xl font-black uppercase tracking-wide mb-2 text-center">
            {t('nostr_setup_title')}
          </h2>
          <p className="text-xs text-neutral-400 text-center mb-4">
            {t('nostr_setup_text')}
          </p>
          <p className="text-[10px] text-neutral-500 text-center mb-4">
            {shortNpub}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder={t('login_placeholder')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-4 rounded-xl bg-[#0a0a0a] border border-white/10 text-white outline-none focus:border-orange-500 focus:bg-black transition-all font-bold text-center shadow-lg"
            />

            {(viewError || authError) && (
              <p className="text-red-500 text-xs font-bold bg-red-900/20 p-2 rounded">
                {viewError || authError}
              </p>
            )}

            <Button type="submit" variant="primary" disabled={loading} fullWidth className="py-4 text-lg font-black italic tracking-wider">
              {loading ? t('checking') : t('btn_ready')}
            </Button>

            <Button type="button" variant="secondary" onClick={cancelNpubSignup} fullWidth className="py-3 text-xs font-bold">
              {t('btn_cancel')}
            </Button>
          </form>
        </div>
      </div>
    </Background>
  );
};

export default NostrSetupView;
