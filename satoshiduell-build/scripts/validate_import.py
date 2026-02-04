#!/usr/bin/env python3
import csv
import sys

REQUIRED_GENERIC = ['language','question','option1','option2','option3','option4','correct_answer']

def detect_delimiter(sample):
    return ';' if sample.count(';') > sample.count(',') else ','

def find_row_language(row, fieldnames):
    # if explicit language column
    lang = row.get('language','').strip()
    if lang:
        return lang
    # detect any question_{lang}
    for fn in fieldnames:
        if fn.startswith('question_'):
            suf = fn.split('_',1)[1]
            if row.get(f'question_{suf}','').strip():
                return suf
    return None


def validate(infile):
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        sample = f.read(8192)
    delim = detect_delimiter(sample)
    with open(infile, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f, delimiter=delim)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)

    problems = []
    for i, r in enumerate(rows, start=1):
        # skip totally empty rows
        if not any((v or '').strip() for v in r.values()):
            problems.append((i,'empty_row','Row is empty'))
            continue
        lang = find_row_language(r, fieldnames)
        if not lang:
            problems.append((i,'no_language','No language detected: add `language` or language-specific columns like `question_de`'))
            continue
        # determine question and options keys
        q_key = f'question_{lang}' if f'question_{lang}' in fieldnames else 'question'
        opt_keys = []
        # try language-specific option naming
        for j in range(1,5):
            k = f'option_{lang}_{j}'
            if k in fieldnames:
                opt_keys.append(k)
        if not opt_keys:
            # try generic option1..4
            for j in range(1,5):
                k = f'option{j}' if f'option{j}' in fieldnames else f'option_{j}'
                if k in fieldnames:
                    opt_keys.append(k)
        if len(opt_keys) != 4:
            problems.append((i,'missing_options',f'Expected 4 options for language `{lang}` but found {len(opt_keys)}'))
            continue
        # check question presence
        if (r.get(q_key,'') or '').strip() == '':
            problems.append((i,'missing_question',f'Question field `{q_key}` empty'))
            continue
        # check correct_answer
        ca = (r.get('correct_answer') or '').strip()
        if ca == '':
            problems.append((i,'missing_correct','`correct_answer` empty'))
            continue
        # check if correct_answer matches exactly one option
        matches = [k for k in opt_keys if (r.get(k) or '').strip() == ca]
        if len(matches) == 0:
            # maybe correct_answer contains an index number
            if ca.isdigit():
                idx = int(ca)
                if 1 <= idx <= 4:
                    # acceptable if uploader accepts numeric index, but warn
                    problems.append((i,'index_in_correct_answer','`correct_answer` is numeric index; consider replacing with option text'))
                else:
                    problems.append((i,'invalid_index','`correct_answer` numeric but out of 1..4 range'))
            else:
                problems.append((i,'correct_mismatch','`correct_answer` does not equal any option exactly (whitespace/encoding mismatch?)'))
            continue
        if len(matches) > 1:
            problems.append((i,'ambiguous_correct','`correct_answer` matches multiple options'))

    return fieldnames, problems

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 validate_import.py file.csv')
        sys.exit(1)
    fn = sys.argv[1]
    fieldnames, problems = validate(fn)
    print('Detected columns:', ','.join(fieldnames))
    if not problems:
        print('No problems found — file likely acceptable for import.')
    else:
        print('\nProblems found:')
        for i, code, msg in problems:
            print(f'Row {i}: {code} — {msg}')
        print(f'\nTotal problematic rows: {len(problems)}')
