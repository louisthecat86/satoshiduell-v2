#!/usr/bin/env python3
"""Analyse aller Duelle in der Supabase-Datenbank."""
import json
import urllib.request

SUPABASE_URL = "https://uydjemquyogdemjtxyyv.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5ZGplbXF1eW9nZGVtanR4eXl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg5OTEzNDcsImV4cCI6MjA4NDU2NzM0N30.YPTpsDEF1_aSFnGU2Qp-nR12QSv3sTBK8CGlhD4fVIU"

fields = "id,status,mode,creator,challenger,target_player,amount,creator_score,challenger_score,creator_time,challenger_time,winner,is_claimed,withdraw_link,withdraw_id,creator_payment_hash,challenger_payment_hash,creator_paid_at,challenger_paid_at,payout_amount,current_pot,created_at,refund_claimed,participant_scores,participant_times,participant_payment_hashes,participant_paid_at,participants,max_players,refund_links,refund_ids"

url = f"{SUPABASE_URL}/rest/v1/duels?select={fields}&order=created_at.desc&limit=500"

req = urllib.request.Request(url, headers={
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
})

with urllib.request.urlopen(req) as resp:
    duels = json.loads(resp.read().decode())

print(f"=== {len(duels)} Duelle geladen ===\n")

# Stats
statuses = {}
issues = []

for d in duels:
    s = d.get("status", "?")
    statuses[s] = statuses.get(s, 0) + 1

print("STATUS VERTEILUNG:")
for s, c in sorted(statuses.items(), key=lambda x: -x[1]):
    print(f"  {s}: {c}")
print()

# Analyse jedes Duells
for d in duels:
    gid = str(d.get("id", "?"))[:8]
    status = d.get("status")
    mode = d.get("mode", "duel")
    creator = d.get("creator", "?")
    challenger = d.get("challenger")
    target = d.get("target_player")
    amount = d.get("amount", 0)
    cs = d.get("creator_score")
    chs = d.get("challenger_score")
    ct = d.get("creator_time")
    cht = d.get("challenger_time")
    winner = d.get("winner")
    claimed = d.get("is_claimed")
    wlink = d.get("withdraw_link")
    wid = d.get("withdraw_id")
    c_hash = d.get("creator_payment_hash")
    ch_hash = d.get("challenger_payment_hash")
    c_paid = d.get("creator_paid_at")
    ch_paid = d.get("challenger_paid_at")
    created = d.get("created_at", "?")[:16]
    game_issues = []

    is_arena = mode == "arena"

    if status == "finished" and not is_arena:
        # Challenger fehlt aber Score da
        if not challenger and chs is not None:
            game_issues.append(f"🔴 CHALLENGER-NAME FEHLT aber Score {chs} vorhanden{f' (target: {target})' if target else ''}")
        # Kein Winner gesetzt
        if not winner:
            if cs is not None and chs is not None:
                game_issues.append(f"🔴 KEIN GEWINNER gesetzt (Score {cs}:{chs})")
            elif cs is None or chs is None:
                game_issues.append(f"🔴 SCORES UNVOLLSTÄNDIG (creator:{cs}, challenger:{chs})")
        # Winner aber kein Withdraw
        if winner and not wlink and not wid:
            game_issues.append(f"🔴 GEWINNER {winner} OHNE AUSZAHLUNGSLINK")
        # Withdraw nicht claimed
        if wlink and not claimed:
            game_issues.append(f"🟡 AUSZAHLUNG NICHT ABGEHOLT (winner: {winner})")
        # Creator bezahlt, Challenger nicht
        if c_paid and not ch_paid and challenger:
            game_issues.append(f"🟡 CHALLENGER {challenger} hat nicht bezahlt")
        if not c_paid and not ch_paid:
            game_issues.append(f"🟡 NIEMAND hat bezahlt aber Spiel finished")
        # Challenger ohne Payment Hash
        if challenger and not ch_hash:
            game_issues.append(f"🟡 CHALLENGER {challenger} ohne Payment Hash")

    elif status == "open":
        if c_paid and not challenger:
            game_issues.append(f"🟡 WARTET AUF GEGNER (Creator {creator} hat {amount} Sats bezahlt)")
        if not c_paid and not c_hash:
            game_issues.append(f"🔴 STATUS OPEN aber Creator hat nie bezahlt")

    elif status == "pending_payment":
        game_issues.append(f"ℹ️ AUSSTEHENDE ZAHLUNG von {creator}")

    elif status == "active" and not is_arena:
        if cs is not None and chs is None:
            game_issues.append(f"🟡 CREATOR hat gespielt ({cs}), Challenger {challenger} nicht")
        if chs is not None and cs is None:
            game_issues.append(f"🟡 CHALLENGER hat gespielt ({chs}), Creator {creator} nicht")

    elif status == "cancelled" or status == "refunded":
        rc = d.get("refund_claimed") or {}
        if c_paid:
            if not rc.get(creator):
                game_issues.append(f"🔴 CREATOR {creator} hat bezahlt, REFUND NICHT ABGEHOLT")
        if ch_paid and challenger:
            if not rc.get(challenger):
                game_issues.append(f"🔴 CHALLENGER {challenger} hat bezahlt, REFUND NICHT ABGEHOLT")

    if is_arena and status == "finished":
        participants = d.get("participants") or []
        scores = d.get("participant_scores") or {}
        p_hashes = d.get("participant_payment_hashes") or {}
        p_paid = d.get("participant_paid_at") or {}
        rc = d.get("refund_claimed") or {}
        if not winner:
            game_issues.append(f"🔴 ARENA OHNE GEWINNER ({len(participants)} Teilnehmer)")
        if winner and not wlink and not wid:
            game_issues.append(f"🔴 ARENA GEWINNER {winner} OHNE AUSZAHLUNG")
        if wlink and not claimed:
            game_issues.append(f"🟡 ARENA AUSZAHLUNG NICHT ABGEHOLT")
        for p in participants:
            if not p_hashes.get(p) and not p_paid.get(p):
                game_issues.append(f"🟡 ARENA: {p} ohne Zahlungsnachweis")

    if game_issues:
        print(f"{'─'*60}")
        print(f"SPIEL {gid}... | {status.upper()} | {mode} | {created}")
        print(f"  {creator} vs {challenger or target or '?'} | {amount} Sats | Score: {cs}:{chs}")
        if winner: print(f"  Winner: {winner} | Claimed: {claimed}")
        for issue in game_issues:
            print(f"  {issue}")
        issues.append((gid, game_issues))

print(f"\n{'='*60}")
print(f"ZUSAMMENFASSUNG: {len(issues)} Spiele mit Problemen von {len(duels)} total")
errors = sum(1 for _, gi in issues for g in gi if "🔴" in g)
warnings = sum(1 for _, gi in issues for g in gi if "🟡" in g)
print(f"  🔴 Fehler: {errors}")
print(f"  🟡 Warnungen: {warnings}")

# Summe verlorene Sats
lost_sats = 0
for d in duels:
    status = d.get("status")
    mode = d.get("mode", "duel")
    if status == "finished" and not d.get("winner") and mode != "arena":
        if d.get("creator_paid_at"):
            lost_sats += d.get("amount", 0)
        if d.get("challenger_paid_at"):
            lost_sats += d.get("amount", 0)
    if status in ("open",) and d.get("creator_paid_at"):
        lost_sats += d.get("amount", 0)
print(f"  💰 Geschätzte blockierte/verlorene Sats: {lost_sats}")
