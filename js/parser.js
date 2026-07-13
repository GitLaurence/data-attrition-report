/**
 * Parser — reads an Excel File object and returns normalized employee exit records.
 * Exposed as window.Parser for use in app.js.
 */
window.Parser = (() => {

  const COL_ALIASES = {
    name:       ['name', 'employee name', 'employee', 'full name'],
    lastname:   ['last name', 'lastname', 'surname', 'family name'],
    firstname:  ['first name', 'firstname', 'given name'],
    middlename: ['middle name', 'middlename', 'middle initial'],
    department: ['department', 'dept', 'division', 'team'],
    exitdate:   ['date of last day', 'exit date', 'exitdate', 'termination date',
                 'separation date', 'last day', 'turned over date', 'date'],
    reason:     ['last update', 'reason', 'exit reason', 'separation reason',
                 'type', 'reason for leaving'],
    datehired:  ['date hired', 'datehired', 'date of hire', 'hire date'],
    remarks:    ['remarks', 'notes', 'comment', 'comments'],
  };

  const REASON_MAP = {
    resignation:           'Resignation',
    resigned:              'Resignation',
    resign:                'Resignation',
    voluntary:             'Resignation',
    'voluntary resignation': 'Resignation',
    termination:           'Termination',
    terminated:            'Termination',
    involuntary:           'Termination',
    dismissed:             'Termination',
    fired:                 'Termination',
    'involuntary termination': 'Termination',
    awol:                  'Termination',
    'absent without leave':'Termination',
    retirement:            'Retirement',
    retired:               'Retirement',
    redundancy:            'Redundancy',
    redundant:             'Redundancy',
    'laid off':            'Redundancy',
    layoff:                'Redundancy',
    retrenchment:          'Redundancy',
    'end of contract':     'End of Contract',
    eoc:                   'End of Contract',
    'contract ended':      'End of Contract',
    'contract expired':    'End of Contract',
    'fixed term':          'End of Contract',
    'end of employment':   'End of Contract',
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];

  const MIN_YEAR = 1970;
  const MAX_YEAR = new Date().getFullYear() + 2;

  const EXCEL_FILENAME_RE = /\.(xlsx|xls)$/i;
  function isExcelFilename(name) {
    return EXCEL_FILENAME_RE.test(name);
  }

  function normalizeReason(raw) {
    if (!raw) return 'Other';
    const key = String(raw).toLowerCase().trim();
    if (REASON_MAP[key]) return REASON_MAP[key];
    if (key.startsWith('resign'))   return 'Resignation';
    if (key.startsWith('retir'))    return 'Retirement';
    if (key.startsWith('terminat')) return 'Termination';
    return 'Other';
  }

  // Returns the first column index matching any alias, or -1
  function findIdx(headers, aliases) {
    for (const alias of aliases) {
      const idx = headers.findIndex(h => h.toLowerCase() === alias);
      if (idx !== -1) return idx;
    }
    return -1;
  }

  // Returns index-based column map (array-of-arrays access pattern)
  function resolveColumns(headers) {
    const nameIdx       = findIdx(headers, COL_ALIASES.name);
    const lastNameIdx   = findIdx(headers, COL_ALIASES.lastname);
    const firstNameIdx  = findIdx(headers, COL_ALIASES.firstname);
    const middleNameIdx = findIdx(headers, COL_ALIASES.middlename);
    const splitName     = nameIdx === -1 && lastNameIdx !== -1 && firstNameIdx !== -1;

    return {
      nameIdx,
      lastNameIdx,
      firstNameIdx,
      middleNameIdx: middleNameIdx === -1 ? null : middleNameIdx,
      splitName,
      departmentIdx: findIdx(headers, COL_ALIASES.department),
      exitDateIdx:   findIdx(headers, COL_ALIASES.exitdate),
      reasonIdx:     findIdx(headers, COL_ALIASES.reason),
      dateHiredIdx:  findIdx(headers, COL_ALIASES.datehired),
      remarksIdx:    findIdx(headers, COL_ALIASES.remarks),
    };
  }

  function parseDate(value) {
    if (!value && value !== 0) return null;

    let d = null;

    if (value instanceof Date) {
      d = isNaN(value.getTime()) ? null : value;
    } else if (typeof value === 'number' && value > 1) {
      try {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) d = new Date(parsed.y, parsed.m - 1, parsed.d);
      } catch (_) {}
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const tmp = new Date(trimmed);
      d = isNaN(tmp.getTime()) ? null : tmp;
    }

    if (!d) return null;
    const y = d.getFullYear();
    return (y >= MIN_YEAR && y <= MAX_YEAR) ? d : null;
  }

  function buildRecord(row, colMap) {
    let name;
    if (colMap.splitName) {
      const last  = String(row[colMap.lastNameIdx]  || '').trim();
      const first = String(row[colMap.firstNameIdx] || '').trim();
      const mid   = colMap.middleNameIdx !== null
        ? String(row[colMap.middleNameIdx] || '').trim()
        : '';
      name = [first, mid, last].filter(Boolean).join(' ') || 'Unknown';
    } else {
      name = String(row[colMap.nameIdx] || '').trim() || 'Unknown';
    }

    const department = String(row[colMap.departmentIdx] || '').trim() || 'Unspecified';
    const exitDate   = parseDate(row[colMap.exitDateIdx]);
    const reason     = normalizeReason(row[colMap.reasonIdx]);
    const dateHired  = colMap.dateHiredIdx !== null ? parseDate(row[colMap.dateHiredIdx]) : null;
    const remarks    = colMap.remarksIdx   !== null ? String(row[colMap.remarksIdx] || '').trim() : '';

    const year       = exitDate ? exitDate.getFullYear()     : null;
    const month      = exitDate ? exitDate.getMonth() + 1    : null;
    const yearMonth  = exitDate ? `${year}-${String(month).padStart(2, '0')}` : null;
    const monthLabel = exitDate ? `${MONTHS[month - 1]} ${year}` : null;

    return { name, department, dateHired, exitDate, reason, remarks, year, month, yearMonth, monthLabel };
  }

  function parse(file) {
    return new Promise((resolve, reject) => {
      if (!isExcelFilename(file.name)) {
        reject(new Error('Please upload an Excel file (.xlsx or .xls).'));
        return;
      }

      if (typeof XLSX === 'undefined') {
        reject(new Error('The Excel parsing library failed to load. Check your internet connection and reload the page.'));
        return;
      }

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file. Please try again.'));

      reader.onload = (e) => {
        // Defer the synchronous XLSX work so the loading overlay can paint first
        setTimeout(() => {
          try {
            const data = new Uint8Array(e.target.result);

            // cellDates: false — skip per-cell date conversion on all columns (major perf win)
            const workbook = XLSX.read(data, { type: 'array', cellDates: false });

            if (!workbook.SheetNames.length) {
              reject(new Error('The Excel file is empty — no sheets found.'));
              return;
            }

            const sheet = workbook.Sheets[workbook.SheetNames[0]];

            // header: 1 → array-of-arrays; avoids creating 147-key objects per row
            const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            if (allRows.length < 2) {
              reject(new Error('The sheet is empty. Please check the file and try again.'));
              return;
            }

            const headers = allRows[0].map(h => String(h).trim());
            const colMap  = resolveColumns(headers);

            const missing = [];
            if (!colMap.splitName && colMap.nameIdx       === -1) missing.push('Name (or Last Name + First Name)');
            if (colMap.departmentIdx === -1) missing.push('Department');
            if (colMap.exitDateIdx   === -1) missing.push('Exit Date (or Date of Last Day)');
            if (colMap.reasonIdx     === -1) missing.push('Reason (or Last Update)');

            if (missing.length) {
              reject(new Error(
                `Missing required column(s): ${missing.join(', ')}. ` +
                `Check that your file has these headers (exact names vary).`
              ));
              return;
            }

            const records  = [];
            const warnings = [];
            let unreadableDateCount = 0;
            let hireAfterExitCount  = 0;

            for (let i = 1; i < allRows.length; i++) {
              const row = allRows[i];

              const nameVal = colMap.splitName
                ? (String(row[colMap.lastNameIdx]  || '').trim() ||
                   String(row[colMap.firstNameIdx] || '').trim())
                : String(row[colMap.nameIdx] || '').trim();
              const dateVal = String(row[colMap.exitDateIdx] || '').trim();

              if (!nameVal && !dateVal) {
                continue;
              }

              const record = buildRecord(row, colMap);

              // Blank Exit Date is expected for active employees — only flag
              // rows that had a value we failed to parse.
              if (!record.exitDate && dateVal) unreadableDateCount++;

              if (record.dateHired && record.exitDate && record.dateHired > record.exitDate) {
                hireAfterExitCount++;
              }

              records.push(record);
            }

            if (!records.length) {
              reject(new Error('No valid records found in the file.'));
              return;
            }

            if (unreadableDateCount > 0) {
              warnings.push(
                `${unreadableDateCount} row(s) had unreadable Exit Date values and will be excluded from time-based charts.`
              );
            }

            if (hireAfterExitCount > 0) {
              warnings.push(
                `${hireAfterExitCount} row(s) have a Date Hired after their Exit Date — check these for typos.`
              );
            }

            const emptyNameCount = records.filter(r => r.name === 'Unknown').length;
            if (emptyNameCount > records.length * 0.1) {
              warnings.push(
                `${emptyNameCount} row(s) have a blank Name field — this may indicate merged cells.`
              );
            }

            resolve({ records, warnings });

          } catch (err) {
            reject(new Error('Failed to parse the Excel file. Make sure it is a valid .xlsx or .xls file.'));
          }
        }, 0);
      };

      reader.readAsArrayBuffer(file);
    });
  }

  return { parse, isExcelFilename, normalizeReason, parseDate };

})();
