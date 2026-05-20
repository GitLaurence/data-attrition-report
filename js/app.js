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

  // ── Monthly Headcount Table ───────────────────────────────────────────────
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

    // Unique years in the data
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

    // ── Table rows ─────────────────────────────────────────────────────────
    const thead = `
      <thead>
        <tr>
          <th>Month</th>
          <th>Beginning Count</th>
          <th>Employees Added</th>
          <th>Employee Departures</th>
          <th>Ending Count</th>
          <th>Attrition Rate (%)</th>
        </tr>
      </thead>`;

    let tbody = '<tbody>';
    for (const row of rows) {
      const [yr, mo] = row.yearMonth.split('-');
      const begin    = row.beginCount     !== null ? row.beginCount.toLocaleString()     : '—';
      const end      = row.endCount       !== null ? row.endCount.toLocaleString()       : '—';
      const rate     = row.attritionRate  !== null ? `${row.attritionRate}%`             : '—';
      const rateClass = row.attritionRate !== null
        ? (parseFloat(row.attritionRate) >= 5 ? 'cell--high' : 'cell--normal') : '';
      const addedFmt  = (row.added > 0 ? '+' : '') + row.added.toLocaleString();
      tbody += `
        <tr data-year="${yr}" data-month="${mo}"
            data-begin="${row.beginCount ?? -1}"
            data-end="${row.endCount ?? -1}"
            data-added="${row.added}"
            data-departures="${row.departures}">
          <td class="cell--month">${row.label}</td>
          <td data-label="Beginning Count">${begin}</td>
          <td data-label="Employees Added" class="${row.added > 0 ? 'cell--added' : ''}">${addedFmt}</td>
          <td data-label="Departures" class="${row.departures > 0 ? 'cell--departures' : ''}">${row.departures.toLocaleString()}</td>
          <td data-label="Ending Count">${end}</td>
          <td data-label="Attrition Rate" class="${rateClass}">${rate}</td>
        </tr>`;
    }
    tbody += `<tr class="row--total" id="monthly-total-row">
        <td class="cell--month">Summary</td>
        <td data-label="Beginning Count" id="tot-begin">—</td>
        <td data-label="Employees Added"  id="tot-added">—</td>
        <td data-label="Departures"       id="tot-dep">—</td>
        <td data-label="Ending Count"     id="tot-end">—</td>
        <td data-label="Attrition Rate"   id="tot-rate">—</td>
      </tr>`;
    tbody += '</tbody>';

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
      <div class="table-scroll">
        <table class="data-table" id="mhc-table">
          ${thead}
          ${tbody}
        </table>
      </div>`;

    // ── Filter logic ────────────────────────────────────────────────────────
    let activeYear  = 'all';
    let activeMonth = 'all';

    function applyFilter() {
      const dataRows = container.querySelectorAll('#mhc-table tbody tr:not(.row--total)');
      let visBegin = -1, visEnd = -1, visAdded = 0, visDep = 0, firstSet = false;

      for (const tr of dataRows) {
        const matchY = activeYear  === 'all' || tr.dataset.year  === activeYear;
        const matchM = activeMonth === 'all' || tr.dataset.month === activeMonth;
        const visible = matchY && matchM;
        tr.style.display = visible ? '' : 'none';

        if (visible) {
          const b = parseInt(tr.dataset.begin);
          const e = parseInt(tr.dataset.end);
          if (!firstSet && b !== -1) { visBegin = b; firstSet = true; }
          if (e !== -1) visEnd = e;
          visAdded += parseInt(tr.dataset.added);
          visDep   += parseInt(tr.dataset.departures);
        }
      }

      // Update summary row
      document.getElementById('tot-begin').textContent = visBegin !== -1 ? visBegin.toLocaleString() : '—';
      document.getElementById('tot-added').textContent = `+${visAdded.toLocaleString()}`;
      document.getElementById('tot-dep').textContent   = visDep.toLocaleString();
      document.getElementById('tot-end').textContent   = visEnd  !== -1 ? visEnd.toLocaleString()  : '—';
      const totRate = (visBegin > 0)
        ? `${((visDep / visBegin) * 100).toFixed(2)}%` : '—';
      document.getElementById('tot-rate').textContent  = totRate;
    }

    function bindPills(containerId, attr) {
      container.querySelector(`#${containerId}`).addEventListener('click', (e) => {
        const pill = e.target.closest('[data-' + attr + ']');
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
    applyFilter(); // initialise summary row
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
