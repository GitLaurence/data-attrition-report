/**
 * app.js — entry point and orchestrator.
 * Wires all DOM events and coordinates Parser → Analytics → Charts → Exporter.
 */
(function () {

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    records:         null,
    analyticsResult: null,
    fileName:        '',
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  let $uploadSection, $dashboardSection;
  let $dropZone, $fileInput, $btnBrowse;
  let $btnExportExcel, $btnExportPDF, $btnReset;
  let $fileBadgeName, $fileBadgeCount;
  let $valTotal, $valPeakMonth, $valPeakDetail, $valAvgRate, $valAvgRateSub;
  let $loadingOverlay, $loadingText;
  let $toastContainer;

  // ── Initialise ────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    $uploadSection    = document.getElementById('upload-section');
    $dashboardSection = document.getElementById('dashboard-section');
    $dropZone         = document.getElementById('drop-zone');
    $fileInput        = document.getElementById('file-input');
    $btnBrowse        = document.getElementById('btn-browse');
    $btnExportExcel   = document.getElementById('btn-export-excel');
    $btnExportPDF     = document.getElementById('btn-export-pdf');
    $btnReset         = document.getElementById('btn-reset');
    $fileBadgeName    = document.getElementById('file-badge-name');
    $fileBadgeCount   = document.getElementById('file-badge-count');
    $valTotal         = document.getElementById('val-total');
    $valPeakMonth     = document.getElementById('val-peak-month');
    $valPeakDetail    = document.getElementById('val-peak-detail');
    $valAvgRate       = document.getElementById('val-avg-rate');
    $valAvgRateSub    = document.getElementById('val-avg-rate-sub');
    $loadingOverlay   = document.getElementById('loading-overlay');
    $loadingText      = document.getElementById('loading-text');
    $toastContainer   = document.getElementById('toast-container');

    bindEvents();
  });

  // ── Event binding ─────────────────────────────────────────────────────────
  function bindEvents() {
    $btnBrowse.addEventListener('click', () => $fileInput.click());
    $fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFileSelect(e.target.files[0]);
    });

    $dropZone.addEventListener('click', (e) => {
      if (e.target === $btnBrowse || $btnBrowse.contains(e.target)) return;
      $fileInput.click();
    });
    $dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        $fileInput.click();
      }
    });

    // Drag and drop
    $dropZone.addEventListener('dragenter', (e) => {
      e.preventDefault();
      $dropZone.classList.add('drop-zone--hover');
    });
    $dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      $dropZone.classList.add('drop-zone--hover');
    });
    $dropZone.addEventListener('dragleave', (e) => {
      if (!$dropZone.contains(e.relatedTarget)) {
        $dropZone.classList.remove('drop-zone--hover');
      }
    });
    $dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      $dropZone.classList.remove('drop-zone--hover');
      $dropZone.classList.add('drop-zone--active');
      setTimeout(() => $dropZone.classList.remove('drop-zone--active'), 150);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    });

    // Prevent browser from opening dropped file outside the zone
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop',     (e) => e.preventDefault());

    $btnReset.addEventListener('click', handleReset);
    $btnExportExcel.addEventListener('click', handleExportExcel);
    $btnExportPDF.addEventListener('click',   handleExportPDF);
  }

  // Yields to the browser for one paint frame
  function nextFrame() {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  // ── File handling ─────────────────────────────────────────────────────────
  async function handleFileSelect(file) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      showToast('Please upload an Excel file (.xlsx or .xls)', 'error');
      return;
    }

    showLoading(true, 'Reading file…');
    await nextFrame(); // let overlay paint before FileReader starts

    try {
      const { records, warnings } = await Parser.parse(file);

      showLoading(true, 'Building report…');
      await nextFrame(); // let text update paint before sync chart/analytics work

      state.records  = records;
      state.fileName = file.name;

      state.analyticsResult          = Analytics.compute(records);
      state.analyticsResult._records = records;

      Charts.render(state.analyticsResult);
      updateStatCards(state.analyticsResult);

      $fileBadgeName.textContent  = file.name;
      $fileBadgeCount.textContent = `${records.length} record${records.length !== 1 ? 's' : ''}`;

      $uploadSection.classList.add('hidden');
      $dashboardSection.classList.remove('hidden');

      $btnExportExcel.disabled = false;
      $btnExportPDF.disabled   = false;

      for (const w of warnings) {
        showToast(w, 'warning', 6000);
      }

      showToast(`Loaded ${records.length} records from ${file.name}`, 'success');

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      showLoading(false);
      // Allow the same file to be re-uploaded
      $fileInput.value = '';
    }
  }

  function handleReset() {
    Charts.destroy();

    state.records         = null;
    state.analyticsResult = null;
    state.fileName        = '';

    $dashboardSection.classList.add('hidden');
    $uploadSection.classList.remove('hidden');

    $btnExportExcel.disabled = true;
    $btnExportPDF.disabled   = true;

    $fileInput.value    = '';
    $fileBadgeName.textContent  = '';
    $fileBadgeCount.textContent = '';
  }

  function handleExportExcel() {
    if (!state.records || !state.analyticsResult) return;
    try {
      Exporter.toExcel(state.records, state.analyticsResult);
      showToast('Excel file downloaded.', 'success');
    } catch (err) {
      showToast('Failed to export Excel: ' + err.message, 'error');
    }
  }

  function handleExportPDF() {
    if (!state.analyticsResult) return;
    showLoading(true, 'Generating PDF…');
    // Defer slightly so the overlay renders before the synchronous PDF build
    setTimeout(() => {
      try {
        const images   = Charts.getImages();
        const baseName = state.fileName.replace(/\.[^.]+$/, '');
        Exporter.toPDF(state.analyticsResult, images, `${baseName}-report.pdf`);
        showToast('PDF file downloaded.', 'success');
      } catch (err) {
        showToast('Failed to export PDF: ' + err.message, 'error');
      } finally {
        showLoading(false);
      }
    }, 50);
  }

  // ── Stat cards ────────────────────────────────────────────────────────────
  function updateStatCards(result) {
    animateValue($valTotal,     result.totalExits.toLocaleString());
    animateValue($valPeakMonth, result.peakMonth.label);
    $valPeakDetail.textContent = result.peakMonth.count > 0
      ? `${result.peakMonth.count} exits · ${result.peakMonth.pct}% of total`
      : '';

    animateValue($valAvgRate, `${result.avgAttritionRate.value}`);
    $valAvgRateSub.textContent = 'avg exits per year';

    renderMonthlyTable(result);
  }

  // ── Monthly Headcount Cards ───────────────────────────────────────────────
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function rateClass(rate) {
    if (rate === null) return '';
    const n = parseFloat(rate);
    return n >= 5 ? 'mhc-rate--high' : n >= 2 ? 'mhc-rate--mid' : 'mhc-rate--low';
  }

  function renderMonthlyTable(result) {
    const container = document.getElementById('monthly-table-container');
    const emptyEl   = document.getElementById('monthly-table-empty');
    if (!container) return;

    const rows = result.monthlyHeadcount || [];

    if (rows.length === 0) {
      container.innerHTML = '';
      container.appendChild(emptyEl);
      emptyEl.classList.remove('hidden');
      return;
    }

    emptyEl.classList.add('hidden');

    const years = [...new Set(rows.map(r => r.yearMonth.split('-')[0]))].sort();

    // ── Filter pills ────────────────────────────────────────────────────────
    let yearPills = `<button class="filter-pill filter-pill--active" data-year="all">All</button>`;
    for (const y of years) {
      yearPills += `<button class="filter-pill" data-year="${y}">${y}</button>`;
    }

    let monthPills = `<button class="filter-pill filter-pill--active" data-month="all">All</button>`;
    for (let i = 0; i < 12; i++) {
      monthPills += `<button class="filter-pill" data-month="${String(i + 1).padStart(2, '0')}">${MONTH_LABELS[i]}</button>`;
    }

    // ── Month cards ─────────────────────────────────────────────────────────
    let cards = '';
    for (const row of rows) {
      const [yr, mo] = row.yearMonth.split('-');
      const net      = row.added - row.departures;
      const rateText = row.attritionRate !== null ? `${row.attritionRate}%` : 'N/A';
      const addedFmt = (row.added > 0 ? '+' : '') + row.added.toLocaleString();

      let netClass, netArrow, netVal;
      if (net > 0)      { netClass = 'mhc-net--up';   netArrow = '▲'; netVal = `+${net.toLocaleString()}`; }
      else if (net < 0) { netClass = 'mhc-net--down'; netArrow = '▼'; netVal = net.toLocaleString(); }
      else              { netClass = 'mhc-net--flat';  netArrow = '—'; netVal = '0'; }

      const headcountBlock = row.endCount !== null
        ? `<div class="mhc-headcount">
             <span class="mhc-headcount__val">${row.endCount.toLocaleString()}</span>
             <span class="mhc-headcount__lbl">End of Month</span>
           </div>`
        : `<div class="mhc-headcount mhc-headcount--no-data">
             <span class="mhc-headcount__lbl">Add Date Hired for headcount</span>
           </div>`;

      cards += `
        <div class="mhc-card" data-year="${yr}" data-month="${mo}"
             data-begin="${row.beginCount ?? -1}" data-end="${row.endCount ?? -1}"
             data-added="${row.added}" data-departures="${row.departures}">
          <div class="mhc-card__header">
            <span class="mhc-card__month">${row.label}</span>
            <span class="mhc-rate ${rateClass(row.attritionRate)}">${rateText}</span>
          </div>
          <div class="mhc-card__body">
            ${headcountBlock}
            <div class="mhc-net ${netClass}">
              <span class="mhc-net__arrow">${netArrow}</span>
              <span class="mhc-net__val">${netVal}</span>
              <span class="mhc-net__lbl">net</span>
            </div>
            <div class="mhc-card__breakdown">
              <div class="mhc-breakdown__item mhc-breakdown__item--added">
                <span class="mhc-breakdown__val">${addedFmt}</span>
                <span class="mhc-breakdown__lbl">Hired</span>
              </div>
              <div class="mhc-breakdown__item mhc-breakdown__item--dep">
                <span class="mhc-breakdown__val">${row.departures.toLocaleString()}</span>
                <span class="mhc-breakdown__lbl">Departed</span>
              </div>
            </div>
          </div>
        </div>`;
    }

    // ── Summary card ────────────────────────────────────────────────────────
    cards += `
      <div class="mhc-card mhc-card--summary">
        <div class="mhc-card__header">
          <span class="mhc-card__month">Period Summary</span>
          <span class="mhc-rate" id="sum-rate">—</span>
        </div>
        <div class="mhc-card__metrics">
          <div class="mhc-metric">
            <span class="mhc-metric__val" id="sum-begin">—</span>
            <span class="mhc-metric__lbl">Period Start</span>
          </div>
          <div class="mhc-metric mhc-metric--added">
            <span class="mhc-metric__val" id="sum-added">—</span>
            <span class="mhc-metric__lbl">Total Hired</span>
          </div>
          <div class="mhc-metric mhc-metric--dep">
            <span class="mhc-metric__val" id="sum-dep">—</span>
            <span class="mhc-metric__lbl">Total Exits</span>
          </div>
          <div class="mhc-metric">
            <span class="mhc-metric__val" id="sum-end">—</span>
            <span class="mhc-metric__lbl">Period End</span>
          </div>
        </div>
        <div class="mhc-sparkline-wrap" id="sum-sparkline"></div>
      </div>`;

    container.innerHTML = `
      <div class="monthly-table-filters">
        <div class="filter-group">
          <span class="filter-group__label">Year</span>
          <div class="filter-pills" id="mhc-year-filter">${yearPills}</div>
        </div>
        <div class="filter-group">
          <span class="filter-group__label">Month</span>
          <div class="filter-pills" id="mhc-month-filter">${monthPills}</div>
        </div>
      </div>
      <div class="mhc-period-bar">
        <div class="mhc-kpi">
          <span class="mhc-kpi__val" id="kpi-start">—</span>
          <span class="mhc-kpi__lbl">Period Start</span>
        </div>
        <div class="mhc-kpi mhc-kpi--hired">
          <span class="mhc-kpi__val" id="kpi-hired">—</span>
          <span class="mhc-kpi__lbl">Total Hired</span>
        </div>
        <div class="mhc-kpi mhc-kpi--exits">
          <span class="mhc-kpi__val" id="kpi-exits">—</span>
          <span class="mhc-kpi__lbl">Total Exits</span>
        </div>
        <div class="mhc-kpi">
          <span class="mhc-kpi__val" id="kpi-end">—</span>
          <span class="mhc-kpi__lbl">Period End</span>
        </div>
        <div class="mhc-kpi" id="kpi-attrition-wrap">
          <span class="mhc-kpi__val" id="kpi-attrition">—</span>
          <span class="mhc-kpi__lbl">Avg Attrition</span>
        </div>
      </div>
      <div class="mhc-grid">${cards}</div>`;

    // ── Filter logic ────────────────────────────────────────────────────────
    let activeYear = 'all', activeMonth = 'all';

    function buildSparkline(endCounts) {
      if (endCounts.length < 2) return '';
      const W = 400, H = 44, pad = 6;
      const min = Math.min(...endCounts);
      const max = Math.max(...endCounts);
      const range = max - min || 1;
      const pts = endCounts.map((v, i) => {
        const x = pad + (i / (endCounts.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v - min) / range) * (H - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      const lastPt = pts[pts.length - 1].split(',');
      return `<svg class="mhc-sparkline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${pts.join(' ')}" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${lastPt[0]}" cy="${lastPt[1]}" r="3.5" fill="var(--color-primary)"/>
      </svg>`;
    }

    function applyFilter() {
      const monthCards = container.querySelectorAll('.mhc-card:not(.mhc-card--summary)');
      let visBegin = -1, visEnd = -1, visAdded = 0, visDep = 0, firstSet = false;
      const sparkPoints = [];

      for (const card of monthCards) {
        const matchY  = activeYear  === 'all' || card.dataset.year  === activeYear;
        const matchM  = activeMonth === 'all' || card.dataset.month === activeMonth;
        const visible = matchY && matchM;
        card.style.display = visible ? '' : 'none';

        if (visible) {
          const b = parseInt(card.dataset.begin);
          const e = parseInt(card.dataset.end);
          if (!firstSet && b !== -1) { visBegin = b; firstSet = true; }
          if (e !== -1) visEnd = e;
          visAdded += parseInt(card.dataset.added);
          visDep   += parseInt(card.dataset.departures);
          if (e !== -1) sparkPoints.push(e);
        }
      }

      const sumRate   = visBegin > 0 ? ((visDep / visBegin) * 100).toFixed(2) : null;
      const sumRateEl = document.getElementById('sum-rate');
      sumRateEl.textContent = sumRate !== null ? `${sumRate}%` : '—';
      sumRateEl.className   = `mhc-rate ${rateClass(sumRate)}`;

      const fmtBegin = visBegin !== -1 ? visBegin.toLocaleString() : '—';
      const fmtEnd   = visEnd   !== -1 ? visEnd.toLocaleString()   : '—';
      document.getElementById('sum-begin').textContent = fmtBegin;
      document.getElementById('sum-added').textContent = `+${visAdded.toLocaleString()}`;
      document.getElementById('sum-dep').textContent   = visDep.toLocaleString();
      document.getElementById('sum-end').textContent   = fmtEnd;

      document.getElementById('kpi-start').textContent = fmtBegin;
      document.getElementById('kpi-hired').textContent = `+${visAdded.toLocaleString()}`;
      document.getElementById('kpi-exits').textContent = visDep.toLocaleString();
      document.getElementById('kpi-end').textContent   = fmtEnd;

      const kpiAttrEl  = document.getElementById('kpi-attrition');
      const kpiWrapEl  = document.getElementById('kpi-attrition-wrap');
      kpiAttrEl.textContent = sumRate !== null ? `${sumRate}%` : '—';
      kpiWrapEl.className   = `mhc-kpi mhc-kpi--attrition ${rateClass(sumRate).replace('mhc-rate--', 'mhc-kpi--')}`;

      document.getElementById('sum-sparkline').innerHTML = buildSparkline(sparkPoints);
    }

    function bindPills(containerId, attr) {
      container.querySelector(`#${containerId}`).addEventListener('click', (e) => {
        const pill = e.target.closest(`[data-${attr}]`);
        if (!pill) return;
        if (attr === 'year')  activeYear  = pill.dataset.year;
        if (attr === 'month') activeMonth = pill.dataset.month;
        container.querySelectorAll(`#${containerId} .filter-pill`)
          .forEach(p => p.classList.remove('filter-pill--active'));
        pill.classList.add('filter-pill--active');
        applyFilter();
      });
    }

    bindPills('mhc-year-filter',  'year');
    bindPills('mhc-month-filter', 'month');
    applyFilter();
  }

  function animateValue(el, newText) {
    el.textContent = newText;
    const card = el.closest('.stat-card');
    if (card) {
      card.classList.remove('stat-card--updated');
      void card.offsetWidth; // force reflow
      card.classList.add('stat-card--updated');
      setTimeout(() => card.classList.remove('stat-card--updated'), 300);
    }
  }

  // ── Loading overlay ───────────────────────────────────────────────────────
  let _loadingTimer = null;

  function showLoading(visible, text) {
    if (!$loadingOverlay) return;
    if (visible) {
      if (text && $loadingText) $loadingText.textContent = text;
      $loadingOverlay.classList.remove('hidden');
      // Safety net: dismiss after 30 s in case something hangs
      clearTimeout(_loadingTimer);
      _loadingTimer = setTimeout(() => {
        $loadingOverlay.classList.add('hidden');
        showToast('Processing took too long. Please try again.', 'error');
      }, 30000);
    } else {
      clearTimeout(_loadingTimer);
      $loadingOverlay.classList.add('hidden');
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  const TOAST_ICONS = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
  };

  function showToast(message, type = 'success', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] || ''}</span>
      <span class="toast__body">${message}</span>
      <button class="toast__close" aria-label="Dismiss">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>`;

    $toastContainer.appendChild(toast);

    function dismiss() {
      toast.classList.add('toast--exiting');
      setTimeout(() => toast.remove(), 260);
    }

    toast.querySelector('.toast__close').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

})();
