import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import { ArrowLeft, Inbox, List, BarChart3, CheckCircle2, XCircle, Download, Upload, Trash2, Loader2 } from 'lucide-react';
import { fetchSubmissions, updateSubmissionStatus, createQuestion, fetchQuestions, fetchAllDuels } from '../services/supabase';
import { useTranslation } from '../hooks/useTranslation';
import { useAuth } from '../hooks/useAuth';

const AdminView = ({ onBack }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState('submissions');

  // Submissions
  const [submissions, setSubmissions] = useState([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [submissionFilter, setSubmissionFilter] = useState('pending');

  // Questions
  const [questions, setQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(true);
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [importUrl, setImportUrl] = useState('');

  // Games
  const [games, setGames] = useState([]);
  const [loadingG, setLoadingG] = useState(true);

  // UI States
  const [actionInProgress, setActionInProgress] = useState(null);

  const loadSubmissions = async () => {
    setLoadingSub(true);
    const { data } = await fetchSubmissions(submissionFilter === 'all' ? null : submissionFilter);
    setSubmissions(data || []);
    setLoadingSub(false);
  };

  const loadQuestions = async () => {
    setLoadingQ(true);
    const { data } = await fetchQuestions();
    setQuestions(data || []);
    setLoadingQ(false);
  };

  const loadGames = async () => {
    setLoadingG(true);
    const { data } = await fetchAllDuels(200);
    setGames(data || []);
    setLoadingG(false);
  };

  useEffect(() => {
    if (!user?.is_admin) return;
    loadSubmissions();
    loadQuestions();
    loadGames();
  }, [user]);

  useEffect(() => {
    if (tab === 'submissions') loadSubmissions();
  }, [submissionFilter]);

  if (!user?.is_admin) {
    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-md mx-auto items-center justify-center p-6">
          <div className="text-center">
            <h3 className="text-white font-black text-lg mb-2">🔒 {t('admin_access_denied')}</h3>
            <p className="text-neutral-500 text-sm mb-6">{t('admin_requires_permission')}</p>
            <button onClick={onBack} className="px-4 py-2 bg-orange-500 text-black rounded-xl font-bold hover:bg-orange-600 transition-colors">{t('btn_back_menu')}</button>
          </div>
        </div>
      </Background>
    );
  }

  const acceptSubmission = async (s) => {
    setActionInProgress(s.id);
    try {
      const { data: q, error: qErr } = await createQuestion({ 
        language: s.language, 
        question: s.question, 
        options: s.options, 
        correct: s.correct 
      });
      if (qErr) throw new Error(t('admin_error'));
      await updateSubmissionStatus(s.id, 'accepted');
      alert(t('admin_question_approved'));
      loadSubmissions();
      loadQuestions();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionInProgress(null);
    }
  };

  const rejectSubmission = async (s) => {
    setActionInProgress(s.id);
    try {
      await updateSubmissionStatus(s.id, 'rejected');
      alert(t('admin_question_rejected'));
      loadSubmissions();
    } catch (err) {
      alert(t('admin_error'));
    } finally {
      setActionInProgress(null);
    }
  };

  const exportQuestionsCSV = () => {
    if (!questions || questions.length === 0) return alert(t('admin_no_data'));

    // Format für Export: Eine Zeile pro Sprache pro Frage
    // Damit kann man leicht neue Fragen in allen 3 Sprachen hinzufügen
    const rows = questions.map(q => ({
      id: q.id,
      language: q.language,
      question: q.question,
      option1: q.options?.[0] || '',
      option2: q.options?.[1] || '',
      option3: q.options?.[2] || '',
      option4: q.options?.[3] || '',
      correct_answer: (q.correct || 0) + 1 // 1, 2, 3, oder 4 statt 0, 1, 2, 3
    }));

    const headers = ['id', 'language', 'question', 'option1', 'option2', 'option3', 'option4', 'correct_answer'];
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => {
        const val = r[h];
        return '"' + String(val).replace(/"/g, '""') + '"';
      }).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importQuestionsCSV = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csv = e.target?.result;
        if (!csv) return alert(t('admin_error'));

        const lines = csv.split('\n').filter(line => line.trim());
        if (lines.length < 2) return alert('CSV muss Header und mindestens 1 Zeile haben');

        const rawHeaders = lines[0].split(',').map(h => h.trim());
        const headers = rawHeaders.map(h => h.toLowerCase());
        
        console.log('📋 Erkannte Header:', rawHeaders);

        // Erkenne welches Format verwendet wird
        const useNewFormat = headers.includes('option1') && headers.includes('option2');
        const useOldFormat = headers.includes('options') && headers.includes('correct');

        // SPEZIAL: Erkenne language-specific Spalten (question_de, option_de_1 ...)
        const langs = ['de', 'en', 'es'];
        const langColumnGroups = {}; // { de: { question: idx, options: [idx..], activeIdx, verifiedIdx } }
        langs.forEach(lang => {
          const qKey = rawHeaders.findIndex(h => h.toLowerCase() === `question_${lang}` || h.toLowerCase().startsWith(`question_${lang}`));
          const optKeys = [];
          for (let k = 1; k <= 4; k++) {
            const name1 = `option_${lang}_${k}`;
            const name2 = `option_${lang}_${k}`;
            const idx = rawHeaders.findIndex(h => h.toLowerCase() === name1 || h.toLowerCase() === name2 || h.toLowerCase().includes(`option-${lang}-${k}`));
            if (idx >= 0) optKeys.push(idx);
          }
          if (qKey >= 0 && optKeys.length === 4) {
            langColumnGroups[lang] = { question: qKey, options: optKeys };
          }
        });

        // Versuche automatisch Spalten zu mappen wenn weder neues noch altes Format passt
        let columnMap = null;
        if (!useNewFormat && !useOldFormat && Object.keys(langColumnGroups).length === 0) {
          // Auto-Detect: Suche nach Spalten mit gemeinsamen Mustern
          const langCol = headers.findIndex(h => h.includes('language') || h.includes('sprache') || h.includes('lang'));
          const qCol = headers.findIndex(h => h.includes('question') || h.includes('frage') || h.includes('question_text'));

          // Suche nach Optionen - können unterschiedlich benannt sein
          const optionCols = [];
          headers.forEach((h, idx) => {
            if (h.includes('option') || h.includes('answer') || h.includes('antwort') || h.includes('a.') || h.includes('a )')) {
              optionCols.push(idx);
            }
          });

          const correctCol = headers.findIndex(h => h.includes('correct') || h.includes('richtig') || h.includes('answer') || h.includes('correct_answer') || h.includes('correct_index'));

          if (qCol >= 0 && optionCols.length >= 4) {
            columnMap = {
              language: langCol >= 0 ? langCol : null,
              question: qCol,
              options: optionCols.slice(0, 4),
              correct: correctCol >= 0 ? correctCol : null
            };
            console.log('🔍 Auto-Mapping gefunden:', columnMap);
          }
        }

        if (!useNewFormat && !useOldFormat && Object.keys(langColumnGroups).length === 0 && !columnMap) {
          return alert(`⚠️ Spalten nicht erkannt!\n\nErkannte: ${rawHeaders.join(', ')}\n\nErwartet: language, question, option1, option2, option3, option4, correct_answer\nOder language-specific Spalten wie question_de, option_de_1`);
        }

        setActionInProgress('importing');
        let imported = 0;
        let failed = 0;

        // Detect some optional control columns
        const correctIndexCol = rawHeaders.findIndex(h => h.toLowerCase().includes('correct_index') || h.toLowerCase().includes('correct_answer') || h.toLowerCase().includes('correct'));
        const isActiveCol = rawHeaders.findIndex(h => h.toLowerCase().includes('is_active'));
        const isVerifiedCol = rawHeaders.findIndex(h => h.toLowerCase().includes('is_verified'));

        for (let i = 1; i < lines.length; i++) {
          // CSV Parser: Respektiere Anführungszeichen und Tabs
          const values = [];
          let current = '';
          let inQuotes = false;
          for (let j = 0; j < lines[i].length; j++) {
            const char = lines[i][j];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if ((char === ',' || char === '\t') && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ''));

          try {
            // Skip empty rows
            if (values.every(v => !v)) continue;

            // If is_verified present and set to 0/false, skip this row
            if (isVerifiedCol >= 0) {
              const v = (values[isVerifiedCol] || '').toLowerCase();
              if (v === '0' || v === 'false' || v === 'no') {
                failed++;
                continue;
              }
            }

            // If language-specific groups detected, create one question per language present
            if (Object.keys(langColumnGroups).length > 0) {
              for (const lang of Object.keys(langColumnGroups)) {
                const group = langColumnGroups[lang];
                const question = values[group.question];
                const options = group.options.map(idx => values[idx]);

                if (!question || options.some(o => !o)) {
                  // Skip this language entry if incomplete
                  continue;
                }

                // Determine correct index (global or per-row)
                let correct = 0;
                if (correctIndexCol >= 0) {
                  const cv = parseInt(values[correctIndexCol]);
                  if (isNaN(cv)) { failed++; continue; }
                  correct = cv > 1 ? cv - 1 : cv;
                } else {
                  // fallback: assume first option is correct if not provided
                  correct = 0;
                }

                await createQuestion({
                  language: lang,
                  question,
                  options: options.slice(0,4),
                  correct
                });
                imported++;
              }
            } else {
              // legacy / new / auto-mapped handling
              let language = 'de';
              let question = '';
              let options = [];
              let correct = 0;

              if (useNewFormat) {
                const row = {};
                headers.forEach((h, idx) => { row[h] = values[idx]; });
                language = row.language || 'de';
                question = row.question;
                options = [row.option1, row.option2, row.option3, row.option4];
                correct = (parseInt(row.correct_answer) || 1) - 1;
              } else if (useOldFormat) {
                const row = {};
                headers.forEach((h, idx) => { row[h] = values[idx]; });
                language = row.language || 'de';
                question = row.question;
                options = JSON.parse(row.options);
                correct = parseInt(row.correct);
              } else if (columnMap) {
                // Auto-mapped format
                language = columnMap.language !== null ? values[columnMap.language] || 'de' : 'de';
                question = values[columnMap.question];
                options = columnMap.options.map(idx => values[idx]);

                // Parse correct answer - könnte 1-4 oder 0-3 sein
                const correctVal = parseInt(values[columnMap.correct]);
                correct = correctVal > 1 ? correctVal - 1 : correctVal;
              }

              if (!question || !options.length || options.some(o => !o)) {
                failed++;
                continue;
              }

              // Ensure 4 options
              while (options.length < 4) options.push('');
              options = options.slice(0, 4);

              if (isNaN(correct) || correct < 0 || correct > 3) {
                failed++;
                continue;
              }

              await createQuestion({
                language: language.substring(0, 2).toLowerCase(),
                question,
                options,
                correct
              });
              imported++;
            }
          } catch (err) {
            console.error('Import-Fehler in Reihe', i, ':', err);
            failed++;
          }
        }

        alert(`✅ ${imported} Fragen importiert, ${failed} übersprungen`);
        loadQuestions();
        event.target.value = '';
      } catch (err) {
        alert(`Fehler beim Importieren: ${err.message}`);
      } finally {
        setActionInProgress(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = importQuestionsCSV;
    input.click();
  };

  const handleExport = () => {
    exportQuestionsCSV();
  };

  const importFromUrl = async () => {
    if (!importUrl.trim()) return alert('Bitte URL eingeben');
    
    setActionInProgress('importing');
    try {
      const response = await fetch(importUrl);
      if (!response.ok) throw new Error('URL nicht erreichbar');
      
      const csv = await response.text();
      const lines = csv.split('\n').filter(line => line.trim());
      if (lines.length < 2) return alert('CSV muss Header und mindestens 1 Zeile haben');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      // Unterstütze beide Formate
      const useNewFormat = headers.includes('option1') && headers.includes('option2');
      const requiredHeaders = useNewFormat 
        ? ['language', 'question', 'option1', 'option2', 'option3', 'option4', 'correct_answer']
        : ['language', 'question', 'options', 'correct'];
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        return alert(`Fehlende Spalten: ${missingHeaders.join(', ')}`);
      }

      let imported = 0;
      let failed = 0;

      for (let i = 1; i < lines.length; i++) {
        // CSV Parser: Respektiere Anführungszeichen
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < lines[i].length; j++) {
          const char = lines[i][j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim().replace(/^"|"$/g, ''));

        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx];
        });

        try {
          const language = row.language || 'de';
          const question = row.question;
          let options, correct;

          if (useNewFormat) {
            options = [row.option1, row.option2, row.option3, row.option4];
            correct = (parseInt(row.correct_answer) || 1) - 1;
          } else {
            options = JSON.parse(row.options);
            correct = parseInt(row.correct);
          }

          if (!question || !Array.isArray(options) || options.length !== 4 || isNaN(correct) || correct < 0 || correct > 3) {
            failed++;
            continue;
          }

          await createQuestion({
            language,
            question,
            options,
            correct
          });
          imported++;
        } catch (err) {
          failed++;
        }
      }

      alert(`✓ ${imported} Fragen importiert, ${failed} fehlgeschlagen`);
      setImportUrl('');
      setShowImportUrl(false);
      loadQuestions();
    } catch (err) {
      alert(`Fehler beim URL-Import: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Stats
  const stats = {
    totalQuestions: questions.length,
    totalSubmissions: submissions.length,
    totalGames: games.length,
    pendingSubmissions: submissions.filter(s => s.reviewed === false).length
  };

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-5xl mx-auto relative overflow-hidden p-4">
        
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6 pt-2">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20}/>
          </button>
          <h1 className="text-2xl font-black text-white uppercase tracking-widest">⚙️ {t('admin_title')}</h1>
        </div>

        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3 mb-4 lg:mb-6">
          <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl lg:rounded-2xl p-3 lg:p-4">
            <div className="text-xs text-blue-400 font-bold uppercase mb-1 truncate">{t('admin_total_questions')}</div>
            <div className="text-xl lg:text-2xl font-black text-blue-300">{stats.totalQuestions}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 rounded-xl lg:rounded-2xl p-3 lg:p-4">
            <div className="text-xs text-orange-400 font-bold uppercase mb-1 truncate">{t('admin_total_submissions')}</div>
            <div className="text-xl lg:text-2xl font-black text-orange-300">{stats.pendingSubmissions}</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl lg:rounded-2xl p-3 lg:p-4">
            <div className="text-xs text-purple-400 font-bold uppercase mb-1 truncate">{t('admin_statistics')}</div>
            <div className="text-xl lg:text-2xl font-black text-purple-300">{submissions.length}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl lg:rounded-2xl p-3 lg:p-4">
            <div className="text-xs text-green-400 font-bold uppercase mb-1 truncate">{t('admin_total_games')}</div>
            <div className="text-xl lg:text-2xl font-black text-green-300">{stats.totalGames}</div>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex gap-1 lg:gap-2 mb-3 lg:mb-4 overflow-x-auto pb-2 border-b border-white/5 -mx-4 px-4">
          <button 
            onClick={() => setTab('submissions')} 
            className={`px-3 lg:px-4 py-2 rounded-lg font-bold text-xs lg:text-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
              tab === 'submissions' 
                ? 'bg-orange-500 text-black' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Inbox size={14}/> <span className="hidden sm:inline">{t('admin_submissions_tab')}</span>
          </button>
          <button 
            onClick={() => setTab('questions')} 
            className={`px-3 lg:px-4 py-2 rounded-lg font-bold text-xs lg:text-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
              tab === 'questions' 
                ? 'bg-blue-500 text-black' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <List size={14}/> <span className="hidden sm:inline">{t('admin_questions_tab')}</span>
          </button>
          <button 
            onClick={() => setTab('games')} 
            className={`px-3 lg:px-4 py-2 rounded-lg font-bold text-xs lg:text-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
              tab === 'games' 
                ? 'bg-green-500 text-black' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <BarChart3 size={14}/> <span className="hidden sm:inline">{t('admin_games_tab')}</span>
          </button>
        </div>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto scrollbar-hide bg-[#0a0a0a] rounded-xl lg:rounded-2xl p-3 lg:p-4">
          
          {/* SUBMISSIONS TAB */}
          {tab === 'submissions' && (
            <div>
              {/* Filter */}
              <div className="flex gap-1 lg:gap-2 mb-3 lg:mb-4 overflow-x-auto pb-2">
                {['pending', 'approved', 'rejected', 'all'].map(f => (
                  <button
                    key={f}
                    onClick={() => setSubmissionFilter(f)}
                    className={`px-2 lg:px-3 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${
                      submissionFilter === f
                        ? 'bg-orange-500 text-black'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {f === 'pending' && t('admin_submissions_pending')}
                    {f === 'approved' && t('admin_submissions_approved')}
                    {f === 'rejected' && t('admin_submissions_rejected')}
                    {f === 'all' && 'Alle'}
                  </button>
                ))}
              </div>

              {loadingSub ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-orange-500" size={32}/>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                  <Inbox className="text-neutral-600 mx-auto mb-3" size={40}/>
                  <p className="text-neutral-500 font-bold text-sm">{t('admin_no_data')}</p>
                </div>
              ) : (
                <div className="space-y-2 lg:space-y-3">
                  {submissions.map(s => (
                    <div key={s.id} className="bg-[#161616] border border-white/10 rounded-lg lg:rounded-2xl p-3 lg:p-4 hover:border-white/20 transition-colors">
                      <div className="grid grid-cols-1 gap-2 lg:gap-3">
                        {/* Question */}
                        <div>
                          <div className="text-xs text-neutral-500 font-bold uppercase mb-1">{t('admin_question')}</div>
                          <p className="text-white font-bold text-sm lg:text-base">{s.question}</p>
                        </div>

                        {/* Meta Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 lg:gap-2 text-xs">
                          <div>
                            <span className="text-neutral-600 font-bold">{t('admin_language')}:</span>
                            <span className="text-white ml-1">{s.language || 'de'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-600 font-bold">{t('admin_submitted_by')}:</span>
                            <span className="text-white ml-1 truncate">{s.created_by || 'Unbekannt'}</span>
                          </div>
                          <div>
                            <span className="text-neutral-600 font-bold">{t('admin_submitted_on')}:</span>
                            <span className="text-white ml-1">{new Date(s.created_at).toLocaleDateString('de-DE')}</span>
                          </div>
                        </div>

                        {/* Options */}
                        <div>
                          <div className="text-xs text-neutral-600 font-bold uppercase mb-2">{t('admin_answers')}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 lg:gap-2">
                            {Array.isArray(s.options) ? s.options.map((opt, idx) => (
                              <div 
                                key={idx} 
                                className={`p-2 rounded-lg text-xs font-bold ${
                                  idx === s.correct 
                                    ? 'bg-green-500/30 text-green-300 border border-green-500' 
                                    : 'bg-white/5 text-white border border-white/10'
                                }`}
                              >
                                <span className="font-black">{idx + 1}.</span> {opt}
                              </div>
                            )) : <p className="text-neutral-500 text-xs">{t('admin_error')}</p>}
                          </div>
                        </div>

                        {/* Actions */}
                        {submissionFilter !== 'approved' && submissionFilter !== 'rejected' && (
                          <div className="flex gap-2 pt-2 lg:pt-3 border-t border-white/5">
                            <button
                              onClick={() => acceptSubmission(s)}
                              disabled={actionInProgress === s.id}
                              className="flex-1 flex items-center justify-center gap-1 lg:gap-2 px-2 lg:px-3 py-2 bg-green-500 hover:bg-green-600 text-black font-bold text-xs lg:text-sm rounded-lg transition-colors disabled:opacity-50"
                            >
                              {actionInProgress === s.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle2 size={16}/>}
                              <span className="hidden sm:inline">{t('admin_approve')}</span>
                              <span className="sm:hidden">✓</span>
                            </button>
                            <button
                              onClick={() => rejectSubmission(s)}
                              disabled={actionInProgress === s.id}
                              className="flex-1 flex items-center justify-center gap-1 lg:gap-2 px-2 lg:px-3 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs lg:text-sm rounded-lg transition-colors disabled:opacity-50"
                            >
                              {actionInProgress === s.id ? <Loader2 className="animate-spin" size={16}/> : <XCircle size={16}/>}
                              <span className="hidden sm:inline">{t('admin_reject')}</span>
                              <span className="sm:hidden">✕</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* QUESTIONS TAB */}
          {tab === 'questions' && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 lg:mb-4">
                <h3 className="text-white font-black text-sm lg:text-lg">{t('admin_questions_tab')} ({questions.length})</h3>
                <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                  <button 
                    onClick={() => setShowImportUrl(!showImportUrl)}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 lg:gap-2 px-3 lg:px-4 py-2 bg-purple-500 hover:bg-purple-600 text-black font-bold text-xs lg:text-sm rounded-lg transition-colors"
                  >
                    <Upload size={16}/> 
                    <span className="hidden sm:inline">URL</span>
                  </button>
                  <button 
                    onClick={handleImportClick}
                    disabled={actionInProgress === 'importing'}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 lg:gap-2 px-3 lg:px-4 py-2 bg-green-500 hover:bg-green-600 text-black font-bold text-xs lg:text-sm rounded-lg transition-colors disabled:opacity-50"
                  >
                    {actionInProgress === 'importing' ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16}/>} 
                    <span className="hidden sm:inline">{t('admin_import_csv')}</span>
                    <span className="sm:hidden">Import</span>
                  </button>
                  <button 
                    onClick={handleExport}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1 lg:gap-2 px-3 lg:px-4 py-2 bg-blue-500 hover:bg-blue-600 text-black font-bold text-xs lg:text-sm rounded-lg transition-colors w-full sm:w-auto"
                  >
                    <Download size={16}/> <span className="hidden sm:inline">{t('admin_export_csv')}</span>
                    <span className="sm:hidden">Export</span>
                  </button>
                </div>
              </div>

              {/* URL Import Modal */}
              {showImportUrl && (
                <div className="bg-[#161616] border border-white/10 rounded-lg p-3 mb-3 lg:mb-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-neutral-400 font-bold uppercase">CSV-URL von Supabase</label>
                    <input 
                      type="text" 
                      placeholder="https://..." 
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-purple-500 transition-colors"
                    />
                    <p className="text-xs text-neutral-500">💡 Tipp: Öffne deine Supabase Storage-Datei und nutze den öffentlichen Link</p>
                    <div className="flex gap-2">
                      <button 
                        onClick={importFromUrl}
                        disabled={!importUrl.trim() || actionInProgress === 'importing'}
                        className="flex-1 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-black font-bold text-sm rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionInProgress === 'importing' ? 'Importiere...' : 'Importieren'}
                      </button>
                      <button 
                        onClick={() => setShowImportUrl(false)}
                        className="flex-1 px-3 py-2 bg-neutral-700 hover:bg-neutral-600 text-white font-bold text-sm rounded-lg transition-colors"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loadingQ ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-blue-500" size={32}/>
                </div>
              ) : questions.length === 0 ? (
                <div className="text-center py-12">
                  <List className="text-neutral-600 mx-auto mb-3" size={40}/>
                  <p className="text-neutral-500 font-bold text-sm">{t('admin_no_data')}</p>
                </div>
              ) : (
                <div className="space-y-1 lg:space-y-2">
                  {questions.map(q => (
                    <div key={q.id} className="bg-[#161616] border border-white/10 rounded-lg lg:rounded-lg p-2 lg:p-3 hover:border-white/20 transition-colors">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3 items-center">
                        <div className="sm:col-span-6">
                          <p className="text-white font-bold text-xs lg:text-sm line-clamp-2">{q.question}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-xs font-bold px-2 py-1 bg-blue-500/20 text-blue-300 rounded inline-block">
                            {q.language || 'de'}
                          </span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-xs font-bold px-2 py-1 bg-green-500/20 text-green-300 rounded inline-block">
                            A{(q.correct || 0) + 1}
                          </span>
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <button className="px-2 py-1 text-red-400 hover:text-red-300 transition-colors">
                            <Trash2 size={16}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GAMES TAB */}
          {tab === 'games' && (
            <div>
              <h3 className="text-white font-black text-sm lg:text-lg mb-3 lg:mb-4">{t('admin_games_tab')} ({games.length})</h3>

              {loadingG ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-green-500" size={32}/>
                </div>
              ) : games.length === 0 ? (
                <div className="text-center py-12">
                  <BarChart3 className="text-neutral-600 mx-auto mb-3" size={40}/>
                  <p className="text-neutral-500 font-bold text-sm">{t('admin_no_data')}</p>
                </div>
              ) : (
                <div className="space-y-1 lg:space-y-2">
                  {games.map(g => (
                    <div key={g.id} className="bg-[#161616] border border-white/10 rounded-lg lg:rounded-lg p-2 lg:p-3 hover:border-white/20 transition-colors">
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-3 items-center text-xs lg:text-sm">
                        <div className="sm:col-span-5">
                          <p className="text-white font-bold line-clamp-1">{g.creator}</p>
                          <p className="text-neutral-500 text-xs line-clamp-1">vs {g.challenger || '—'}</p>
                        </div>
                        <div className="sm:col-span-3">
                          <span className="text-white font-bold">{g.amount} sats</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded inline-block ${
                            g.status === 'finished' ? 'bg-green-500/20 text-green-300' : 
                            g.status === 'active' ? 'bg-blue-500/20 text-blue-300' :
                            'bg-neutral-500/20 text-neutral-300'
                          }`}>
                            {g.status}
                          </span>
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <span className="text-neutral-500 text-xs">{new Date(g.created_at).toLocaleDateString('de-DE', {month: 'short', day: 'numeric'})}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </Background>
  );
};

export default AdminView;
