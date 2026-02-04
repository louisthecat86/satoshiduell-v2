import React, { useState, useEffect } from 'react';
import Background from '../components/ui/Background';
import Button from '../components/ui/Button';
import { ArrowLeft, Trophy, Users, Coins, Calendar, Zap, Crown, Swords, RefreshCw, Trash2, Copy, Wallet } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../hooks/useTranslation';
import { QRCodeCanvas } from 'qrcode.react';
import { deleteTournament, fetchTournaments, updateTournament } from '../services/supabase';
import { createWithdrawLink } from '../services/lnbits';

const TournamentsView = ({ onBack, onCreateTournament, onRegisterTournament }) => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [localCanCreate, setLocalCanCreate] = useState(user?.can_create_tournaments || false);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { id, name }
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [claimModal, setClaimModal] = useState(null); // { type, lnurl, amount }

  // Refresh user data wenn View öffnet, um aktualisierte Permissions zu laden
  useEffect(() => {
    if (user?.username) {
      refreshUser(user.username);
    }
  }, []);

  // Update lokaler State wenn user sich ändert
  useEffect(() => {
    setLocalCanCreate(user?.can_create_tournaments || false);
  }, [user?.can_create_tournaments]);

  const loadTournaments = async () => {
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await fetchTournaments();
    if (error) {
      console.error('Fehler beim Laden der Turniere:', error);
      setErrorMsg(t('donate_error_create'));
      setLoading(false);
      return;
    }
    setTournaments(data || []);
    setLoading(false);
  };

  useEffect(() => {
    loadTournaments();
  }, []);

  // Prüfen ob User ein Turnier löschen darf
  const canDeleteTournament = (tournament) => {
    if (!user) return false;
    // Admin darf alles löschen
    if (user.is_admin === true) return true;
    // Creator darf nur eigene löschen
    if (tournament.creator?.toLowerCase() === user.username?.toLowerCase()) return true;
    return false;
  };

  const handleDeleteTournament = async (tournamentId) => {
    const { error } = await deleteTournament(tournamentId);
    if (error) {
      console.error('Delete error:', error);
      alert(t('donate_error_create'));
      return;
    }
    setDeleteConfirm(null);
    setSelectedTournament(null);
    await loadTournaments();
  };

  const openClaimModal = (type, lnurl, amount) => {
    if (!lnurl) return;
    setClaimModal({ type, lnurl, amount });
  };

  const handleClaim = async (type, tournament) => {
    if (!tournament) return;

    const isPrize = type === 'prize';
    const amount = isPrize ? (tournament.total_prize_pool || 0) : (tournament.accumulated_entry_fees || 0);
    if (amount <= 0) {
      alert(t('donate_error_amount'));
      return;
    }

    const existingLink = isPrize ? tournament.prize_pool_withdraw_link : tournament.entry_fees_withdraw_link;
    if (existingLink) {
      openClaimModal(type, existingLink, amount);
      return;
    }

    const linkData = await createWithdrawLink(amount, tournament.id);
    if (!linkData || !linkData.lnurl) {
      alert(t('donate_error_create'));
      return;
    }

    const updates = isPrize
      ? { prize_pool_withdraw_link: linkData.lnurl, prize_pool_claimed: true, prize_pool_claim_hash: linkData.id }
      : { entry_fees_withdraw_link: linkData.lnurl, entry_fees_claimed: true };

    const { data, error } = await updateTournament(tournament.id, updates);
    if (error) {
      console.error('Fehler beim Speichern des Claim-Links:', error);
      alert(t('donate_error_create'));
      return;
    }

    if (data) {
      setSelectedTournament(data);
      setTournaments(prev => prev.map(tour => (tour.id === data.id ? data : tour)));
    }

    openClaimModal(type, linkData.lnurl, amount);
  };

  const statusLabel = (status) => {
    if (status === 'pending_payment') return t('tournament_status_pending');
    if (status === 'registration') return t('tournament_status_registration');
    if (status === 'active') return t('tournament_status_active');
    if (status === 'finished') return t('tournament_status_finished');
    return status;
  };

  if (selectedTournament) {
    return (
      <Background>
        <div className="flex flex-col h-full w-full max-w-4xl mx-auto relative p-4 overflow-y-auto scrollbar-hide">
          {/* Header */}
          <div className="p-6 pb-2 flex items-center gap-4">
            <button onClick={() => setSelectedTournament(null)} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
              <ArrowLeft className="text-white" size={20}/>
            </button>
            <div className="flex-1">
              <h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
                <Trophy size={24} /> {selectedTournament.name}
              </h2>
              <p className="text-xs text-neutral-400 mt-1">{selectedTournament.description}</p>
            </div>
            {/* Delete Button (nur für Admin oder Creator) */}
            {canDeleteTournament(selectedTournament) && (
              <button 
                onClick={() => setDeleteConfirm({ id: selectedTournament.id, name: selectedTournament.name })}
                className="bg-red-500/20 p-2 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/50"
                title={t('tournament_delete_btn')}
              >
                <Trash2 className="text-red-400" size={20}/>
              </button>
            )}
          </div>

          {/* Tournament Info */}
          <div className="px-4 mb-6">
            <div className="bg-gradient-to-r from-orange-500/20 to-yellow-500/20 border border-orange-500/30 rounded-2xl p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_prize_pool_label')}</div>
                  <div className="text-lg font-black text-yellow-400">{selectedTournament.total_prize_pool?.toLocaleString?.() || selectedTournament.total_prize_pool || 0} ⚡</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_entry_fee_label')}</div>
                  <div className="text-lg font-black text-white">{selectedTournament.entry_fee} Sats</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_participants')}</div>
                  <div className="text-lg font-black text-white">{selectedTournament.current_participants}/{selectedTournament.max_players}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold mb-1">{t('tournament_status_label')}</div>
                  <div className="text-lg font-black text-green-400">{statusLabel(selectedTournament.status)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tournament Bracket */}
          <div className="px-4 mb-6">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Swords size={16} className="text-orange-500" /> {t('tournament_bracket_title')}
            </h3>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6">
              {selectedTournament.bracket ? (
                <pre className="text-[10px] text-neutral-300 whitespace-pre-wrap">
                  {JSON.stringify(selectedTournament.bracket, null, 2)}
                </pre>
              ) : (
                <p className="text-xs text-neutral-500">{t('tournament_bracket_placeholder')}</p>
              )}
            </div>
          </div>

          {/* Action Button */}
          {selectedTournament.status === 'registration' && (
            <div className="px-4 mb-6">
              <Button
                onClick={() => onRegisterTournament && onRegisterTournament(selectedTournament)}
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 text-black font-black py-4 flex items-center justify-center gap-2"
              >
                <Zap size={20} /> {selectedTournament.entry_fee > 0 ? t('tournament_register_btn', { fee: selectedTournament.entry_fee }) : t('tournament_register_free')}
              </Button>
            </div>
          )}

          {selectedTournament.status === 'finished' && (
            <div className="px-4 mb-6 space-y-3">
              {selectedTournament.winner && selectedTournament.winner.toLowerCase() === user?.username?.toLowerCase() && (
                <Button
                  onClick={() => handleClaim('prize', selectedTournament)}
                  className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black py-4 flex items-center justify-center gap-2"
                >
                  <Zap size={20} /> {t('tournament_claim_prize', { amount: selectedTournament.total_prize_pool || 0 })}
                </Button>
              )}
              {selectedTournament.creator?.toLowerCase() === user?.username?.toLowerCase() && (
                <Button
                  onClick={() => handleClaim('fees', selectedTournament)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-black font-black py-4 flex items-center justify-center gap-2"
                >
                  <Zap size={20} /> {t('tournament_claim_entry_fees', { amount: selectedTournament.accumulated_entry_fees || 0 })}
                </Button>
              )}
            </div>
          )}
        </div>
      </Background>
    );
  }

  return (
    <Background>
      <div className="flex flex-col h-full w-full max-w-md mx-auto relative p-4 overflow-y-auto scrollbar-hide">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center gap-4">
          <button onClick={onBack} className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors">
            <ArrowLeft className="text-white" size={20}/>
          </button>
          <div className="flex-1">
            <h2 className="text-xl font-black text-orange-500 uppercase tracking-widest flex items-center gap-2">
              <Trophy size={24} /> {t('tournament_list_title')}
            </h2>
          </div>
          <button 
            onClick={() => {
              refreshUser(user?.username);
              setLocalCanCreate(!localCanCreate);
              setTimeout(() => setLocalCanCreate(user?.can_create_tournaments || false), 100);
            }}
            className="bg-white/10 p-2 rounded-xl hover:bg-white/20 transition-colors"
            title={t('tournament_refresh_permissions')}
          >
            <RefreshCw className="text-white" size={20}/>
          </button>
        </div>

        {/* Create Tournament Button (nur für befähigte User) */}
        {localCanCreate && (
          <div className="px-4 mb-4">
            <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-2xl p-4 text-center">
              <Crown className="text-purple-400 mx-auto mb-2" size={32} />
              <p className="text-xs text-neutral-400 mb-3">{t('tournament_creator_permission')}</p>
              <Button onClick={onCreateTournament} className="w-full bg-purple-500 hover:bg-purple-600">
                {t('tournament_btn_create')}
              </Button>
            </div>
          </div>
        )}

        {/* Tournament List */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4 scrollbar-hide">
          {loading && (
            <div className="text-center text-neutral-500 text-sm py-10">{t('tournament_loading')}</div>
          )}
          {!loading && errorMsg && (
            <div className="text-center text-red-400 text-sm py-10">{errorMsg}</div>
          )}
          {/* Active Tournaments */}
          <div>
            <h3 className="text-[10px] font-bold text-green-500 uppercase tracking-widest mb-3 pl-1">
              {t('tournament_status_active')}
            </h3>
            {!loading && tournaments.filter(t => t.status === 'active').map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                <button
                  onClick={() => setSelectedTournament(tournament)}
                  className="w-full bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{tournament.description}</p>
                    </div>
                    <div className="bg-green-500/20 px-2 py-1 rounded-lg">
                      <span className="text-[10px] text-green-400 font-bold">{statusLabel(tournament.status)}</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Coins size={12} className="text-yellow-400" />
                      <span className="text-yellow-400 font-bold">{tournament.total_prize_pool?.toLocaleString?.() || tournament.total_prize_pool || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Users size={12} className="text-neutral-400" />
                      <span className="text-white font-bold">{tournament.current_participants}/{tournament.max_players}</span>
                    </div>
                  </div>
                </button>
                {canDeleteTournament(tournament) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: tournament.id, name: tournament.name });
                    }}
                    className="absolute top-2 right-2 bg-red-500/20 p-2 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10"
                    title={t('tournament_delete_btn')}
                  >
                    <Trash2 className="text-red-400" size={14}/>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Registration Open */}
          <div>
            <h3 className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 pl-1">
              {t('tournament_status_registration')}
            </h3>
            {!loading && tournaments.filter(t => t.status === 'registration').map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                <button
                  onClick={() => setSelectedTournament(tournament)}
                  className="w-full bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/30 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                      <p className="text-[10px] text-neutral-400 line-clamp-1">{tournament.description}</p>
                    </div>
                    <div className="bg-orange-500/20 px-2 py-1 rounded-lg">
                      <span className="text-[10px] text-orange-400 font-bold">{tournament.entry_fee} Sats</span>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Coins size={12} className="text-yellow-400" />
                      <span className="text-yellow-400 font-bold">{tournament.total_prize_pool?.toLocaleString?.() || tournament.total_prize_pool || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Users size={12} className="text-neutral-400" />
                      <span className="text-white font-bold">{tournament.current_participants}/{tournament.max_players}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Calendar size={12} className="text-neutral-400" />
                      <span className="text-neutral-400">{tournament.registration_ends_at ? new Date(tournament.registration_ends_at).toLocaleDateString() : '-'}</span>
                    </div>
                  </div>
                </button>
                {canDeleteTournament(tournament) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: tournament.id, name: tournament.name });
                    }}
                    className="absolute top-2 right-2 bg-red-500/20 p-2 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10"
                    title={t('tournament_delete_btn')}
                  >
                    <Trash2 className="text-red-400" size={14}/>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Finished */}
          <div>
            <h3 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1">
              {t('tournament_status_finished')}
            </h3>
            {!loading && tournaments.filter(t => t.status === 'finished').map(tournament => (
              <div key={tournament.id} className="relative mb-3">
                <button
                  onClick={() => setSelectedTournament(tournament)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 hover:scale-[1.02] transition-transform text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="text-white font-black text-sm mb-1">{tournament.name}</h4>
                      <p className="text-[10px] text-neutral-400">{tournament.winner ? (<><span className="text-yellow-400 font-bold">{tournament.winner}</span></>) : '-'}</p>
                    </div>
                    <Trophy size={16} className="text-yellow-400" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1 text-[10px]">
                      <Coins size={12} className="text-yellow-400" />
                      <span className="text-yellow-400 font-bold">{tournament.total_prize_pool?.toLocaleString?.() || tournament.total_prize_pool || 0}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]">
                      <Users size={12} className="text-neutral-400" />
                      <span className="text-white font-bold">{tournament.max_players}</span>
                    </div>
                  </div>
                </button>
                {canDeleteTournament(tournament) && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ id: tournament.id, name: tournament.name });
                    }}
                    className="absolute top-2 right-2 bg-red-500/20 p-2 rounded-lg hover:bg-red-500/30 transition-colors border border-red-500/50 z-10"
                    title={t('tournament_delete_btn')}
                  >
                    <Trash2 className="text-red-400" size={14}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                <Trash2 className="text-red-500" size={32} />
              </div>
              <h3 className="text-xl font-black text-white uppercase">{t('tournament_delete_confirm_title')}</h3>
              <p className="text-neutral-400 text-sm">
                {t('tournament_delete_confirm_text', { name: deleteConfirm.name })}
              </p>
              <p className="text-xs text-red-400">
                {t('tournament_delete_confirm_warning')}
              </p>
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all"
                >
                  {t('btn_cancel')}
                </button>
                <button 
                  onClick={() => handleDeleteTournament(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  {t('tournament_delete_btn')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {claimModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center border-2 border-green-500">
                <Trophy className="text-green-400" size={28} />
              </div>
              <h3 className="text-xl font-black text-white uppercase">
                {claimModal.type === 'prize' ? t('tournament_claim_title_prize') : t('tournament_claim_title_fees')}
              </h3>
              <p className="text-neutral-400 text-sm">
                {t('tournament_claim_scan_hint')}
              </p>

              <div className="bg-white p-3 rounded-2xl shadow-lg">
                <QRCodeCanvas value={`lightning:${claimModal.lnurl}`} size={200} />
              </div>

              <div className="text-sm text-white font-bold">
                {t('tournament_claim_amount_label')}: {claimModal.amount} Sats
              </div>

              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(claimModal.lnurl);
                    alert(t('nostr_copied') || 'Kopiert!');
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Copy size={16} /> {t('btn_copy_withdraw')}
                </button>
                <a
                  href={`lightning:${claimModal.lnurl}`}
                  className="flex-1 px-4 py-3 rounded-xl bg-green-500 text-black font-bold hover:bg-green-400 transition-all flex items-center justify-center gap-2"
                >
                  <Wallet size={16} /> {t('btn_wallet')}
                </a>
              </div>

              <button
                onClick={() => setClaimModal(null)}
                className="text-xs text-neutral-500 font-bold uppercase hover:text-white"
              >
                {t('btn_cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Background>
  );
};

export default TournamentsView;
