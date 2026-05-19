/**
 * Exporter — handles Excel and PDF export.
 * Exposed as window.Exporter for use in app.js.
 */
window.Exporter = (() => {

  const CANONICAL_REASONS = [
    'Resignation', 'Termination', 'Retirement', 'Redundancy', 'End of Contract', 'Other'
  ];

  // ── Excel Export ────────────────────────────────────────────────────────────

  function toExcel(records, result) {
    const wb = XLSX.utils.book_new();

    // ── Summary Sheet ──────────────────────────────────────────────────────
    const summaryData = [];

    summaryData.push(['ATTRITION REPORT SUMMARY']);
    summaryData.push([`Generated: ${new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}`]);
    summaryData.push([]);
    summaryData.push(['OVERVIEW']);
    summaryData.push(['Metric', 'Value']);
    summaryData.push(['Total Exits', result.totalExits]);
    summaryData.push([
      'Peak Month',
      `${result.peakMonth.label} — ${result.peakMonth.count} exits (${result.peakMonth.pct}%)`,
    ]);
    summaryData.push([
      'Avg Attrition Rate',
      result.avgAttritionRate.isRate
        ? `${result.avgAttritionRate.value}%`
        : `${result.avgAttritionRate.value} exits / year`,
    ]);
    summaryData.push([]);

    if (result.years.length > 0) {
      summaryData.push(['ATTRITION BY YEAR AND REASON']);

      const activeReasons = CANONICAL_REASONS.filter(r =>
        result.reasons.includes(r)
      );

      summaryData.push(['Year', ...activeReasons, 'Total']);

      for (const year of result.years) {
        const yearMap = result.byYearByReason.get(year);
        const row = [year];
        let total = 0;
        for (const reason of activeReasons) {
          const count = yearMap?.get(reason) || 0;
          row.push(count);
          total += count;
        }
        row.push(total);
        summaryData.push(row);
      }

      summaryData.push([]);
    }

    if (result.byYearMonth.length > 0) {
      summaryData.push(['MONTHLY ATTRITION']);
      summaryData.push(['Month', 'Exits']);
      for (const { label, count } of result.byYearMonth) {
        summaryData.push([label, count]);
      }
      summaryData.push([]);
    }

    summaryData.push(['REASON BREAKDOWN']);
    summaryData.push(['Reason', 'Count', 'Percentage']);
    for (const [reason, count] of result.byReason.entries()) {
      const pct = result.totalExits > 0
        ? ((count / result.totalExits) * 100).toFixed(1) + '%'
        : '0.0%';
      summaryData.push([reason, count, pct]);
    }

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // ── Raw Data Sheet ─────────────────────────────────────────────────────
    const rawData = records.map(r => ({
      Name:           r.name,
      Department:     r.department,
      'Date Hired':   r.dateHired ? r.dateHired.toISOString().split('T')[0] : '',
      'Exit Date':    r.exitDate  ? r.exitDate.toISOString().split('T')[0]  : '',
      Reason:         r.reason,
      Remarks:        r.remarks || '',
      Year:           r.year    || '',
      Month:          r.month   || '',
    }));

    const rawSheet = XLSX.utils.json_to_sheet(rawData, {
      header: ['Name', 'Department', 'Date Hired', 'Exit Date', 'Reason', 'Remarks', 'Year', 'Month'],
    });
    rawSheet['!cols'] = [
      { wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 28 }, { wch: 8 }, { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, rawSheet, 'Raw Data');

    XLSX.writeFile(wb, 'attrition-report.xlsx');
  }

  // ── PDF Export ──────────────────────────────────────────────────────────────

  function toPDF(result, chartImages, fileName) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW  = doc.internal.pageSize.getWidth();
    const pageH  = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentW = pageW - margin * 2;

    const PRIMARY   = [79, 110, 247];
    const NAVY      = [15, 22, 41];
    const MUTED     = [107, 114, 128];
    const BORDER    = [228, 232, 240];
    const BG        = [244, 246, 251];

    function addPageNumber(pageNum) {
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(
        `Page ${pageNum}`,
        pageW / 2,
        pageH - 8,
        { align: 'center' }
      );
    }

    function drawHeaderBar() {
      // Navy top bar
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 18, 'F');

      // Brand text
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('ATTRITION INSIGHTS REPORT', margin, 12);

      // Date
      const dateStr = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(168, 180, 204);
      doc.text(dateStr, pageW - margin, 12, { align: 'right' });
    }

    function drawStatBoxes(y) {
      const boxes = [
        {
          label: 'TOTAL EXITS',
          value: result.totalExits.toLocaleString(),
          color: PRIMARY,
        },
        {
          label: 'PEAK MONTH',
          value: result.peakMonth.label,
          sub:   `${result.peakMonth.count} exits · ${result.peakMonth.pct}%`,
          color: [247, 169, 79],
        },
        {
          label: 'AVG ATTRITION RATE',
          value: result.avgAttritionRate.isRate
            ? `${result.avgAttritionRate.value}%`
            : `${result.avgAttritionRate.value}/yr`,
          color: [162, 79, 247],
        },
      ];

      const boxW = (contentW - 10) / 3;
      const boxH = 26;

      boxes.forEach((box, i) => {
        const x = margin + i * (boxW + 5);

        // Card background
        doc.setFillColor(...BG);
        doc.roundedRect(x, y, boxW, boxH, 3, 3, 'F');

        // Left accent bar
        doc.setFillColor(...box.color);
        doc.rect(x, y, 3, boxH, 'F');

        // Label
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...MUTED);
        doc.text(box.label, x + 8, y + 8);

        // Value
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(box.value, x + 8, y + 19);

        // Sub text
        if (box.sub) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...MUTED);
          doc.text(box.sub, x + 8, y + 24.5);
        }
      });
    }

    function sectionTitle(text, y) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...NAVY);
      doc.text(text, margin, y);
      doc.setDrawColor(...BORDER);
      doc.line(margin, y + 2, pageW - margin, y + 2);
    }

    // ── Page 1 ─────────────────────────────────────────────────────────────
    drawHeaderBar();
    drawStatBoxes(23);

    const barY = 57;
    sectionTitle('ATTRITION BY YEAR', barY - 5);

    if (chartImages.bar) {
      doc.addImage(chartImages.bar, 'PNG', margin, barY, contentW, 88);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('No year data available.', margin, barY + 20);
    }

    addPageNumber(1);

    // ── Page 2 ─────────────────────────────────────────────────────────────
    doc.addPage();
    drawHeaderBar();

    const lineY = 25;
    sectionTitle('MONTHLY ATTRITION TREND', lineY - 4);

    if (chartImages.line) {
      doc.addImage(chartImages.line, 'PNG', margin, lineY, contentW * 0.62, 80);
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('No monthly data available.', margin, lineY + 20);
    }

    if (chartImages.doughnut) {
      sectionTitle('REASON BREAKDOWN', lineY - 4);
      doc.addImage(
        chartImages.doughnut, 'PNG',
        margin + contentW * 0.65,
        lineY,
        contentW * 0.35,
        80
      );
    }

    // Summary table on page 2
    const tableY = lineY + 85;
    sectionTitle('YEARLY SUMMARY TABLE', tableY - 4);

    if (result.years.length > 0) {
      const activeReasons = ['Resignation','Termination','Retirement','Redundancy','End of Contract','Other']
        .filter(r => result.reasons.includes(r));

      const head = [['Year', ...activeReasons, 'Total']];
      const body = result.years.map(year => {
        const yearMap = result.byYearByReason.get(year);
        const row     = [String(year)];
        let total     = 0;
        for (const r of activeReasons) {
          const c = yearMap?.get(r) || 0;
          row.push(String(c));
          total += c;
        }
        row.push(String(total));
        return row;
      });

      doc.autoTable({
        startY:     tableY,
        head,
        body,
        margin:     { left: margin, right: margin },
        styles:     { fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: BG },
        columnStyles: { 0: { fontStyle: 'bold' } },
      });
    }

    addPageNumber(2);

    // ── Page 3 — Raw Data ──────────────────────────────────────────────────
    doc.addPage();
    drawHeaderBar();

    sectionTitle('EMPLOYEE EXIT RECORDS', 23);

    const rawBody = result._records
      ? result._records.map(r => [
          r.name,
          r.department,
          r.dateHired ? r.dateHired.toISOString().split('T')[0] : '—',
          r.exitDate  ? r.exitDate.toISOString().split('T')[0]  : '—',
          r.reason,
          r.remarks || '—',
          r.year  || '—',
          r.month || '—',
        ])
      : [];

    if (rawBody.length > 0) {
      doc.autoTable({
        startY: 27,
        head:   [['Name', 'Department', 'Date Hired', 'Exit Date', 'Reason', 'Remarks', 'Year', 'Month']],
        body:   rawBody,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: PRIMARY, textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: BG },
        didDrawPage(data) {
          drawHeaderBar();
          const pageNum = doc.internal.getNumberOfPages();
          addPageNumber(pageNum);
        },
      });
    } else {
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text('Raw records not available in this export.', margin, 35);
    }

    addPageNumber(doc.internal.getNumberOfPages());

    doc.save(fileName || 'attrition-report.pdf');
  }

  return { toExcel, toPDF };

})();
