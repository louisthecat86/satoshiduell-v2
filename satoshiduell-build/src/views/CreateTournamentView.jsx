import React, { useState } from 'react';
import Background from '../components/ui/Background';
import { ArrowLeft, Users, Trophy, Crown, Plus, Trash2, Gift, LayoutGrid } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const CreateTournamentView = ({ onCancel, onConfirm }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    // Step 1: Format & Basics
    format: 'highscore',
    name: '',
    description: '',
    imageFile: null,
    imagePreview: '',

    // Step 2: Config
    questionCount: 10,
    maxPlayers: '',
    playDate: '',
    playTime: '',
    playUntil: '',
    deadlineMode: 'deadline',
    roundDeadlineHours: 24,
    questionsPerRound: null,
    contactInfo: '',

    // Step 3: Prizes
    prizes: [{ title: '', description: '' }],

    // Step 4: Sponsor & Review
    sponsorName: '',
    sponsorUrl: '',
  });

  const TOTAL_STEPS = 4;

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

  const addPrize = () => {
    setForm(prev => ({
      ...prev,
      prizes: [...prev.prizes, { title: '', description: '' }],
    }));
  };

  const removePrize = (index) => {
    if (form.prizes.length <= 1) return;
    setForm(prev => ({
      ...prev,
      prizes: prev.prizes.filter((_, i) => i !== index),
    }));
  };

  const updatePrize = (index, key, value) => {
    setForm(prev => ({
      ...prev,
      prizes: prev.prizes.map((p, i) => i === index ? { ...p, [key]: value } : p),
    }));
  };

  const getDefaultQuestionsPerRound = (maxP) => {
    switch (parseInt(maxP)) {
      case 4:  return { semi: 5, final: 10 };
      case 8:  return { quarter: 5, semi: 7, final: 10 };
      case 16: return { round_of_16: 5, quarter: 5, semi: 7, final: 10 };
      case 32: return { round_of_32: 3, round_of_16: 5, quarter: 5, semi: 7, final: 10 };
      default: return { semi: 5, final: 10 };
    }
  };

  const placeLabel = (index) => {
    if (index === 0) return '🏆 1. Platz';
    if (index === 1) return '🥈 2. Platz';
    if (index === 2) return '🥉 3. Platz';
    return `${index + 1}. Platz`;
  };

  const bracketSizes = [4, 8, 16, 32];

  const validate = () => {
    if (!form.name.trim()) { alert('Bitte Turniername eingeben'); return false; }
    if (form.prizes.filter(p => p.title.trim()).length === 0) { alert('Mindestens ein Preis erforderlich'); return false; }

    if (form.format === 'highscore') {
      if (!form.questionCount || form.questionCount < 1) { alert('Mindestens 1 Frage'); return false; }
      const hasDeadline = Boolean(form.playUntil);
      const hasMax = Boolean(form.maxPlayers);
      if (!hasDeadline && !hasMax) { alert('Deadline oder Spielerlimit erforderlich'); return false; }
      if (hasDeadline) {
        const d = new Date(form.playUntil);
        if (isNaN(d.getTime()) || d <= new Date()) { alert('Deadline muss in der Zukunft liegen'); return false; }
      }
    }

    if (form.format === 'bracket') {
      if (!form.maxPlayers) { alert('Spieleranzahl für Bracket wählen'); return false; }
    }

    return true;
  };

  const handleCreate = async () => {
    if (!validate()) return;
    if (!user) { setSubmitError('Nicht eingeloggt'); return; }
    if (!user.can_create_tournaments) { setSubmitError('Keine Berechtigung'); return; }

    setSubmitError('');
    setIsSubmitting(true);

    const tournamentPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      format: form.format,
      access_level: 'invite',
      contact_info: form.contactInfo.trim() || null,
      sponsor_name: form.sponsorName.trim() || null,
      sponsor_url: form.sponsorUrl.trim() || null,
      question_count: form.format === 'highscore' ? form.questionCount : null,
      max_players: form.maxPlayers ? parseInt(form.maxPlayers, 10) : null,
      play_until: form.playUntil ? new Date(form.playUntil).toISOString() : null,
      round_deadline_hours: form.format === 'bracket' ? form.roundDeadlineHours : null,
      questions_per_round: form.format === 'bracket'
        ? (form.questionsPerRound || getDefaultQuestionsPerRound(form.maxPlayers))
        : null,
    };

    const prizes = form.prizes
      .filter(p => p.title.trim())
      .map(p => ({ title: p.title.trim(), description: p.description.trim() || null }));

    const result = await onConfirm(tournamentPayload, prizes, form.imageFile);
    if (result && result.ok === false) {
      setSubmitError(result.message || 'Fehler beim Erstellen');
    }
    setIsSubmitting(false);
  };

  const inputClass = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-colors';
  const labelClass = 'text-xs font-bold text-neutral-400 uppercase mb-2 block';

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
              Turnier erstellen
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Schritt {step} von {TOTAL_STEPS}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div className="px-4 mb-6 flex gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < step ? 'bg-purple-500' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="flex-1 px-4 pb-28 overflow-y-auto scrollbar-hide">

          {/* ===== STEP 1: FORMAT & BASICS ===== */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className={labelClass}>Format</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateForm('format', 'highscore')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.format === 'highscore'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <Trophy size={24} className={form.format === 'highscore' ? 'text-purple-400' : 'text-neutral-500'} />
                    <div className="mt-2 text-sm font-bold text-white">Highscore</div>
                    <div className="text-[10px] text-neutral-400 mt-1">Alle spielen dasselbe Quiz, Rangliste entscheidet</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateForm('format', 'bracket')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      form.format === 'bracket'
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <LayoutGrid size={24} className={form.format === 'bracket' ? 'text-purple-400' : 'text-neutral-500'} />
                    <div className="mt-2 text-sm font-bold text-white">Bracket</div>
                    <div className="text-[10px] text-neutral-400 mt-1">K.O.-Turnierbaum, 1v1 pro Runde</div>
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Turniername</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  placeholder="z.B. Bitcoin Knowledge Cup 2026"
                  className={inputClass}
                  maxLength={100}
                />
              </div>

              <div>
                <label className={labelClass}>Beschreibung</label>
                <textarea
                  value={form.description}
                  onChange={e => updateForm('description', e.target.value)}
                  placeholder="Worum geht es? Was sind die Regeln? Was gibt es zu gewinnen?"
                  className={`${inputClass} min-h-[100px]`}
                  maxLength={1000}
                />
                <p className="text-[10px] text-neutral-500 mt-1">Diese Beschreibung sehen Teilnehmer auf der Registrierungsseite</p>
              </div>

              <div>
                <label className={labelClass}>Kontaktinfo</label>
                <input
                  type="text"
                  value={form.contactInfo}
                  onChange={e => updateForm('contactInfo', e.target.value)}
                  placeholder="z.B. Telegram: @dein_handle"
                  className={inputClass}
                />
                <p className="text-[10px] text-neutral-500 mt-1">Wird Teilnehmern angezeigt damit sie dich erreichen können</p>
              </div>

              <div>
                <label className={labelClass}>Turnierbild (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className={inputClass}
                />
                {form.imagePreview && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-white/10">
                    <img src={form.imagePreview} alt="" className="w-full h-32 object-cover" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== STEP 2: KONFIGURATION ===== */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">

              {/* Highscore Config */}
              {form.format === 'highscore' && (
                <>
                  <div>
                    <label className={labelClass}>Anzahl Fragen</label>
                    <input
                      type="number"
                      value={form.questionCount}
                      onChange={e => updateForm('questionCount', parseInt(e.target.value) || 0)}
                      min="1" max="100"
                      className={inputClass}
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">Alle Teilnehmer spielen dasselbe Quiz</p>
                  </div>

                  <div>
                    <label className={labelClass}>Begrenzung</label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => updateForm('deadlineMode', 'deadline')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                          form.deadlineMode === 'deadline' ? 'bg-purple-500 text-black' : 'bg-white/5 text-white'
                        }`}
                      >
                        Deadline
                      </button>
                      <button
                        type="button"
                        onClick={() => updateForm('deadlineMode', 'players')}
                        className={`px-3 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                          form.deadlineMode === 'players' ? 'bg-purple-500 text-black' : 'bg-white/5 text-white'
                        }`}
                      >
                        Spielerlimit
                      </button>
                    </div>
                  </div>

                  {form.deadlineMode === 'deadline' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>Datum</label>
                        <input
                          type="date"
                          value={form.playDate}
                          onChange={e => { updateForm('playDate', e.target.value); updateDeadline(e.target.value, form.playTime); }}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Uhrzeit</label>
                        <input
                          type="time"
                          value={form.playTime}
                          onChange={e => { updateForm('playTime', e.target.value); updateDeadline(form.playDate, e.target.value); }}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {form.deadlineMode === 'players' && (
                    <div>
                      <label className={labelClass}>Max. Teilnehmer</label>
                      <input
                        type="number"
                        value={form.maxPlayers}
                        onChange={e => updateForm('maxPlayers', e.target.value)}
                        placeholder="z.B. 50"
                        min="2"
                        className={inputClass}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Bracket Config */}
              {form.format === 'bracket' && (
                <>
                  <div>
                    <label className={labelClass}>Spieleranzahl</label>
                    <div className="grid grid-cols-4 gap-2">
                      {bracketSizes.map(size => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => {
                            updateForm('maxPlayers', size);
                            updateForm('questionsPerRound', getDefaultQuestionsPerRound(size));
                          }}
                          className={`px-3 py-3 rounded-xl text-sm font-bold transition-all ${
                            parseInt(form.maxPlayers) === size
                              ? 'bg-purple-500 text-black'
                              : 'bg-white/5 text-white hover:bg-white/10'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Zeitlimit pro Runde (Stunden)</label>
                    <input
                      type="number"
                      value={form.roundDeadlineHours}
                      onChange={e => updateForm('roundDeadlineHours', parseInt(e.target.value) || 24)}
                      min="1" max="168"
                      className={inputClass}
                    />
                    <p className="text-[10px] text-neutral-500 mt-1">Nach Ablauf wird der Spieler der gespielt hat automatisch weitergeleitet</p>
                  </div>

                  {form.maxPlayers && form.questionsPerRound && (
                    <div>
                      <label className={labelClass}>Fragen pro Runde</label>
                      <div className="space-y-2">
                        {Object.entries(form.questionsPerRound).map(([round, count]) => {
                          const roundLabels = {
                            round_of_32: 'Runde der 32',
                            round_of_16: 'Achtelfinale',
                            quarter: 'Viertelfinale',
                            semi: 'Halbfinale',
                            final: 'Finale',
                          };
                          return (
                            <div key={round} className="flex items-center gap-3">
                              <span className="text-xs text-neutral-300 w-28">{roundLabels[round] || round}</span>
                              <input
                                type="number"
                                value={count}
                                onChange={e => {
                                  updateForm('questionsPerRound', {
                                    ...form.questionsPerRound,
                                    [round]: parseInt(e.target.value) || 1,
                                  });
                                }}
                                min="1" max="30"
                                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-center outline-none focus:border-purple-500/50"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Registrierungs-Deadline (optional)</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="date"
                        value={form.playDate}
                        onChange={e => { updateForm('playDate', e.target.value); updateDeadline(e.target.value, form.playTime); }}
                        className={inputClass}
                      />
                      <input
                        type="time"
                        value={form.playTime}
                        onChange={e => { updateForm('playTime', e.target.value); updateDeadline(form.playDate, e.target.value); }}
                        className={inputClass}
                      />
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-1">Danach können keine neuen Spieler mehr beitreten</p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ===== STEP 3: PREISE ===== */}
          {step === 3 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-4">
                <p className="text-xs text-neutral-300">
                  <Gift size={14} className="inline text-yellow-400 mr-1" />
                  Preise werden nach Turnier-Ende den Gewinnern zugeordnet. Die Auszahlung erfolgt direkt durch dich an den Gewinner über dessen hinterlegte Kontaktmethode.
                </p>
              </div>

              {form.prizes.map((prize, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-bold text-white">{placeLabel(idx)}</span>
                    {form.prizes.length > 1 && (
                      <button onClick={() => removePrize(idx)} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={prize.title}
                    onChange={e => updatePrize(idx, 'title', e.target.value)}
                    placeholder="z.B. 100.000 Sats / 50€ Bitrefill Gutschein"
                    className={`${inputClass} mb-2`}
                    maxLength={200}
                  />
                  <input
                    type="text"
                    value={prize.description}
                    onChange={e => updatePrize(idx, 'description', e.target.value)}
                    placeholder="Details (optional)"
                    className={inputClass}
                    maxLength={500}
                  />
                </div>
              ))}

              <button
                onClick={addPrize}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-neutral-400 text-sm font-bold hover:border-purple-500/50 hover:text-purple-400 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Weiteren Preis hinzufügen
              </button>
            </div>
          )}

          {/* ===== STEP 4: SPONSOR & REVIEW ===== */}
          {step === 4 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className={labelClass}>Sponsor / Veranstalter (optional)</label>
                <input
                  type="text"
                  value={form.sponsorName}
                  onChange={e => updateForm('sponsorName', e.target.value)}
                  placeholder="z.B. Bitrefill, Einundzwanzig e.V."
                  className={`${inputClass} mb-2`}
                />
                <input
                  type="url"
                  value={form.sponsorUrl}
                  onChange={e => updateForm('sponsorUrl', e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>

              {/* Review Card */}
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-4 mt-4">
                <h3 className="text-lg font-black text-white mb-4">{form.name || 'Turniername'}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">FORMAT</span>
                    <p className="text-white font-black">{form.format === 'highscore' ? 'Highscore' : 'Bracket'}</p>
                  </div>
                  {form.format === 'highscore' && (
                    <div>
                      <span className="text-[10px] text-neutral-400 font-bold">FRAGEN</span>
                      <p className="text-white font-black">{form.questionCount}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">TEILNEHMER</span>
                    <p className="text-white font-black">{form.maxPlayers || 'Unbegrenzt'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-neutral-400 font-bold">ZUGANG</span>
                    <p className="text-white font-black">Einladungslink</p>
                  </div>
                  {form.playUntil && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-neutral-400 font-bold">DEADLINE</span>
                      <p className="text-white font-black">{new Date(form.playUntil).toLocaleString()}</p>
                    </div>
                  )}
                  {form.sponsorName && (
                    <div className="col-span-2">
                      <span className="text-[10px] text-neutral-400 font-bold">SPONSOR</span>
                      <p className="text-white font-black">{form.sponsorName}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <span className="text-[10px] text-neutral-400 font-bold block mb-2">PREISE</span>
                  {form.prizes.filter(p => p.title.trim()).map((prize, idx) => (
                    <div key={idx} className="text-xs text-white mb-1">
                      <span className="text-yellow-400 font-bold">{placeLabel(idx)}:</span> {prize.title}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
                <p className="text-xs text-neutral-300">
                  Nach dem Erstellen erhältst du einen <span className="text-purple-400 font-bold">Einladungslink</span> den du teilen kannst. Interessenten registrieren sich über den Link und du entscheidest wer teilnehmen darf.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-[#111] border-t border-white/10 p-4 max-w-md mx-auto">
          <div className="flex gap-3">
            <button
              onClick={() => step > 1 ? setStep(step - 1) : onCancel()}
              className="flex-1 px-4 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-colors"
            >
              {step === 1 ? 'Abbrechen' : 'Zurück'}
            </button>
            {step < TOTAL_STEPS ? (
              <button
                onClick={() => setStep(step + 1)}
                className="flex-1 px-4 py-3 bg-purple-500 text-black rounded-xl font-black hover:bg-purple-400 transition-colors"
              >
                Weiter
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-black rounded-xl font-black hover:from-purple-400 hover:to-pink-400 transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Erstelle...' : 'Turnier erstellen'}
              </button>
            )}
          </div>
          {submitError && (
            <div className="mt-3 text-center text-xs text-red-400 font-bold">{submitError}</div>
          )}
        </div>
      </div>
    </Background>
  );
};

export default CreateTournamentView;