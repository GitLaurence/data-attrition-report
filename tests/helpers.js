// Loads the app's window-scoped modules into a plain Node process so their
// pure logic (parsing, aggregation) can be exercised with node:test.
'use strict';

global.window = global.window || {};

// Minimal stand-in for SheetJS's date-code decoder, used only by the numeric
// Excel-serial-date branch of Parser.parseDate. Mirrors the 1900 date system
// (serial 1 == 1900-01-01) closely enough for round-trip tests.
global.XLSX = global.XLSX || {
  SSF: {
    parse_date_code(serial) {
      const utcDays = Math.floor(serial - 25569);
      const d = new Date(utcDays * 86400 * 1000);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    },
  },
};

require('../js/parser.js');
require('../js/analytics.js');

module.exports = {
  Parser: global.window.Parser,
  Analytics: global.window.Analytics,
};
