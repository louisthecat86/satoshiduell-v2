import React, { useState, useEffect } from 'react';
import { X, Save, Check, Globe, Bug } from 'lucide-react';
import { upsertQuestions } from '../../services/supabase';

const QuestionEditor = ({ open, onClose, question, onSaved }) => {
  if (!open) return null;

  const [activeLang, setActiveLang] = useState('de');
  const [loading, setLoading] = useState(false);

  // Initial State
  const [formData, setFormData] = useState({
    id: null,
    question_de: '', option_de_1: '', option_de_2: '', option_de_3: '', option_de_4: '',
    question_en: '', option_en_1: '', option_en_2: '', option_en_3: '', option_en_4: '',
    question_es: '', option_es_1: '', option_es_2: '', option_es_3: '', option_es_4: '',
    correct_index: 0,
    difficulty: 'medium',
    is_active: 1
  });

  // --- SPÜRHUND FUNKTION (Findet Werte egal wie sie geschrieben sind) ---
  const findValue = (obj, searchKey) => {
    if (!obj) return '';
    const searchLower = searchKey.toLowerCase().trim();
    // Suche Key im Objekt
    const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === searchLower);
    return foundKey ? obj[foundKey] : '';
  };

  useEffect(() => {
    if (question) {
      // Wir nutzen den Spürhund für jedes Feld
      const newData = {
        id: question.id,
        
        question_de: findValue(question, 'question_de'),
        option_de_1: findValue(question, 'option_de_1'),
        option_de_2: findValue(question, 'option_de_2'),
        option_de_3: findValue(question, 'option_de_3'),
        option_de_4: findValue(question, 'option_de_4'),

        question_en: findValue(question, 'question_en'),
        option_en_1: findValue(question, 'option_en_1'),
        option_en_2: findValue(question, 'option_en_2'),
        option_en_3: findValue(question, 'option_en_3'),
        option_en_4: findValue(question, 'option_en_4'),

        question_es: findValue(question, 'question_es'),
        option_es_1: findValue(question, 'option_es_1'),
        option_es_2: findValue(question, 'option_es_2'),
        option_es_3: findValue(question, 'option_es_3'),
        option_es_4: findValue(question, 'option_es_4'),

        correct_index: parseInt(findValue(question, 'correct_index') || findValue(question, 'correct_answer') || 0),
        difficulty: findValue(question, 'difficulty') || 'medium',
        is_active: question.is_active ?? 1
      };
      setFormData(newData);
    } else {
      // Reset bei "Neu"
      setFormData({
        id: null,
        question_de: '', option_de_1: '', option_de_2: '', option_de_3: '', option_de_4: '',
        question_en: '', option_en_1: '', option_en_2: '', option_en_3: '', option_en_4: '',
        question_es: '', option_es_1: '', option_es_2: '', option_es_3: '', option_es_4: '',
        correct_index: 0, difficulty: 'medium', is_active: 1
      });
    }
  }, [question]);

  const handleChange = (field, value) => {
    if (['difficulty', 'correct_index', 'is_active'].includes(field)) {
       setFormData(prev => ({ ...prev, [field]: value }));
       return;
    }
    const key = `${field}_${activeLang}`;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload = { ...formData };
      if (!payload.id) delete payload.id;

      const { error } = await upsertQuestions([payload]);
      if (error) throw error;
      
      if (onSaved) onSaved();
      onClose();
    } catch (e) {
      alert("Fehler: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const getVal = (base) => formData[`${base}_${activeLang}`] || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#111] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/5 bg-[#161616]">
          <h2 className="text-white font-black text-lg uppercase tracking-wider flex items-center gap-2">
            <Globe size={18} className="text-orange-500"/> 
            {question ? 'Bearbeiten' : 'Neu'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* TABS */}
        <div className="shrink-0 flex p-2 gap-2 bg-black/20 border-b border-white/5">
          {['de', 'en', 'es'].map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                activeLang === lang 
                  ? 'bg-orange-500 text-black shadow-lg shadow-orange-900/20' 
                  : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* FRAGE */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase">Frage ({activeLang})</label>
            <textarea 
              value={getVal('question')}
              onChange={e => handleChange('question', e.target.value)}
              className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white focus:border-orange-500 outline-none min-h-[80px]"
              placeholder="Frage..."
            />
          </div>

          {/* ANTWORTEN */}
          <div className="space-y-3">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((num, idx) => (
                  <div key={num} className="flex items-center gap-2">
                    <button 
                      onClick={() => setFormData(prev => ({ ...prev, correct_index: idx }))}
                      className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border transition-all ${
                        formData.correct_index === idx 
                          ? 'bg-green-500 border-green-500 text-black' 
                          : 'bg-white/5 border-white/10 text-neutral-600'
                      }`}
                    >
                      {formData.correct_index === idx ? <Check size={20} strokeWidth={4} /> : num}
                    </button>
                    <input 
                      value={getVal(`option_${num}`)} 
                      onChange={e => handleChange(`option_${num}`, e.target.value)}
                      className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-sm text-white outline-none"
                      placeholder={`Antwort ${num}`}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* === DEBUGGING AREA (Löschen wir später) === */}
          <div className="mt-8 p-4 bg-red-900/20 border border-red-500/30 rounded-xl overflow-hidden">
             <h3 className="text-red-400 font-bold text-xs uppercase mb-2 flex items-center gap-2">
                <Bug size={14}/> Live Debugging Daten
             </h3>
             <pre className="text-[10px] text-neutral-400 font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(question, null, 2)}
             </pre>
          </div>

        </div>

        {/* FOOTER */}
        <div className="shrink-0 p-4 border-t border-white/5 bg-[#161616] flex justify-end gap-3">
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-orange-500 text-black text-sm font-black">
            {loading ? "..." : "Speichern"}
          </button>
        </div>

      </div>
    </div>
  );
};

export default QuestionEditor;