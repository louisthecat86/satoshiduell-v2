import React, { useState } from 'react';
import Background from '../components/ui/Background';
import { ArrowLeft, Users } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

const CreateTournamentView = ({ onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1=Basic, 2=Access, 3=Review
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deadlineMode, setDeadlineMode] = useState('deadline'); // deadline | players

  const [form, setForm] = useState({
    name: '',
    description: '',
    maxPlayers: '',
    questionCount: 30,
    prizePool: '',
    accessLevel: 'public',
    playDate: '',
    playTime: '',
    playUntil: '',
    contactInfo: '',
    imageFile: null,
    imagePreview: '',
  });

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateDeadline = (dateValue, timeValue) => {
    if (!dateValue || !timeValue) {
      updateForm('playUntil', '');
      return;
    }
    updateForm('playUntil', `${dateValue}T${timeValue}`);
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
      updateForm('imageFile', null);
      updateForm('imagePreview', '');
      return;
    }

    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    const previewUrl = URL.createObjectURL(file);
    updateForm('imageFile', file);
    updateForm('imagePreview', previewUrl);
  };

  const accessLabel = form.accessLevel === 'token'
    ? t('tournament_access_token')
    : t('tournament_access_public');

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert(t('tournament_error_name'));
      return;
    }
    const hasMaxPlayers = Boolean(form.maxPlayers);
    const hasDeadline = Boolean(form.playUntil);
    if (hasMaxPlayers) {
      const parsedMax = parseInt(form.maxPlayers, 10);
      if (Number.isNaN(parsedMax) || parsedMax < 2) {
        alert(t('tournament_error_players'));
        return;
      }
    }
    if (!form.questionCount || form.questionCount < 1) {
      alert(t('tournament_error_questions'));
      return;
    }
    if (!form.prizePool || Number(form.prizePool) <= 0) {
      alert(t('tournament_prize_pool_required'));
      return;
    }
    if (!hasDeadline && !hasMaxPlayers) {
      alert(t('tournament_error_need_deadline_or_players'));
      return;
    }
    if (deadlineMode === 'deadline' && !hasDeadline) {
      alert(t('tournament_error_deadline'));
      return;
    }
    if (deadlineMode === 'players' && !hasMaxPlayers) {
      alert(t('tournament_error_players'));
      return;
    }
    if (form.accessLevel === 'token' && !form.contactInfo.trim()) {
      alert(t('tournament_error_contact'));
      return;
    }
    if (hasDeadline) {
      const deadline = new Date(form.playUntil);
      if (Number.isNaN(deadline.getTime()) || deadline <= new Date()) {
        alert(t('tournament_error_deadline_future'));
        return;
      }
    }

    if (!user) {
      setSubmitError(t('tournament_error_login'));
      return;
    }

    if (user?.can_create_tournaments === false) {
      setSubmitError(t('tournament_error_permission'));
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);
    const result = await onConfirm(form);
    if (result && result.ok === false) {
      if (result.message === 'LOGIN_REQUIRED') {
        setSubmitError(t('tournament_error_login'));
      } else {
        setSubmitError(t('tournament_error_create'));
      }
    }
    setIsSubmitting(false);
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center gap-4 mb-4">
          <button onClick={onCancel} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20}/>
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-purple-500 uppercase tracking-widest">
              {t('tournament_create_title')}
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              {t('tournament_step', { current: step, total: 3 })}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 mb-6 flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-purple-500' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="flex-1 px-4 pb-24 overflow-y-auto scrollbar-hide">
          {/* STEP 1: BASIC INFO */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_name_label')}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  placeholder={t('tournament_name_placeholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_desc_label')}
                </label>
                <textarea
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  placeholder={t('tournament_desc_placeholder')}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 min-h-[100px]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_deadline_mode_label')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeadlineMode('deadline')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                      deadlineMode === 'deadline'
                        ? 'bg-purple-500 text-black'
                        : 'bg-white/5 text-white'
                    }`}
                  >
                    {t('tournament_deadline_mode_deadline')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeadlineMode('players')}
                    className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                      deadlineMode === 'players'
                        ? 'bg-purple-500 text-black'
                        : 'bg-white/5 text-white'
                    }`}
                  >
                    {t('tournament_deadline_mode_players')}
                  </button>
                </div>
              </div>

              {deadlineMode === 'players' && (
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-2">
                    <Users size={14} /> {t('tournament_max_players_label')}
                  </label>
                  <input
                    type="number"
                    value={form.maxPlayers}
                    onChange={e => updateForm('maxPlayers', e.target.value)}
                    placeholder={t('tournament_max_players_placeholder')}
                    min="2"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_max_players_hint')}</p>
                </div>
              )}

              {deadlineMode === 'deadline' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                      {t('tournament_deadline_date_label')}
                    </label>
                    <input
                      type="date"
                      value={form.playDate}
                      onChange={e => {
                        updateForm('playDate', e.target.value);
                        updateDeadline(e.target.value, form.playTime);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                      {t('tournament_deadline_time_label')}
                    </label>
                    <input
                      type="time"
                      value={form.playTime}
                      onChange={e => {
                        updateForm('playTime', e.target.value);
                        updateDeadline(form.playDate, e.target.value);
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                    />
                  </div>
                  <p className="text-[10px] text-neutral-500 col-span-2">{t('tournament_play_until_hint')}</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_question_count_label')}
                </label>
                <input
                  type="number"
                  value={form.questionCount}
                  onChange={e => updateForm('questionCount', parseInt(e.target.value) || 0)}
                  min="1"
                  max="100"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                />
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_question_count_hint')}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_prize_pool_label')}
                </label>
                <input
                  type="number"
                  value={form.prizePool}
                  onChange={e => updateForm('prizePool', e.target.value)}
                  min="1"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                />
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_prize_pool_required')}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_image_label')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none"
                />
                {form.imagePreview && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                    <img
                      src={form.imagePreview}
                      alt=""
                      className="w-full h-32 object-cover"
                    />
                  </div>
                )}
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_image_hint')}</p>
              </div>
            </div>
          )}

          {/* STEP 2: ACCESS & WINDOW */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_access_label')}
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'public', label: t('tournament_access_public'), desc: t('tournament_access_public_desc') },
                    { value: 'token', label: t('tournament_access_token'), desc: t('tournament_access_token_desc') }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => updateForm('accessLevel', option.value)}
                      className={`w-full p-3 rounded-xl text-left transition-all ${
                        form.accessLevel === option.value
                          ? 'bg-purple-500/20 border-2 border-purple-500'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="font-bold text-sm">{option.label}</div>
                      <div className="text-[10px] text-neutral-400">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {form.accessLevel === 'token' && (
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                    {t('tournament_contact_label')}
                  </label>
                  <input
                    type="text"
                    value={form.contactInfo}
                    onChange={e => updateForm('contactInfo', e.target.value)}
                    placeholder={t('tournament_contact_placeholder')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_contact_hint')}</p>
                </div>
              )}

            </div>
          )}

          {/* STEP 3: REVIEW */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-4">
                <h3 className="text-lg font-black text-white mb-4">{form.name}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_participants')}</span>
                    <p className="text-white font-black">{form.maxPlayers || t('tournament_unlimited')}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_question_count_label')}</span>
                    <p className="text-white font-black">{form.questionCount}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_prize_pool_label')}</span>
                    <p className="text-white font-black">{form.prizePool}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_access_label')}</span>
                    <p className="text-white font-black">{accessLabel}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_play_until_label')}</span>
                    <p className="text-white font-black">
                      {form.playUntil ? new Date(form.playUntil).toLocaleString() : '-'}
                    </p>
                  </div>
                  {form.accessLevel === 'token' && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_contact_label')}</span>
                      <p className="text-white font-black break-words">{form.contactInfo}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-white/10 p-4 max-w-md mx-auto">
          <div className="flex gap-3">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onCancel()}
              className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors"
            >
              {step === 1 ? t('tournament_btn_cancel') : t('tournament_btn_back')}
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 px-4 py-3 bg-purple-500 text-black rounded-xl font-black hover:bg-purple-400 transition-colors"
              >
                {t('tournament_btn_next')}
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-black rounded-xl font-black hover:from-purple-400 hover:to-pink-400 transition-colors disabled:opacity-60"
              >
                {isSubmitting ? t('tournament_btn_creating') : t('tournament_btn_create')}
              </button>
            )}
          </div>
          {submitError && (
            <div className="mt-3 text-center text-xs text-red-400 font-bold">
              {submitError}
            </div>
          )}
        </div>
      </div>
    </Background>
  );
};

export default CreateTournamentView;
