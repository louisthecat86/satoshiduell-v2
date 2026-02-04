import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import { 
  ArrowLeft, Upload, Download, Trash2, Loader2, RefreshCw, 
  Search, FileUp, Globe, X, Save, Check, LayoutDashboard, 
  Gamepad2, ListChecks, Coins, Trophy, Clock
} from 'lucide-react';
import { 
  fetchQuestions, upsertQuestions, deleteQuestion, deleteAllQuestions,
  fetchAllDuels, fetchSubmissions, updateSubmissionStatus, deleteSubmission, supabase 
} from '../services/supabase';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

// ==========================================
// 1. HELPER: STATUS BADGES & FORMATTING
// ==========================================
const StatusBadge = ({ status }) => {
    const styles = {
        'open': 'bg-green-500/20 text-green-400 border-green-500/30',
        'active': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'finished': 'bg-neutral-700 text-neutral-300 border-neutral-600',
        'pending_payment': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'cancelled': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    const labels = {
        'open': 'Wartet',
        'active': 'Läuft',
        'finished': 'Beendet',
        'pending_payment': 'Zahlung',
        'cancelled': 'Abbruch'
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${styles[status] || styles['finished']}`}>
            {labels[status] || status}
        </span>
    );
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
};

// ==========================================
// 2. EDITOR (INTERN) - Fragen bearbeiten
// ==========================================
const QuestionEditorInternal = ({ open, onClose, question, onSaved }) => {
  if (!open) return null;
  const [activeLang, setActiveLang] = useState('de');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({});

  const findValue = (obj, searchKey) => {
    if (!obj) return '';
    const searchLower = searchKey.toLowerCase().trim();
    const foundKey = Object.keys(obj).find(k => k.toLowerCase().trim() === searchLower);
    return foundKey ? obj[foundKey] : '';
  };

  useEffect(() => {
    if (question) {
      setFormData({
        id: question.id,
        question_de: findValue(question, 'question_de'), option_de_1: findValue(question, 'option_de_1'), option_de_2: findValue(question, 'option_de_2'), option_de_3: findValue(question, 'option_de_3'), option_de_4: findValue(question, 'option_de_4'),
        question_en: findValue(question, 'question_en'), option_en_1: findValue(question, 'option_en_1'), option_en_2: findValue(question, 'option_en_2'), option_en_3: findValue(question, 'option_en_3'), option_en_4: findValue(question, 'option_en_4'),
        question_es: findValue(question, 'question_es'), option_es_1: findValue(question, 'option_es_1'), option_es_2: findValue(question, 'option_es_2'), option_es_3: findValue(question, 'option_es_3'), option_es_4: findValue(question, 'option_es_4'),
        correct_index: parseInt(findValue(question, 'correct_index') || 0),
        difficulty: findValue(question, 'difficulty') || 'medium',
        is_active: question.is_active ?? 1
      });
    } else {
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
    const key = field.startsWith('option_') ? `option_${activeLang}_${field.split('_')[1]}` : `${field}_${activeLang}`;
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const getVal = (base) => {
      if (base.startsWith('option_')) return formData[`option_${activeLang}_${base.split('_')[1]}`] || '';
      return formData[`${base}_${activeLang}`] || '';
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
    } catch (e) { alert("Fehler: " + e.message); } 
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-[#111] border border-white/10 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/5 bg-[#161616]">
          <h2 className="text-white font-black text-lg uppercase tracking-wider flex items-center gap-2">
            <Globe size={18} className="text-orange-500"/> {question ? 'BEARBEITEN' : 'NEU'}
          </h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors"><X size={24} /></button>
        </div>
        <div className="shrink-0 flex p-2 gap-2 bg-black/20 border-b border-white/5">
          {['de', 'en', 'es'].map(lang => (
            <button key={lang} onClick={() => setActiveLang(lang)} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${activeLang === lang ? 'bg-orange-500 text-black' : 'bg-white/5 text-neutral-400'}`}>
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <label className="text-xs font-bold text-neutral-500 uppercase">Frage ({activeLang})</label>
            <textarea value={getVal('question')} onChange={e => handleChange('question', e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white outline-none min-h-[80px]" />
          </div>
          <div className="grid grid-cols-1 gap-3">
             {[1, 2, 3, 4].map((num, idx) => (
               <div key={num} className="flex items-start gap-2">
                 <button onClick={() => setFormData(prev => ({ ...prev, correct_index: idx }))} className={`shrink-0 w-10 h-10 mt-1 rounded-lg flex items-center justify-center border transition-all ${formData.correct_index === idx ? 'bg-green-500 text-black' : 'bg-white/5 text-neutral-600 border-white/10'}`}>
                   {formData.correct_index === idx ? <Check size={20} strokeWidth={4} /> : num}
                 </button>
                 <textarea value={getVal(`option_${num}`)} onChange={e => handleChange(`option_${num}`, e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-sm text-white outline-none min-h-[60px]" placeholder={`Antwort ${num}`} />
               </div>
             ))}
          </div>
        </div>
        <div className="shrink-0 p-4 border-t border-white/5 bg-[#161616] flex justify-end gap-3">
          <button onClick={handleSave} className="px-6 py-2 rounded-xl bg-orange-500 text-black text-sm font-black hover:bg-orange-400">{loading ? "..." : "Speichern"}</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. HAUPT VIEW: ADMIN DASHBOARD
// ==========================================
const AdminView = ({ onBack }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  // Tabs: 'dashboard' | 'questions' | 'games'
  const [activeTab, setActiveTab] = useState('dashboard');
  const [gamesFilter, setGamesFilter] = useState('all'); // 'all' | 'open'
  
  // Data States
  const [stats, setStats] = useState({ users: 0, games: 0, pending: 0, questions: 0, inbox: 0 });
  const [questions, setQuestions] = useState([]);
  const [games, setGames] = useState([]);
  const [players, setPlayers] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Editor / Import States
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorQuestion, setEditorQuestion] = useState(null);
  const [importReplace, setImportReplace] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState(null);
  const [submissionForm, setSubmissionForm] = useState(null);
  const [submissionError, setSubmissionError] = useState('');

  // --- DATEN LADEN ---
  const loadStats = async () => {
     const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
     const { count: gameCount } = await supabase.from('duels').select('*', { count: 'exact', head: true });
    const { count: pendingCount } = await supabase.from('duels').select('*', { count: 'exact', head: true }).eq('status', 'open');
      const { count: qCount } = await supabase.from('questions').select('*', { count: 'exact', head: true });
      const { count: inboxCount } = await supabase.from('question_submissions').select('*', { count: 'exact', head: true });
     
      setStats({ users: userCount || 0, games: gameCount || 0, pending: pendingCount || 0, questions: qCount || 0, inbox: inboxCount || 0 });
  };

  const loadQuestions = async () => {
    setLoading(true);
    const { data } = await fetchQuestions();
    if (data) setQuestions(data.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
    setLoading(false);
  };

  const loadGames = async () => {
    setLoading(true);
    const { data } = await fetchAllDuels(200);
    if (data) setGames(data);
    setLoading(false);
  };

  const loadPlayers = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('total_sats_won', { ascending: false });
    if (data) setPlayers(data);
    setLoading(false);
  };

  const loadSubmissions = async () => {
    setLoading(true);
    const { data } = await fetchSubmissions();
    if (data) setSubmissions(data);
    setLoading(false);
  };

  useEffect(() => {
     loadStats();
     if (activeTab === 'questions') loadQuestions();
     if (activeTab === 'games') loadGames();
      if (activeTab === 'players') loadPlayers();
      if (activeTab === 'inbox') loadSubmissions();
  }, [activeTab]);

  const handleBack = () => {
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (onBack) onBack();
  };


  // --- HANDLERS ---
  const handleCSVImport = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (importReplace && !confirm("ACHTUNG: Alle Fragen löschen?")) return;
      if (importReplace) await deleteAllQuestions();

      setIsImporting(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
          try {
              const lines = ev.target.result.split('\n').filter(l => l.trim().length > 0);
              const headers = lines[0].split(';').map(h => h.trim().toLowerCase().replace(/^[\uFEFF\u200B]/, ''));
              const parsedRows = [];
              for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split(';'); 
                  if (values.length < 2) continue;
                  const rowObj = {};
                  headers.forEach((h, idx) => {
                      let val = values[idx] ? values[idx].trim() : '';
                      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                      rowObj[h] = val === '' ? null : val;
                  });
                  const newQ = { ...rowObj, is_active: 1 };
                  if (newQ.question_de || newQ.question_en) parsedRows.push(newQ);
              }
              if (parsedRows.length > 0) {
                  await upsertQuestions(parsedRows);
                  alert(`✅ ${parsedRows.length} importiert!`);
                  loadQuestions(); loadStats();
              }
          } catch (err) { alert("Error: " + err.message); } 
          finally { setIsImporting(false); e.target.value = ''; }
      };
      reader.readAsText(file, 'UTF-8');
  };

  const handleExport = () => {
      const headers = ["id", "question_de", "option_de_1", "option_de_2", "option_de_3", "option_de_4", "question_en", "option_en_1", "option_en_2", "option_en_3", "option_en_4", "correct_index", "difficulty"];
      const csvContent = [headers.join(';'), ...questions.map(q => headers.map(h => `"${String(q[h]||'').replace(/"/g, '""')}"`).join(';'))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = "satoshi_questions_export.csv";
      document.body.appendChild(link); link.click();
  };

  const handleDeleteQuestion = async (id) => {
      if(!confirm("Löschen?")) return;
      await deleteQuestion(id);
      loadQuestions(); loadStats();
  };

  const handleDeleteGame = async (id) => {
      if(!confirm("Spiel wirklich löschen?")) return;
      await supabase.from('duels').delete().eq('id', id);
      loadGames(); loadStats();
  };

  const openSubmission = (submission) => {
    const opts = Array.isArray(submission.options) ? submission.options : [];
    const lang = submission.language || 'de';
    const initial = {
      question_de: lang === 'de' ? submission.question : '',
      question_en: lang === 'en' ? submission.question : '',
      question_es: lang === 'es' ? submission.question : '',
      option_de_1: lang === 'de' ? (opts[0] || '') : '',
      option_de_2: lang === 'de' ? (opts[1] || '') : '',
      option_de_3: lang === 'de' ? (opts[2] || '') : '',
      option_de_4: lang === 'de' ? (opts[3] || '') : '',
      option_en_1: lang === 'en' ? (opts[0] || '') : '',
      option_en_2: lang === 'en' ? (opts[1] || '') : '',
      option_en_3: lang === 'en' ? (opts[2] || '') : '',
      option_en_4: lang === 'en' ? (opts[3] || '') : '',
      option_es_1: lang === 'es' ? (opts[0] || '') : '',
      option_es_2: lang === 'es' ? (opts[1] || '') : '',
      option_es_3: lang === 'es' ? (opts[2] || '') : '',
      option_es_4: lang === 'es' ? (opts[3] || '') : '',
      correct_index: submission.correct || 0,
      difficulty: 'medium',
      is_active: 1
    };
    setActiveSubmission(submission);
    setSubmissionForm(initial);
    setSubmissionError('');
    setSubmissionOpen(true);
  };

  const updateSubmissionForm = (key, value) => {
    setSubmissionForm(prev => ({ ...prev, [key]: value }));
  };

  const validateSubmissionForm = () => {
    const langs = ['de', 'en', 'es'];
    for (const lang of langs) {
      const q = submissionForm[`question_${lang}`];
      const opts = [1, 2, 3, 4].map(i => submissionForm[`option_${lang}_${i}`]);
      if (!q || opts.some(o => !o)) return false;
    }
    return true;
  };

  const handleAcceptSubmission = async () => {
    if (!activeSubmission || !submissionForm) return;
    if (!validateSubmissionForm()) {
      setSubmissionError(t('admin_submission_required'));
      return;
    }

    const payload = { ...submissionForm };
    const { error } = await upsertQuestions([payload]);
    if (error) {
      alert(error.message);
      return;
    }

    await updateSubmissionStatus(activeSubmission.id, 'accepted');
    await deleteSubmission(activeSubmission.id);
    setSubmissions(prev => prev.filter(s => s.id !== activeSubmission.id));
    setSubmissionOpen(false);
    setActiveSubmission(null);
    setSubmissionForm(null);
    loadSubmissions();
    loadStats();
  };

  const handleRejectSubmission = async () => {
    if (!activeSubmission) return;
    await updateSubmissionStatus(activeSubmission.id, 'rejected');
    await deleteSubmission(activeSubmission.id);
    setSubmissions(prev => prev.filter(s => s.id !== activeSubmission.id));
    setSubmissionOpen(false);
    setActiveSubmission(null);
    setSubmissionForm(null);
    loadSubmissions();
    loadStats();
  };


  // --- RENDER HELPERS ---
  const filteredQuestions = questions.filter(q => {
      if (!searchTerm) return true;
      const t = (q.question_de || '') + (q.question_en || '') + (q.question_es || '');
      return t.toLowerCase().includes(searchTerm.toLowerCase());
  });

    const filteredGames = games.filter(g => {
      if (gamesFilter === 'open' && g.status !== 'open') return false;
      if (!searchTerm) return true;
      const t = (g.creator || '') + (g.challenger || '') + (g.id || '');
      return t.toLowerCase().includes(searchTerm.toLowerCase());
    });


  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-6xl mx-auto overflow-hidden p-4">
        
        {/* HEADER */}
        <div className="shrink-0 flex items-center justify-between mb-6">
           <div className="flex items-center gap-4">
              <button onClick={handleBack} className="bg-white/5 hover:bg-white/10 p-2 rounded-xl border border-white/5"><ArrowLeft className="text-white" size={20}/></button>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-widest"><span className="text-orange-500">ADMIN</span> DASHBOARD</h1>
           </div>
           
             {/* TABS NAVIGATION (removed) */}
        </div>

        {/* ================= CONTENT AREA ================= */}
        <div className="flex-1 min-h-0 relative flex flex-col">
            
            {/* VIEW: DASHBOARD (JETZT 2x2) */}
            {activeTab === 'dashboard' && (
                // HIER GEÄNDERT: grid-cols-2 und zentriert
                <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto w-full animate-in fade-in content-start mt-8">
                    <button onClick={() => setActiveTab('players')} className="bg-[#111]/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[4/3] shadow-xl hover:bg-[#111]/80 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 mb-2"><Globe size={28}/></div>
                        <span className="text-4xl font-black text-white">{stats.users}</span>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Spieler</span>
                    </button>
                    <button onClick={() => { setGamesFilter('all'); setActiveTab('games'); }} className="bg-[#111]/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[4/3] shadow-xl hover:bg-[#111]/80 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-400 mb-2"><Trophy size={28}/></div>
                        <span className="text-4xl font-black text-white">{stats.games}</span>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Spiele</span>
                    </button>
                    <button onClick={() => { setGamesFilter('open'); setActiveTab('games'); }} className="bg-[#111]/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[4/3] shadow-xl hover:bg-[#111]/80 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 mb-2"><Coins size={28}/></div>
                        <span className="text-4xl font-black text-white">{stats.pending}</span>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Offen</span>
                    </button>
                    <button onClick={() => setActiveTab('questions')} className="bg-[#111]/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[4/3] shadow-xl hover:bg-[#111]/80 transition-colors">
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mb-2"><ListChecks size={28}/></div>
                        <span className="text-4xl font-black text-white">{stats.questions}</span>
                        <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Fragen</span>
                    </button>
                    <button onClick={() => setActiveTab('inbox')} className="bg-[#111]/60 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[4/3] shadow-xl hover:bg-[#111]/80 transition-colors">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2"><LayoutDashboard size={28}/></div>
                      <span className="text-4xl font-black text-white">{stats.inbox}</span>
                      <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{t('admin_inbox')}</span>
                    </button>
                </div>
            )}

            {/* VIEW: GAMES */}
            {activeTab === 'games' && (
                <div className="flex flex-col h-full animate-in fade-in">
                    <div className="shrink-0 mb-4 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                            <input type="text" placeholder="Suche Spieler oder ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none" />
                        </div>
                        <button onClick={loadGames} className="p-3 bg-white/5 rounded-xl text-neutral-400 hover:text-white"><RefreshCw size={18}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 bg-[#111]/40 border border-white/5 rounded-2xl custom-scrollbar">
                        <table className="w-full text-left text-sm text-neutral-400">
                            <thead className="bg-white/5 text-xs uppercase font-bold text-white sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Spieler</th>
                                    <th className="p-4 hidden md:table-cell">Pot</th>
                                    <th className="p-4 hidden md:table-cell">Datum</th>
                                    <th className="p-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {loading ? <tr><td colSpan="5" className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></td></tr> :
                                 filteredGames.map(g => (
                                    <tr key={g.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4"><StatusBadge status={g.status}/></td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold flex items-center gap-2">
                                                    {g.creator} <span className="text-[10px] text-neutral-600">vs</span> {g.challenger || '?'}
                                                </span>
                                                <span className="text-[10px] font-mono opacity-50">{String(g.id || '').slice(0,8)}...</span>
                                            </div>
                                        </td>
                                        <td className="p-4 hidden md:table-cell"><span className="text-yellow-500 font-bold">{g.amount * 2} Sats</span></td>
                                        <td className="p-4 hidden md:table-cell text-xs">{formatDate(g.created_at)}</td>
                                        <td className="p-4 text-right">
                                            <button onClick={() => handleDeleteGame(g.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* VIEW: PLAYERS */}
            {activeTab === 'players' && (
              <div className="flex flex-col h-full animate-in fade-in">
                <div className="shrink-0 mb-4 flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                    <input type="text" placeholder="Suche Spieler..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none" />
                  </div>
                  <button onClick={loadPlayers} className="p-3 bg-white/5 rounded-xl text-neutral-400 hover:text-white"><RefreshCw size={18}/></button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 bg-[#111]/40 border border-white/5 rounded-2xl custom-scrollbar">
                  <table className="w-full text-left text-sm text-neutral-400">
                    <thead className="bg-white/5 text-xs uppercase font-bold text-white sticky top-0 z-10 backdrop-blur-md">
                      <tr>
                        <th className="p-4">Spieler</th>
                        <th className="p-4 hidden md:table-cell">Spiele</th>
                        <th className="p-4 hidden md:table-cell">Siege</th>
                        <th className="p-4 hidden md:table-cell">Niederl.</th>
                        <th className="p-4 hidden md:table-cell">Sats</th>
                        <th className="p-4 text-right">Aktualisiert</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {loading ? <tr><td colSpan="6" className="p-8 text-center"><Loader2 className="animate-spin mx-auto"/></td></tr> :
                       players.filter(p => {
                         if (!searchTerm) return true;
                         return (p.username || '').toLowerCase().includes(searchTerm.toLowerCase());
                       }).map(p => (
                        <tr key={p.username} className="hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-md bg-neutral-800 border border-white/10 overflow-hidden">
                                <img src={p.avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${p.username}`} alt={p.username} className="w-full h-full object-cover" />
                              </div>
                              <span className="text-white font-bold uppercase text-sm">{p.username}</span>
                            </div>
                          </td>
                          <td className="p-4 hidden md:table-cell">{p.games_played || 0}</td>
                          <td className="p-4 hidden md:table-cell text-green-400">{p.wins || 0}</td>
                          <td className="p-4 hidden md:table-cell text-red-400">{p.losses || 0}</td>
                          <td className="p-4 hidden md:table-cell text-yellow-400">{p.total_sats_won || 0}</td>
                          <td className="p-4 text-right text-xs">{formatDate(p.last_updated)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW: QUESTIONS */}
            {activeTab === 'questions' && (
                <div className="flex flex-col h-full animate-in fade-in">
                    <div className="shrink-0 flex flex-col md:flex-row gap-4 mb-4 bg-[#111]/80 p-4 rounded-2xl border border-white/5">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                            <input type="text" placeholder="Frage suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none" />
                        </div>
                        <div className="flex gap-2 items-center justify-end">
                            <label className="text-[10px] text-neutral-400 uppercase cursor-pointer bg-black/40 px-3 py-2 rounded-lg border border-white/5 flex gap-2 hover:bg-white/5">
                                <input type="checkbox" checked={importReplace} onChange={e => setImportReplace(e.target.checked)} className="accent-red-500" /> Replace
                            </label>
                            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl font-bold text-xs hover:bg-blue-600/30">
                                <Download size={16}/> Export
                            </button>
                            <div className="relative">
                                <input id="csvInput" type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                                <button onClick={() => document.getElementById('csvInput').click()} disabled={isImporting} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-black rounded-xl font-bold text-xs shadow-lg shadow-orange-500/20 hover:bg-orange-400">
                                    {isImporting ? <Loader2 className="animate-spin" size={16}/> : <FileUp size={16}/>} Import
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 bg-[#111]/40 border border-white/5 rounded-2xl p-2 custom-scrollbar">
                        {loading ? <div className="text-center p-10 text-neutral-500"><Loader2 className="animate-spin mx-auto"/></div> : 
                        filteredQuestions.map(q => (
                            <div key={q.id} onClick={() => { setEditorQuestion(q); setEditorOpen(true); }} className="bg-white/5 border border-white/5 p-3 rounded-xl mb-2 cursor-pointer hover:bg-white/10 transition-colors flex justify-between items-start">
                                <div>
                                    <h4 className="text-white font-bold text-sm line-clamp-1">{q.question_de || q.question_en || '---'}</h4>
                                    <div className="flex gap-3 text-[10px] text-neutral-500 mt-1">
                                        <span className="font-mono">ID: {q.id?.slice(0,6)}</span>
                                        <span className="text-green-500">Lösung: {(q.correct_index||0)+1}</span>
                                        <span>{q.difficulty}</span>
                                    </div>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(q.id); }} className="p-2 text-neutral-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* VIEW: INBOX */}
            {activeTab === 'inbox' && (
                <div className="flex flex-col h-full animate-in fade-in">
                    <div className="shrink-0 mb-4 flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                            <input type="text" placeholder={t('admin_submission_search')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white outline-none" />
                        </div>
                        <button onClick={loadSubmissions} className="p-3 bg-white/5 rounded-xl text-neutral-400 hover:text-white"><RefreshCw size={18}/></button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0 bg-[#111]/40 border border-white/5 rounded-2xl custom-scrollbar">
                        {loading ? (
                          <div className="text-center p-10 text-neutral-500"><Loader2 className="animate-spin mx-auto"/></div>
                        ) : submissions.filter(s => {
                          const isPending = s.status ? s.status === 'pending' : true;
                          if (!isPending) return false;
                          if (!searchTerm) return true;
                          return `${s.question || ''} ${s.submitter || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
                        }).map(s => (
                          <button key={s.id} onClick={() => openSubmission(s)} className="w-full text-left p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-bold text-sm line-clamp-1">{s.question}</div>
                                <div className="text-[10px] text-neutral-500 mt-1">
                                  {t('admin_submission_language')}: {String(s.language || 'de').toUpperCase()} · {t('admin_submission_submitter')}: {s.submitter || '-'}
                                </div>
                              </div>
                              <div className="text-[10px] text-neutral-500">{formatDate(s.created_at)}</div>
                            </div>
                          </button>
                        ))}

                        {!loading && submissions.length === 0 && (
                          <div className="text-center p-10 text-neutral-500">{t('admin_submissions_empty')}</div>
                        )}
                    </div>
                </div>
            )}

        </div>

        {/* EDITOR OVERLAY */}
        <QuestionEditorInternal 
            open={editorOpen} 
            onClose={() => { setEditorOpen(false); setEditorQuestion(null); }} 
            question={editorQuestion} 
            onSaved={() => { loadQuestions(); loadStats(); setEditorOpen(false); }} 
        />

        {/* SUBMISSION OVERLAY */}
        {submissionOpen && submissionForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#111] border border-white/10 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="shrink-0 flex items-center justify-between p-4 border-b border-white/5 bg-[#161616]">
                <h2 className="text-white font-black text-lg uppercase tracking-wider">{t('admin_inbox')}</h2>
                <button onClick={() => setSubmissionOpen(false)} className="text-neutral-500 hover:text-white transition-colors"><X size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                <div className="text-xs text-neutral-400 bg-white/5 border border-white/10 rounded-xl p-3">
                  {t('admin_submission_original_correct')}: {Number.isFinite(activeSubmission?.correct) ? activeSubmission.correct + 1 : '-'}
                  {Array.isArray(activeSubmission?.options) && activeSubmission?.options?.[activeSubmission?.correct] ? ` · ${activeSubmission.options[activeSubmission.correct]}` : ''}
                </div>
                {['de', 'en', 'es'].map(lang => (
                  <div key={lang} className="space-y-2">
                    <h3 className="text-xs font-bold text-neutral-500 uppercase">{lang.toUpperCase()}</h3>
                    <textarea value={submissionForm[`question_${lang}`] || ''} onChange={e => updateSubmissionForm(`question_${lang}`, e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white outline-none min-h-[70px]" placeholder={t('admin_submission_question')} />
                    {[1, 2, 3, 4].map((num) => (
                      <textarea key={num} value={submissionForm[`option_${lang}_${num}`] || ''} onChange={e => updateSubmissionForm(`option_${lang}_${num}`, e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-sm text-white outline-none min-h-[50px]" placeholder={`${t('admin_submission_option')} ${num}`} />
                    ))}
                  </div>
                ))}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase">{t('admin_submission_correct')}</label>
                  <select value={submissionForm.correct_index} onChange={e => updateSubmissionForm('correct_index', parseInt(e.target.value))} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white outline-none">
                    {[0,1,2,3].map(i => <option key={i} value={i}>{i + 1}</option>)}
                  </select>
                </div>

                {submissionError && (
                  <div className="text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/30 p-3 rounded-xl">
                    {submissionError}
                  </div>
                )}
              </div>

              <div className="shrink-0 p-4 border-t border-white/5 bg-[#161616] flex justify-end gap-3">
                <button onClick={handleRejectSubmission} className="px-6 py-2 rounded-xl bg-red-500/20 text-red-300 text-sm font-black hover:bg-red-500/30">{t('admin_submission_reject')}</button>
                <button onClick={handleAcceptSubmission} className="px-6 py-2 rounded-xl bg-green-500 text-black text-sm font-black hover:bg-green-400">{t('admin_submission_accept')}</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Background>
  );
};

export default AdminView;