/**
 * Analytics — computes all attrition aggregations from normalized records.
 * Exposed as window.Analytics for use in app.js.
 */
window.Analytics = (() => {

  const CANONICAL_REASONS = [
    'Resignation', 'Termination', 'Retirement', 'Redundancy', 'End of Contract', 'Other'
  ];

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                  'Jul','Aug','Sep','Oct','Nov','Dec'];

  function addMonths(yearMonth, n) {
    let [y, m] = yearMonth.split('-').map(Number);
    m += n;
    while (m > 12) { m -= 12; y++; }
    while (m < 1)  { m += 12; y--; }
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  function yearMonthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS[m - 1]} ${y}`;
  }

  function compute(records) {
    const totalExits = records.length;

    if (totalExits === 0) {
      return {
        totalExits: 0,
        peakMonth: { label: '—', count: 0, pct: '0.0' },
        avgAttritionRate: { value: 0, isRate: false },
        byYearByReason: new Map(),
        byYearMonth: [],
        monthlyHeadcount: [],
        byReason: new Map(),
        byDepartment: new Map(),
        years: [],
        reasons: [],
        departments: [],
      };
    }

    // ── byReason (all records, regardless of date) ──────────────────────────
    const byReason = new Map();
    for (const r of records) {
      byReason.set(r.reason, (byReason.get(r.reason) || 0) + 1);
    }

    // Sort by count descending
    const sortedByReason = new Map(
      [...byReason.entries()].sort((a, b) => b[1] - a[1])
    );

    const reasons = [...sortedByReason.keys()];

    // ── byDepartment (all records, regardless of date) ──────────────────────
    const byDepartment = new Map();
    for (const r of records) {
      byDepartment.set(r.department, (byDepartment.get(r.department) || 0) + 1);
    }

    const sortedByDepartment = new Map(
      [...byDepartment.entries()].sort((a, b) => b[1] - a[1])
    );

    const departments = [...sortedByDepartment.keys()];

    // ── timed records only ──────────────────────────────────────────────────
    const timed = records.filter(r => r.yearMonth !== null);

    // ── byYearByReason ──────────────────────────────────────────────────────
    const byYearByReason = new Map();
    const yearsSet = new Set();

    for (const r of timed) {
      yearsSet.add(r.year);
    }

    const years = [...yearsSet].sort((a, b) => a - b);

    for (const year of years) {
      const reasonMap = new Map();
      for (const reason of CANONICAL_REASONS) {
        reasonMap.set(reason, 0);
      }
      byYearByReason.set(year, reasonMap);
    }

    for (const r of timed) {
      const yearMap = byYearByReason.get(r.year);
      if (yearMap) {
        yearMap.set(r.reason, (yearMap.get(r.reason) || 0) + 1);
      }
    }

    // ── New hires per month (from dateHired) ────────────────────────────────
    const rawHireCounts = new Map();
    for (const r of records) {
      if (!r.dateHired) continue;
      const hy  = r.dateHired.getFullYear();
      const hmo = r.dateHired.getMonth() + 1;
      const hym = `${hy}-${String(hmo).padStart(2, '0')}`;
      rawHireCounts.set(hym, (rawHireCounts.get(hym) || 0) + 1);
    }

    // ── byYearMonth (with gap-fill) ─────────────────────────────────────────
    const rawMonthCounts = new Map();
    for (const r of timed) {
      rawMonthCounts.set(r.yearMonth, (rawMonthCounts.get(r.yearMonth) || 0) + 1);
    }

    let byYearMonth = [];

    if (rawMonthCounts.size > 0) {
      const allYMs = [...rawMonthCounts.keys()].sort();
      const minYM  = allYMs[0];
      const maxYM  = allYMs[allYMs.length - 1];

      let cur = minYM;
      while (cur <= maxYM) {
        byYearMonth.push({
          yearMonth: cur,
          label:     yearMonthLabel(cur),
          count:     rawMonthCounts.get(cur) || 0,
        });
        cur = addMonths(cur, 1);
      }
    }

    // ── monthlyHeadcount (derived from dateHired + exitDate per record) ─────
    let monthlyHeadcount = [];

    const combinedYMs = new Set([
      ...rawMonthCounts.keys(),
      ...rawHireCounts.keys(),
    ]);

    const hiredRecords = records.filter(r => r.dateHired !== null);
    const hasHireData  = hiredRecords.length > 0;

    if (combinedYMs.size > 0) {
      const sortedCombined = [...combinedYMs].sort();
      const minCombined    = sortedCombined[0];
      const maxCombined    = sortedCombined[sortedCombined.length - 1];

      let cur = minCombined;

      while (cur <= maxCombined) {
        const [y, m]  = cur.split('-').map(Number);
        const firstDay = new Date(y, m - 1, 1);
        const lastDay  = new Date(y, m, 0, 23, 59, 59, 999);

        const departures = rawMonthCounts.get(cur) || 0;
        const added      = rawHireCounts.get(cur)  || 0;

        let beginCount = null;
        let endCount   = null;

        if (hasHireData) {
          beginCount = hiredRecords.filter(r =>
            r.dateHired < firstDay &&
            (r.exitDate === null || r.exitDate >= firstDay)
          ).length;

          endCount = hiredRecords.filter(r =>
            r.dateHired <= lastDay &&
            (r.exitDate === null || r.exitDate > lastDay)
          ).length;
        }

        const attritionRate = (beginCount !== null && beginCount > 0)
          ? ((departures / beginCount) * 100).toFixed(2)
          : null;

        monthlyHeadcount.push({
          yearMonth: cur,
          label:     yearMonthLabel(cur),
          beginCount,
          added,
          departures,
          endCount,
          attritionRate,
        });

        cur = addMonths(cur, 1);
      }
    }

    // ── peakMonth ───────────────────────────────────────────────────────────
    let peakMonth = { label: '—', count: 0, pct: '0.0' };

    if (byYearMonth.length > 0) {
      let peak = byYearMonth[0];
      for (const entry of byYearMonth) {
        if (entry.count >= peak.count) peak = entry;
      }
      peakMonth = {
        label: peak.label,
        count: peak.count,
        pct:   totalExits > 0
          ? ((peak.count / totalExits) * 100).toFixed(1)
          : '0.0',
      };
    }

    // ── avgAttritionRate ────────────────────────────────────────────────────
    let avgAttritionRate;

    if (years.length > 0) {
      const avg = totalExits / years.length;
      avgAttritionRate = {
        value:  Math.round(avg * 10) / 10,
        isRate: false,
      };
    } else {
      avgAttritionRate = { value: totalExits, isRate: false };
    }

    return {
      totalExits,
      peakMonth,
      avgAttritionRate,
      byYearByReason,
      byYearMonth,
      monthlyHeadcount,
      byReason: sortedByReason,
      byDepartment: sortedByDepartment,
      years,
      reasons,
      departments,
    };
  }

  return { compute };

})();
