#!/usr/bin/env python3
import csv
import sys
from difflib import SequenceMatcher

THRESHOLD = 0.75

def detect_delimiter(sample):
    return ';' if sample.count(';') > sample.count(',') else ','

def best_match(target, options):
    best = None
    best_score = 0.0
    t = (target or '').strip()
    for opt in options:
        o = (opt or '').strip()
        score = SequenceMatcher(None, t, o).ratio()
        if score > best_score:
            best_score = score
            best = opt
    return best, best_score

def to_bool(val):
    v = (val or '').strip().lower()
    if v in ('1','true','yes','y','t'):
        return 'true'
    return 'false'

def normalize_row(r, fieldnames):
    # detect language
    lang = ''
    for fn in fieldnames:
        if fn.startswith('question_') and (r.get(fn) or '').strip():
            lang = fn.split('_',1)[1]
            break
    if not lang and (r.get('question') or '').strip():
        lang = 'generic'

    # build generic keys
    if lang == 'generic':
        q = r.get('question','').strip()
        opts = [r.get(f'option{i}','').strip() for i in range(1,5)]
    else:
        q = r.get(f'question_{lang}','').strip()
        opts = [r.get(f'option_{lang}_{i}','').strip() for i in range(1,5)]
        # fallback to option_1.. if not present
        if not any(opts):
            opts = [r.get(f'option_{i}','').strip() for i in range(1,5)]
    # correct_answer handling
    ca = (r.get('correct_answer') or '').strip()
    if ca.isdigit():
        idx = int(ca)
        if 1 <= idx <= 4:
            ca = opts[idx-1]
    # if exact match missing, try fuzzy
    if ca and not any(ca == o for o in opts):
        best, score = best_match(ca, opts)
        if best and score >= THRESHOLD:
            ca = best
    return {
        'language': lang if lang!='generic' else '',
        'question': q,
        'option1': opts[0] if len(opts)>0 else '',
        'option2': opts[1] if len(opts)>1 else '',
        'option3': opts[2] if len(opts)>2 else '',
        'option4': opts[3] if len(opts)>3 else '',
        'correct_answer': ca,
        'is_active': to_bool(r.get('is_active','')),
        'is_verified': to_bool(r.get('is_verified','')),
        'difficulty': (r.get('difficulty') or '').strip(),
        'id': (r.get('id') or '').strip(),
    }

def main(infile, outfile):
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        sample = f.read(8192)
    delim = detect_delimiter(sample)
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f, delimiter=delim)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    out_fields = ['language','question','option1','option2','option3','option4','correct_answer','is_active','is_verified','difficulty','id']
    out_rows = []
    issues = []
    for i,r in enumerate(rows, start=2):
        # skip empty rows
        if not any((v or '').strip() for v in r.values()):
            continue
        nr = normalize_row(r, fieldnames)
        # basic validation
        if not nr['question']:
            issues.append((i,'missing_question'))
        if not any(nr[f'option{i}'] for i in range(1,5)):
            issues.append((i,'missing_options'))
        if not nr['correct_answer']:
            issues.append((i,'missing_correct'))
        out_rows.append(nr)

    with open(outfile, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=out_fields, delimiter=',')
        writer.writeheader()
        writer.writerows(out_rows)

    print(f'Wrote {outfile} ({len(out_rows)} rows).')
    if issues:
        print('\nIssues detected:')
        for it in issues:
            print(f'Row {it[0]}: {it[1]}')
        print(f'Total issues: {len(issues)}')
    else:
        print('No issues detected.')

if __name__=='__main__':
    if len(sys.argv) < 3:
        print('Usage: python3 normalize_for_import.py input.csv output.csv')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
