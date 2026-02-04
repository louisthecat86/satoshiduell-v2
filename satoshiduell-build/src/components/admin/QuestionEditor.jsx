import React, { useState, useEffect } from 'react';
import { updateQuestion, fetchQuestionsByCreatedAt } from '../../services/supabase';

const languages = ['de', 'en', 'es'];

const QuestionEditor = ({ open, onClose, question, onSaved = null }) => {
  const [group, setGroup] = useState([]); // array of language rows
  const [activeLang, setActiveLang] = useState(question?.language || 'de');
  const [local, setLocal] = useState({ question: '', options: ['', '', '', ''], correct: 0, id: null });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !question) return;
    const loadGroup = async () => {
      try {
        const { data, error } = await fetchQuestionsByCreatedAt(question.created_at);
        if (!error && Array.isArray(data)) {
          setGroup(data);
          setActiveLang(question.language || data[0]?.language || 'de');
        } else {
          setGroup([question]);
          setActiveLang(question.language || 'de');
        }
      } catch (e) {
        setGroup([question]);
        setActiveLang(question.language || 'de');
      }
    };
    loadGroup();
  }, [open, question]);

  useEffect(() => {
    const row = group.find(r => r.language === activeLang) || {};
    setLocal({
      question: row.question || '',
      options: Array.isArray(row.options) ? [...row.options, '', '', '',].slice(0,4) : ['', '', '', ''],
      correct: typeof row.correct === 'number' ? row.correct : 0,
      id: row.id || null,
    });
  }, [group, activeLang]);

  const handleOptChange = (idx, val) => {
    const n = [...local.options];
    n[idx] = val;
    setLocal({ ...local, options: n });
  };

  const handleSave = async () => {
    if (!local.id) return alert('No ID to save');
    setSaving(true);
    try {
      const payload = {
        question: local.question,
        options: local.options,
        correct: parseInt(local.correct, 10) || 0,
      };
      console.log('Saving question', local.id, payload);
      const { data, error } = await updateQuestion(local.id, payload);
      console.log('Update response', { data, error });
      if (error) throw error;
      // Some Supabase setups return no representation on update (null data).
      // Treat null data + no error as success and refetch the group below.
      setGroup(g => g.map(r => r.id === local.id ? { ...r, ...payload } : r));
      // refetch group from server to ensure consistency
      try {
        const res = await fetchQuestionsByCreatedAt(question.created_at);
        if (!res.error && Array.isArray(res.data)) setGroup(res.data);
        console.log('Refetched group after save', res);
        // Wenn parent eine onSaved Callback hat, übergebe die aktualisierte Zeile (data) falls vorhanden
        if (typeof onSaved === 'function') onSaved(data ?? { id: local.id, ...payload });
      } catch (e) {
        console.warn('Refetch after save failed', e);
      }
      alert('Gespeichert');
    } catch (e) {
      console.error('Update error:', e);
      const msg = e?.message || (e?.error && e.error.message) || JSON.stringify(e);
      alert('Fehler beim Speichern: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl p-4">
        <div className="bg-[#161616] border border-white/10 rounded-2xl p-4 shadow-lg">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-white font-extrabold text-lg">Frage bearbeiten</h3>
              <p className="text-neutral-500 text-sm">Sprache wechseln, Frage und Antworten bearbeiten und speichern.</p>
            </div>
            <div className="flex items-center gap-2">
              {languages.map(l => (
                <button
                  key={l}
                  onClick={() => setActiveLang(l)}
                  className={`px-3 py-1 rounded-lg text-sm font-bold ${activeLang === l ? 'bg-blue-500 text-black' : 'bg-white/5 text-white'}`}
                >{l.toUpperCase()}</button>
              ))}
              <button onClick={onClose} className="ml-2 px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg">Schließen</button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="text-xs text-neutral-400">Frage</label>
                <textarea value={local.question} onChange={e => setLocal({...local, question: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500" rows={3} />
              </div>

              <div>
                <label className="text-xs text-neutral-400">Antworten</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  {local.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-black ${local.correct === idx ? 'bg-green-500 text-black' : 'bg-white/5 text-white'}`}>{idx+1}</div>
                      <input value={opt} onChange={e => handleOptChange(idx, e.target.value)} className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1 space-y-4">
              <div className="bg-black/20 border border-white/5 rounded-lg p-3">
                <label className="text-xs text-neutral-400">Richtige Antwort</label>
                <select value={local.correct} onChange={e => setLocal({...local, correct: parseInt(e.target.value,10)})} className="w-full mt-2 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                  {local.options.map((_,idx) => <option key={idx} value={idx}>{idx+1}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-black rounded-xl font-bold">{saving ? 'Speichert...' : 'Speichern'}</button>
                <button onClick={onClose} className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl">Abbrechen</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionEditor;
