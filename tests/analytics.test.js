'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Analytics } = require('./helpers');

// Builds a normalized record the way Parser.buildRecord would, without
// needing a real Excel file.
function makeRecord({ dateHired = null, exitDate = null, reason = 'Other', department = 'Eng' }) {
  const year      = exitDate ? exitDate.getFullYear()  : null;
  const month     = exitDate ? exitDate.getMonth() + 1 : null;
  const yearMonth = exitDate ? `${year}-${String(month).padStart(2, '0')}` : null;
  return { name: 'X', department, dateHired, exitDate, reason, remarks: '', year, month, yearMonth, monthLabel: null };
}

test('compute([]) returns empty, zeroed-out results', () => {
  const r = Analytics.compute([]);
  assert.equal(r.totalExits, 0);
  assert.deepEqual(r.peakMonth, { label: '—', count: 0, pct: '0.0' });
  assert.equal(r.monthlyHeadcount.length, 0);
  assert.equal(r.byYearMonth.length, 0);
  assert.equal(r.years.length, 0);
});

test('active employees (no exit date) are excluded from totalExits and byReason', () => {
  const records = [
    makeRecord({ dateHired: new Date(2023, 0, 1), exitDate: new Date(2023, 5, 15), reason: 'Resignation' }),
    makeRecord({ dateHired: new Date(2023, 2, 1), exitDate: null }),
  ];
  const r = Analytics.compute(records);
  assert.equal(r.totalExits, 1);
  assert.equal(r.byReason.get('Resignation'), 1);
  assert.equal(r.byReason.has('Other'), false);
});

test('byYearByReason tallies departures per year and reason', () => {
  const records = [
    makeRecord({ exitDate: new Date(2022, 3, 1), reason: 'Resignation' }),
    makeRecord({ exitDate: new Date(2022, 6, 1), reason: 'Termination' }),
    makeRecord({ exitDate: new Date(2023, 1, 1), reason: 'Resignation' }),
  ];
  const r = Analytics.compute(records);
  assert.deepEqual(r.years, [2022, 2023]);
  assert.equal(r.byYearByReason.get(2022).get('Resignation'), 1);
  assert.equal(r.byYearByReason.get(2022).get('Termination'), 1);
  assert.equal(r.byYearByReason.get(2023).get('Resignation'), 1);
});

test('monthlyHeadcount gap-fills months with zero departures between the first and last', () => {
  const records = [
    makeRecord({ exitDate: new Date(2024, 0, 10), reason: 'Resignation' }),
    makeRecord({ exitDate: new Date(2024, 2, 5), reason: 'Termination' }),
  ];
  const r = Analytics.compute(records);
  assert.equal(r.monthlyHeadcount.length, 3);
  assert.equal(r.monthlyHeadcount[1].yearMonth, '2024-02');
  assert.equal(r.monthlyHeadcount[1].departures, 0);
  assert.equal(r.monthlyHeadcount[1].beginCount, null, 'no Date Hired data anywhere means headcount stays unknown');
  assert.equal(r.monthlyHeadcount[1].attritionRate, null);
});

test('monthlyHeadcount derives begin/end counts and attrition rate from hire + exit dates', () => {
  const records = [
    makeRecord({ dateHired: new Date(2023, 0, 10), exitDate: new Date(2023, 5, 15), reason: 'Resignation' }),
    makeRecord({ dateHired: new Date(2023, 1, 1), exitDate: new Date(2023, 5, 20), reason: 'Termination' }),
    makeRecord({ dateHired: new Date(2023, 2, 1), exitDate: null }),
    makeRecord({ dateHired: new Date(2023, 4, 1), exitDate: new Date(2023, 7, 10), reason: 'Resignation' }),
  ];
  const r = Analytics.compute(records);
  const june = r.monthlyHeadcount.find(m => m.yearMonth === '2023-06');
  assert.ok(june, 'June entry should exist');
  assert.equal(june.beginCount, 4, 'all 4 employees were hired before June and had not yet exited');
  assert.equal(june.departures, 2, 'two employees exited in June');
  assert.equal(june.endCount, 2, 'the two June exits leave the roster at 2');
  assert.equal(june.attritionRate, '50.00');
});

test('peakMonth picks the month with the most exits and its share of the total', () => {
  const records = [
    makeRecord({ exitDate: new Date(2023, 5, 1), reason: 'Resignation' }),
    makeRecord({ exitDate: new Date(2023, 5, 2), reason: 'Termination' }),
    makeRecord({ exitDate: new Date(2023, 7, 1), reason: 'Resignation' }),
  ];
  const r = Analytics.compute(records);
  assert.equal(r.peakMonth.label, 'Jun 2023');
  assert.equal(r.peakMonth.count, 2);
  assert.equal(r.peakMonth.pct, '66.7');
});

test('avgAttritionRate averages total exits across the number of distinct years present', () => {
  const records = [
    makeRecord({ exitDate: new Date(2022, 0, 1) }),
    makeRecord({ exitDate: new Date(2023, 0, 1) }),
    makeRecord({ exitDate: new Date(2023, 6, 1) }),
    makeRecord({ exitDate: new Date(2024, 0, 1) }),
  ];
  const r = Analytics.compute(records);
  // 4 exits / 3 distinct years = 1.333... -> rounded to 1 decimal place
  assert.equal(r.avgAttritionRate.value, 1.3);
});
