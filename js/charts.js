/**
 * Charts — owns all Chart.js instances.
 * Exposed as window.Charts for use in app.js.
 */
window.Charts = (() => {

  // Mirrors CSS custom properties
  const REASON_COLORS = {
    'Resignation':      '#4F6EF7',
    'Termination':      '#F75F4F',
    'Retirement':       '#F7A94F',
    'Redundancy':       '#A24FF7',
    'End of Contract':  '#4FC7F7',
    'Other':            '#9CA3AF',
  };

  let barChart      = null;
  let lineChart     = null;
  let doughnutChart = null;

  // Chart.js is loaded from a CDN — if the request was blocked (offline, ad-blocker,
  // restrictive network), skip global config instead of crashing this whole module.
  const chartLibAvailable = typeof Chart !== 'undefined';

  if (chartLibAvailable) {
    // Set global Chart.js defaults once
    Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
    Chart.defaults.font.size   = 12;
    Chart.defaults.color       = '#6B7280';
    Chart.defaults.plugins.legend.labels.boxWidth  = 12;
    Chart.defaults.plugins.legend.labels.boxHeight = 12;
    Chart.defaults.plugins.legend.labels.padding   = 16;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0F1629';
    Chart.defaults.plugins.tooltip.titleColor      = '#FFFFFF';
    Chart.defaults.plugins.tooltip.bodyColor       = '#A8B4CC';
    Chart.defaults.plugins.tooltip.padding         = 12;
    Chart.defaults.plugins.tooltip.cornerRadius    = 8;
    Chart.defaults.plugins.tooltip.displayColors   = true;
    Chart.defaults.plugins.tooltip.boxPadding      = 4;
  }

  function destroy() {
    if (barChart)      { barChart.destroy();      barChart      = null; }
    if (lineChart)     { lineChart.destroy();     lineChart     = null; }
    if (doughnutChart) { doughnutChart.destroy(); doughnutChart = null; }
  }

  function showEmpty(canvasId, emptyId, isEmpty) {
    const canvas = document.getElementById(canvasId);
    const empty  = document.getElementById(emptyId);
    if (!canvas || !empty) return;
    if (isEmpty) {
      canvas.style.display = 'none';
      empty.classList.remove('hidden');
    } else {
      canvas.style.display = 'block';
      empty.classList.add('hidden');
    }
  }

  function renderBar(result) {
    const canvas = document.getElementById('chart-bar');
    if (!canvas) return;

    const hasData = chartLibAvailable && result.years.length > 0;
    showEmpty('chart-bar', 'chart-bar-empty', !hasData);
    if (!hasData) return;

    const CANONICAL_REASONS = [
      'Resignation', 'Termination', 'Retirement', 'Redundancy', 'End of Contract', 'Other'
    ];

    // Only include reasons that appear in the data
    const activeReasons = CANONICAL_REASONS.filter(r => {
      for (const yearMap of result.byYearByReason.values()) {
        if ((yearMap.get(r) || 0) > 0) return true;
      }
      return false;
    });

    const datasets = activeReasons.map(reason => ({
      label:           reason,
      data:            result.years.map(y => result.byYearByReason.get(y)?.get(reason) || 0),
      backgroundColor: REASON_COLORS[reason] || '#9CA3AF',
      borderRadius:    4,
      borderSkipped:   'bottom',
    }));

    barChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels:   result.years.map(String),
        datasets,
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              footer(items) {
                const total = items.reduce((s, i) => s + i.parsed.y, 0);
                return `Total: ${total}`;
              },
            },
          },
        },
        scales: {
          x: {
            stacked: true,
            grid:    { display: false },
            ticks:   { font: { weight: '500' } },
          },
          y: {
            stacked:      true,
            beginAtZero:  true,
            grid:         { color: '#E4E8F0' },
            border:       { dash: [4, 4] },
            ticks:        { precision: 0 },
          },
        },
      },
    });
  }

  function renderLine(result) {
    const canvas = document.getElementById('chart-line');
    if (!canvas) return;

    const hasData = chartLibAvailable && result.byYearMonth.length > 0;
    showEmpty('chart-line', 'chart-line-empty', !hasData);
    if (!hasData) return;

    const labels = result.byYearMonth.map(m => m.label);
    const data   = result.byYearMonth.map(m => m.count);

    const maxTicks = labels.length > 24 ? 12 : undefined;

    lineChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label:                'Exits',
          data,
          tension:              0.4,
          fill:                 true,
          backgroundColor:      'rgba(79,110,247,.08)',
          borderColor:          '#4F6EF7',
          borderWidth:          2,
          pointBackgroundColor: '#4F6EF7',
          pointBorderColor:     '#fff',
          pointBorderWidth:     2,
          pointRadius:          3,
          pointHoverRadius:     6,
          pointHoverBorderWidth:2,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => ` ${item.parsed.y} exit${item.parsed.y !== 1 ? 's' : ''}`,
            },
          },
        },
        scales: {
          x: {
            grid:  { display: false },
            ticks: {
              maxTicksLimit: maxTicks,
              maxRotation:   45,
            },
          },
          y: {
            beginAtZero: true,
            grid:        { color: '#E4E8F0' },
            border:      { dash: [4, 4] },
            ticks:       { precision: 0 },
          },
        },
      },
    });
  }

  function renderDoughnut(result) {
    const canvas = document.getElementById('chart-doughnut');
    if (!canvas) return;

    const hasData = chartLibAvailable && result.byReason.size > 0;
    showEmpty('chart-doughnut', 'chart-doughnut-empty', !hasData);
    if (!hasData) return;

    const labels = [...result.byReason.keys()];
    const data   = [...result.byReason.values()];
    const colors = labels.map(l => REASON_COLORS[l] || '#9CA3AF');
    const total  = result.totalExits;

    const centerTextPlugin = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea: { top, bottom, left, right } } = chart;
        const cx = (left + right) / 2;
        const cy = (top  + bottom) / 2;
        ctx.save();
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.font         = "700 1.75rem 'Inter', sans-serif";
        ctx.fillStyle    = '#111827';
        ctx.fillText(total.toLocaleString(), cx, cy - 10);
        ctx.font         = "400 0.7rem 'Inter', sans-serif";
        ctx.fillStyle    = '#9CA3AF';
        ctx.fillText('Total Exits', cx, cy + 12);
        ctx.restore();
      },
    };

    doughnutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor:      colors,
          borderColor:          '#fff',
          borderWidth:          3,
          hoverBorderWidth:     3,
          hoverOffset:          6,
        }],
      },
      plugins: [centerTextPlugin],
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        cutout:              '65%',
        plugins: {
          legend: {
            position:  'bottom',
            labels: {
              generateLabels(chart) {
                const ds   = chart.data.datasets[0];
                const sum  = ds.data.reduce((a, b) => a + b, 0);
                return chart.data.labels.map((label, i) => ({
                  text:        `${label} (${sum > 0 ? ((ds.data[i]/sum)*100).toFixed(1) : 0}%)`,
                  fillStyle:   ds.backgroundColor[i],
                  strokeStyle: ds.backgroundColor[i],
                  lineWidth:   0,
                  hidden:      false,
                  index:       i,
                }));
              },
            },
          },
          tooltip: {
            callbacks: {
              label(item) {
                const val = item.parsed;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${val} exits (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }

  function render(result) {
    destroy();
    renderBar(result);
    renderLine(result);
    renderDoughnut(result);
  }

  function getImages() {
    return {
      bar:      barChart      ? barChart.toBase64Image('image/png', 1)      : null,
      line:     lineChart     ? lineChart.toBase64Image('image/png', 1)     : null,
      doughnut: doughnutChart ? doughnutChart.toBase64Image('image/png', 1) : null,
    };
  }

  return { render, destroy, getImages, isAvailable: () => chartLibAvailable };

})();
