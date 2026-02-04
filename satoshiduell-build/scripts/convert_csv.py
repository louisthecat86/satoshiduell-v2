#!/usr/bin/env python3
import csv
import sys

def detect_delimiter(sample):
    return ';' if sample.count(';') > sample.count(',') else ','

def find_lang(fieldnames):
    for fn in fieldnames:
        if fn.startswith('question_'):
            return fn.split('_',1)[1]
    return None

def main(infile, outfile):
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        sample = f.read(8192)
    delim = detect_delimiter(sample)
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f, delimiter=delim)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    if 'correct_index' in fieldnames:
        lang = find_lang(fieldnames)
        if lang:
            opt_pattern = lambda i: f'option_{lang}_{i}'
        else:
            opt_pattern = lambda i: f'option_{i}'
        if 'correct_answer' not in fieldnames:
            fieldnames.append('correct_answer')
        for r in rows:
            idx = (r.get('correct_index') or '').strip()
            if not idx:
                r['correct_answer'] = ''
                continue
            try:
                i = int(idx)
            except ValueError:
                r['correct_answer'] = idx
                continue
            opt_field = opt_pattern(i)
            r['correct_answer'] = r.get(opt_field, '')
        fieldnames = [f for f in fieldnames if f != 'correct_index']
        for r in rows:
            r.pop('correct_index', None)

    # Entferne komplett leere Zeilen (z.B. ";;;;;;;;;"), die beim Export entstehen können
    filtered_rows = []
    for r in rows:
        # wenn mindestens ein Feld nicht leer ist, behalten
        if any((v or '').strip() for v in r.values()):
            filtered_rows.append(r)
    rows = filtered_rows

    # ensure stable ordering for output: try to keep language-specific columns first
    out_fields = fieldnames
    with open(outfile, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=out_fields, delimiter=',')
        writer.writeheader()
        writer.writerows(rows)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: python3 convert_csv.py input.csv output.csv')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
