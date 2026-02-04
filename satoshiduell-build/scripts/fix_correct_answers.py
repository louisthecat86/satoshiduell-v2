#!/usr/bin/env python3
import csv
import sys
from difflib import SequenceMatcher

THRESHOLD = 0.75

def normalize(s):
    return (s or '').strip()

def best_match(target, options):
    best = None
    best_score = 0.0
    t = normalize(target)
    for opt in options:
        o = normalize(opt)
        score = SequenceMatcher(None, t, o).ratio()
        if score > best_score:
            best_score = score
            best = opt
    return best, best_score

def main(infile, outfile):
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f, delimiter=',')
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    fixes = []
    for i,r in enumerate(rows, start=2):
        ca = (r.get('correct_answer') or '').strip()
        # collect option keys (language-specific or generic)
        option_keys = [k for k in fieldnames if k.startswith('option')]
        options = [r.get(k,'') for k in option_keys]
        if not any(v.strip() for v in options):
            continue
        if ca == '':
            fixes.append((i,'empty_correct',''))
            continue
        # exact match?
        if any((opt or '').strip() == ca for opt in options):
            continue
        # try best fuzzy match
        best, score = best_match(ca, options)
        if best and score >= THRESHOLD:
            r['correct_answer'] = best
            fixes.append((i,'fixed',score,best))
        else:
            fixes.append((i,'no_fix',score,best))

    # write outfile
    with open(outfile, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=',')
        writer.writeheader()
        writer.writerows(rows)

    # report
    print(f'Wrote {outfile}. Rows processed: {len(rows)}')
    if fixes:
        print('\nFixes / issues:')
        for it in fixes:
            if it[1]=='fixed':
                print(f'Row {it[0]}: fixed (score={it[2]:.2f}) -> "{it[3]}"')
            elif it[1]=='empty_correct':
                print(f'Row {it[0]}: missing correct_answer')
            else:
                print(f'Row {it[0]}: no confident match (best_score={it[2]:.2f})')
    else:
        print('No fixes needed')

if __name__=='__main__':
    if len(sys.argv)<3:
        print('Usage: python3 fix_correct_answers.py input.csv output.csv')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
