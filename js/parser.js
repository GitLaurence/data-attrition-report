/**
 * Parser — reads an Excel File object and returns normalized employee exit records.
 * Exposed as window.Parser for use in app.js.
 */
window.Parser = (() => {

  const REQUIRED_COLS = ['name', 'department', 'exit date', 'reason'];

  const COL_ALIASES = {
    name:       ['name', 'employee name', 'employee', 'full name'],
    department: ['department', 'dept', 'division', 'team'],
    exitdate:   ['exit date', 'exitdate', 'date', 'termination date', 'separation date', 'last day'],
    reason:     ['reason', 'exit reason', 'separation reason', 'type', 'reason for leaving'],
  };

  const REASON_MAP = {
    resignation:      'Resignation',
    resigned:         'Resignation',
    voluntary:        'Resignation',
    'voluntary resignation': 'Resignation',
    termination:      'Termination',
    terminated:       'Termination',
    involuntary:      'Termination',
    dismissed:        'Termination',
    fired:            'Termination',
    'involuntary termination': 'Termination',
    retirement:       'Retirement',
    retired:          'Retirement',
    redundancy:       'Redundancy',
    redundant:        'Redundancy',
    'laid off':       'Redundancy',
    layoff:           'Redundancy',
    retrenchment:     'Redundancy',
    'end of contract':'End of Contract',
    eoc:              'End of Contract',
    'contract ended': 'End of Contract',
    'contract expired':'End of Contract',
    'fixed term':     'End of Contract',
    'end of employment':'End of Contract',
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];

  function normalizeReason(raw) {
    if (!raw) return 'Other';
    const key = String(raw).toLowerCase().trim();
    return REASON_MAP[key] || 'Other';
  }

  function findColumnKey(headers, aliases) {
    for (const alias of aliases) {
      const match = headers.find(h => h.toLowerCase().trim() === alias);
      if (match) return match;
    }
    return null;
  }

  function resolveColumns(headers) {
    return {
      name:       findColumnKey(headers, COL_ALIASES.name),
      department: findColumnKey(headers, COL_ALIASES.department),
      exitDate:   findColumnKey(headers, COL_ALIASES.exitdate),
      reason:     findColumnKey(headers, COL_ALIASES.reason),
    };
  }

  function parseDate(value) {
    if (!value && value !== 0) return null;

    // Already a Date object (cellDates: true)
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // Excel serial number (SheetJS raw mode)
    if (typeof value === 'number' && value > 1) {
      try {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (parsed) {
          return new Date(parsed.y, parsed.m - 1, parsed.d);
        }
      } catch (_) {}
      return null;
    }

    // String date
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const d = new Date(trimmed);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  function buildRecord(raw, colMap) {
    const name       = String(raw[colMap.name]       || '').trim() || 'Unknown';
    const department = String(raw[colMap.department]  || '').trim() || 'Unspecified';
    const exitDate   = parseDate(raw[colMap.exitDate]);
    const reason     = normalizeReason(raw[colMap.reason]);

    const year      = exitDate ? exitDate.getFullYear() : null;
    const month     = exitDate ? exitDate.getMonth() + 1 : null;
    const yearMonth = exitDate
      ? `${year}-${String(month).padStart(2, '0')}`
      : null;
    const monthLabel = exitDate
      ? `${MONTHS[month - 1]} ${year}`
      : null;

    return { name, department, exitDate, reason, year, month, yearMonth, monthLabel };
  }

  function parse(file) {
    return new Promise((resolve, reject) => {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        reject(new Error('Please upload an Excel file (.xlsx or .xls).'));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => reject(new Error('Failed to read file. Please try again.'));

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });

          if (!workbook.SheetNames.length) {
            reject(new Error('The Excel file is empty — no sheets found.'));
            return;
          }

          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });

          if (!rawRows.length) {
            reject(new Error('The sheet is empty. Please check the file and try again.'));
            return;
          }

          const headers = Object.keys(rawRows[0]);
          const colMap  = resolveColumns(headers);

          const missing = [];
          if (!colMap.name)       missing.push('Name');
          if (!colMap.department) missing.push('Department');
          if (!colMap.exitDate)   missing.push('Exit Date');
          if (!colMap.reason)     missing.push('Reason');

          if (missing.length) {
            reject(new Error(
              `Missing required column(s): ${missing.join(', ')}. ` +
              `Check that your file has headers: Name, Department, Exit Date, Reason.`
            ));
            return;
          }

          const records  = [];
          const warnings = [];
          let skippedDateCount   = 0;
          let skippedEmptyCount  = 0;

          for (const raw of rawRows) {
            const nameVal = String(raw[colMap.name] || '').trim();
            const dateVal = raw[colMap.exitDate];

            // Skip completely empty rows
            if (!nameVal && !dateVal) {
              skippedEmptyCount++;
              continue;
            }

            const record = buildRecord(raw, colMap);

            if (!record.exitDate) {
              skippedDateCount++;
            }

            records.push(record);
          }

          if (!records.length) {
            reject(new Error('No valid records found in the file.'));
            return;
          }

          if (skippedDateCount > 0) {
            warnings.push(
              `${skippedDateCount} row(s) had unreadable Exit Date values and will be excluded from time-based charts.`
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
      };

      reader.readAsArrayBuffer(file);
    });
  }

  return { parse };

})();
