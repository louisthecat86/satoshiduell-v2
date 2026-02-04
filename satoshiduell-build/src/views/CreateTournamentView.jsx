import React, { useState } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Users, Coins, HelpCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

const CreateTournamentView = ({ onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1=Basic, 2=Format, 3=Rules, 4=Review
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [form, setForm] = useState({
    // Basic
    name: '',
    description: '',
    maxPlayers: 16,
    entryFee: 0,
    prizePool: 10000,
    
    // Access
    accessLevel: 'public', // public, private, friends
    
    // Format
    questionsPerRound: {
      round1: 3,
      round2: 4,
      semifinals: 5,
      final: 6
    },
    
    // Rules
    matchDeadline: 24, // Stunden bis Match gespielt sein muss
    noShowPenalty: 'loss', // loss, disqualify
    lateJoinAllowed: true,
    maxWaitingTime: 48 // Stunden vor Disqualifikation bei Nicht-Teilnahme
  });

  const updateForm = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const updateQuestionsPerRound = (round, value) => {
    setForm(prev => ({
      ...prev,
      questionsPerRound: { ...prev.questionsPerRound, [round]: parseInt(value) }
    }));
  };

  // OPTION A: Berechnung
  const potentialRevenue = form.entryFee * form.maxPlayers;
  const creatorProfit = potentialRevenue; // Entry Fees gehen zurück an Creator

  const handleCreate = async () => {
    if (!form.name.trim()) {
      alert(t('tournament_error_name'));
      return;
    }
    if (form.maxPlayers < 2 || ![2, 4, 8, 16, 32, 64, 128].includes(form.maxPlayers)) {
      alert(t('tournament_error_players'));
      return;
    }
    if (form.entryFee < 0) {
      alert(t('tournament_error_entry_fee'));
      return;
    }
    if (form.prizePool <= 0) {
      alert(t('tournament_error_prize_pool'));
      return;
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
              {t('tournament_step', { current: step, total: 4 })}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 mb-6 flex gap-2">
          {[1, 2, 3, 4].map(s => (
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
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-2">
                  <Users size={14} /> {t('tournament_max_players_label')}
                </label>
                <select
                  value={form.maxPlayers}
                  onChange={e => updateForm('maxPlayers', parseInt(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                >
                  {[2, 4, 8, 16, 32, 64, 128].map(n => (
                    <option key={n} value={n}>{n} {t('tournament_participants')}</option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_max_players_hint')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                    {t('tournament_entry_fee_label')}
                  </label>
                  <input
                    type="number"
                    value={form.entryFee}
                    onChange={e => updateForm('entryFee', parseInt(e.target.value) || 0)}
                    min="0"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_entry_fee_hint')}</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                    {t('tournament_prize_pool_label')}
                  </label>
                  <input
                    type="number"
                    value={form.prizePool}
                    onChange={e => updateForm('prizePool', parseInt(e.target.value) || 0)}
                    min="1"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>

              {/* OPTION A: Berechnung & Preview */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4 text-[11px] space-y-2">
                <p className="font-bold text-purple-300 flex items-center gap-2">
                  <Coins size={14} /> {t('tournament_prize_info_title')}
                </p>
                <div className="space-y-1 text-white">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">{t('tournament_prize_you_pay')}:</span>
                    <span className="font-bold text-orange-400">{form.prizePool.toLocaleString()} Sats</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">{t('tournament_prize_total_entry')}:</span>
                    <span className="font-bold">{potentialRevenue.toLocaleString()} Sats</span>
                  </div>
                  <div className="h-px bg-white/10 my-1" />
                  <div className="flex justify-between">
                    <span className="text-neutral-400">{t('tournament_prize_your_profit')}:</span>
                    <span className="font-bold text-green-400 flex items-center gap-1">
                      <TrendingUp size={12} />
                      {creatorProfit.toLocaleString()} Sats
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FORMAT */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-2">
                  {t('tournament_access_label')}
                </label>
                <div className="space-y-2">
                  {[
                    { value: 'public', label: t('tournament_access_public'), desc: t('tournament_access_public_desc') },
                    { value: 'friends', label: t('tournament_access_friends'), desc: t('tournament_access_friends_desc') },
                    { value: 'private', label: t('tournament_access_private'), desc: t('tournament_access_private_desc') }
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

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-3 block">
                  {t('tournament_questions_label')}
                </label>
                <div className="space-y-3">
                  {[
                    { key: 'round1', label: t('tournament_round_1') },
                    { key: 'round2', label: t('tournament_round_2') },
                    { key: 'semifinals', label: t('tournament_semifinals') },
                    { key: 'final', label: t('tournament_final') }
                  ].map(round => (
                    <div key={round.key} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                      <span className="text-sm font-bold">{round.label}</span>
                      <input
                        type="number"
                        value={form.questionsPerRound[round.key]}
                        onChange={e => updateQuestionsPerRound(round.key, e.target.value)}
                        min="1"
                        max="10"
                        className="w-16 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-center outline-none"
                      />
                      <span className="text-[10px] text-neutral-500">{t('admin_questions_tab')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RULES */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_match_deadline_label')}
                </label>
                <select
                  value={form.matchDeadline}
                  onChange={e => updateForm('matchDeadline', parseInt(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                >
                  {[6, 12, 24, 48, 72].map(h => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_match_deadline_hint')}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-2">
                  <AlertCircle size={14} /> {t('tournament_no_show_label')}
                </label>
                <select
                  value={form.noShowPenalty}
                  onChange={e => updateForm('noShowPenalty', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                >
                  <option value="loss">{t('tournament_no_show_loss')}</option>
                  <option value="disqualify">{t('tournament_no_show_disqualify')}</option>
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_no_show_hint')}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block">
                  {t('tournament_max_waiting_label')}
                </label>
                <select
                  value={form.maxWaitingTime}
                  onChange={e => updateForm('maxWaitingTime', parseInt(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50"
                >
                  {[12, 24, 36, 48, 72].map(h => (
                    <option key={h} value={h}>{h}h</option>
                  ))}
                </select>
                <p className="text-[10px] text-neutral-500 mt-1">{t('tournament_max_waiting_hint')}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase mb-2 block flex items-center gap-2">
                  <HelpCircle size={14} /> {t('tournament_late_join_label')}
                </label>
                <div className="flex gap-2">
                  {[true, false].map(val => (
                    <button
                      key={String(val)}
                      onClick={() => updateForm('lateJoinAllowed', val)}
                      className={`flex-1 p-2 rounded-lg text-sm font-bold transition-all ${
                        form.lateJoinAllowed === val
                          ? 'bg-purple-500 text-black'
                          : 'bg-white/10 text-white'
                      }`}
                    >
                      {val ? t('tournament_late_join_allow') : t('tournament_late_join_deny')}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-500 mt-2">
                  {form.lateJoinAllowed ? t('tournament_late_join_hint_yes') : t('tournament_late_join_hint_no')}
                </p>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-[10px] text-yellow-300 space-y-1">
                <p className="font-bold">{t('tournament_rules_overview')}</p>
                <p>• {t('tournament_rule_deadline')}: {form.matchDeadline}h</p>
                <p>• {t('tournament_rule_no_show')}: {form.noShowPenalty === 'loss' ? t('tournament_no_show_loss').split(' ')[1] : t('tournament_no_show_disqualify').split(' ')[1]}</p>
                <p>• {t('tournament_rule_waiting')}: {form.maxWaitingTime}h</p>
                <p>• {t('tournament_rule_late_join')}: {form.lateJoinAllowed ? t('yes') : t('no')}</p>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-4">
                <h3 className="text-lg font-black text-white mb-4">{form.name}</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_participants')}</span>
                      <p className="text-white font-black">{form.maxPlayers}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_entry_fee_label')}</span>
                      <p className="text-white font-black">{form.entryFee} Sats</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_prize_pool_label')}</span>
                      <p className="text-yellow-400 font-black">{form.prizePool.toLocaleString()} Sats</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold">{t('tournament_access_label')}</span>
                      <p className="text-white font-black capitalize">{form.accessLevel}</p>
                    </div>
                  </div>
                </div>

                {/* Profit Preview */}
                <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="text-[10px] text-neutral-400 mb-1">{t('tournament_prize_your_profit')}</div>
                  <div className="text-lg font-black text-green-400">{creatorProfit.toLocaleString()} Sats</div>
                  <div className="text-[9px] text-neutral-500 mt-1">
                    {form.maxPlayers} × {form.entryFee} Sats Entry Fee
                  </div>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="text-[10px] font-bold text-neutral-400 uppercase">{t('tournament_step_format')}</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { label: t('tournament_round_1'), val: form.questionsPerRound.round1 },
                    { label: t('tournament_round_2'), val: form.questionsPerRound.round2 },
                    { label: t('tournament_semifinals'), val: form.questionsPerRound.semifinals },
                    { label: t('tournament_final'), val: form.questionsPerRound.final }
                  ].map(r => (
                    <div key={r.label} className="flex justify-between">
                      <span className="text-neutral-400">{r.label}:</span>
                      <span className="text-white font-bold">{r.val} Q.</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2">
                <div className="text-[10px] font-bold text-neutral-400 uppercase mb-3">{t('tournament_step_rules')}</div>
                <div className="space-y-1 text-[10px]">
                  <p>⏱️ {t('tournament_rule_deadline')}: <span className="text-white font-bold">{form.matchDeadline}h</span></p>
                  <p>⚠️ {t('tournament_rule_no_show')}: <span className="text-white font-bold">{form.noShowPenalty === 'loss' ? t('tournament_no_show_loss').split(' - ')[0].replace('🎯 ', '') : t('tournament_no_show_disqualify').split(' - ')[0].replace('❌ ', '')}</span></p>
                  <p>⏰ {t('tournament_rule_waiting')}: <span className="text-white font-bold">{form.maxWaitingTime}h</span></p>
                  <p>📝 {t('tournament_rule_late_join')}: <span className="text-white font-bold">{form.lateJoinAllowed ? t('tournament_late_join_allow').replace('✓ ', '') : t('tournament_late_join_deny').replace('✗ ', '')}</span></p>
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
            {step < 4 ? (
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
