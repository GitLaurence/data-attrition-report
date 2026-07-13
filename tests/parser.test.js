'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Parser } = require('./helpers');

test('isExcelFilename accepts .xlsx/.xls case-insensitively, rejects others', () => {
  assert.equal(Parser.isExcelFilename('report.xlsx'), true);
  assert.equal(Parser.isExcelFilename('report.XLS'), true);
  assert.equal(Parser.isExcelFilename('report.csv'), false);
  assert.equal(Parser.isExcelFilename('report.txt'), false);
  assert.equal(Parser.isExcelFilename('xlsx'), false);
});

test('normalizeReason maps known aliases to canonical categories', () => {
  assert.equal(Parser.normalizeReason('Resigned'), 'Resignation');
  assert.equal(Parser.normalizeReason('VOLUNTARY'), 'Resignation');
  assert.equal(Parser.normalizeReason('resignation letter'), 'Resignation');
  assert.equal(Parser.normalizeReason('Terminated'), 'Termination');
  assert.equal(Parser.normalizeReason('AWOL'), 'Termination');
  assert.equal(Parser.normalizeReason('Retired'), 'Retirement');
  assert.equal(Parser.normalizeReason('Laid Off'), 'Redundancy');
  assert.equal(Parser.normalizeReason('EOC'), 'End of Contract');
  assert.equal(Parser.normalizeReason('Fixed Term'), 'End of Contract');
});

test('normalizeReason falls back to Other for blank or unrecognized values', () => {
  assert.equal(Parser.normalizeReason(''), 'Other');
  assert.equal(Parser.normalizeReason(null), 'Other');
  assert.equal(Parser.normalizeReason(undefined), 'Other');
  assert.equal(Parser.normalizeReason('Some Made Up Reason'), 'Other');
});

test('parseDate accepts a valid Date object', () => {
  const d = Parser.parseDate(new Date(2023, 5, 15));
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2023);
  assert.equal(d.getMonth(), 5);
  assert.equal(d.getDate(), 15);
});

test('parseDate rejects an invalid Date object', () => {
  assert.equal(Parser.parseDate(new Date('not a date')), null);
});

test('parseDate parses common date strings', () => {
  const d = Parser.parseDate('2024-03-01');
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 2);
});

test('parseDate returns null for blank/whitespace-only strings', () => {
  assert.equal(Parser.parseDate(''), null);
  assert.equal(Parser.parseDate('   '), null);
  assert.equal(Parser.parseDate(null), null);
  assert.equal(Parser.parseDate(undefined), null);
});

test('parseDate rejects years outside the plausible 1970..current+2 range', () => {
  assert.equal(Parser.parseDate('1899-01-01'), null);
  const farFuture = new Date().getFullYear() + 10;
  assert.equal(Parser.parseDate(`${farFuture}-01-01`), null);
});

test('parseDate decodes numeric Excel serial dates via XLSX.SSF', () => {
  // Excel serial 45000 == 2023-03-15 in the 1900 date system.
  const d = Parser.parseDate(45000);
  assert.ok(d instanceof Date);
  assert.equal(d.getFullYear(), 2023);
});
