/**
 * app.js — entry point and orchestrator.
 * Wires all DOM events and coordinates Parser → Analytics → Charts → Exporter.
 */
(function () {

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    records:         null,
    analyticsResult: null,
    headcount:       null,
    fileName:        '',
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  let $uploadSection, $dashboardSection;
  let $dropZone, $fileInput, $btnBrowse;
  let $btnExportExcel, $btnExportPDF, $btnReset;
  let $btnApplyHeadcount, $inputHeadcount;
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
    $btnApplyHeadcount = document.getElementById('btn-apply-headcount');
    $inputHeadcount   = document.getElementById('input-headcount');
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
    $btnApplyHeadcount.addEventListener('click', handleHeadcountApply);
    $inputHeadcount.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleHeadcountApply();
    });

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

      state.analyticsResult          = Analytics.compute(records, state.headcount);
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

  function handleHeadcountApply() {
    const raw = parseInt($inputHeadcount.value, 10);
    if (isNaN(raw) || raw <= 0) {
      showToast('Please enter a valid headcount greater than 0.', 'error');
      return;
    }
    state.headcount = raw;

    state.analyticsResult = Analytics.compute(state.records, state.headcount);
    state.analyticsResult._records = state.records;

    Charts.render(state.analyticsResult);
    updateStatCards(state.analyticsResult);

    showToast(`Attrition rate updated using headcount of ${raw.toLocaleString()}.`, 'success');
  }

  function handleReset() {
    Charts.destroy();

    state.records         = null;
    state.analyticsResult = null;
    state.headcount       = null;
    state.fileName        = '';

    $dashboardSection.classList.add('hidden');
    $uploadSection.classList.remove('hidden');

    $btnExportExcel.disabled = true;
    $btnExportPDF.disabled   = true;

    $fileInput.value    = '';
    $inputHeadcount.value = '';
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

    if (result.avgAttritionRate.isRate) {
      animateValue($valAvgRate, `${result.avgAttritionRate.value}%`);
      $valAvgRateSub.textContent = 'of total headcount per year';
    } else {
      animateValue($valAvgRate, `${result.avgAttritionRate.value}`);
      $valAvgRateSub.textContent = 'avg exits per year';
    }

    renderMonthlyTable(result);
  }

  // ── Monthly Headcount Table ───────────────────────────────────────────────
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

    const hasHeadcount = rows.some(r => r.beginCount !== null);

    // Totals
    const totalAdded      = rows.reduce((s, r) => s + r.added,      0);
    const totalDepartures = rows.reduce((s, r) => s + r.departures, 0);

    let thead = `
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
      const begin  = row.beginCount  !== null ? row.beginCount.toLocaleString()  : '—';
      const end    = row.endCount    !== null ? row.endCount.toLocaleString()    : '—';
      const rate   = row.attritionRate !== null ? `${row.attritionRate}%`        : '—';
      const rateClass = row.attritionRate !== null
        ? (parseFloat(row.attritionRate) >= 5 ? 'cell--high' : 'cell--normal')
        : '';
      tbody += `
        <tr>
          <td class="cell--month">${row.label}</td>
          <td>${begin}</td>
          <td class="${row.added > 0 ? 'cell--added' : ''}">${row.added > 0 ? '+' : ''}${row.added.toLocaleString()}</td>
          <td class="${row.departures > 0 ? 'cell--departures' : ''}">${row.departures.toLocaleString()}</td>
          <td>${end}</td>
          <td class="${rateClass}">${rate}</td>
        </tr>`;
    }

    // Summary row
    const lastRow   = rows[rows.length - 1];
    const finalEnd  = lastRow.endCount  !== null ? lastRow.endCount.toLocaleString()  : '—';
    const firstBegin = rows[0].beginCount !== null ? rows[0].beginCount.toLocaleString() : '—';
    tbody += `
      <tr class="row--total">
        <td class="cell--month">Total / Final</td>
        <td>${firstBegin}</td>
        <td>+${totalAdded.toLocaleString()}</td>
        <td>${totalDepartures.toLocaleString()}</td>
        <td>${finalEnd}</td>
        <td>—</td>
      </tr>`;
    tbody += '</tbody>';

    container.innerHTML = `
      <div class="table-scroll">
        <table class="data-table">
          ${thead}
          ${tbody}
        </table>
      </div>
      ${!hasHeadcount ? `<p class="table-note">Enter a starting headcount above and click Apply to calculate Beginning/Ending counts and Attrition Rate.</p>` : ''}`;
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
