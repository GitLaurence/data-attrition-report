# Data Attrition Report

A client-side web application that reads employee exit data from an Excel file, generates graphical attrition reports, and exports results to Excel or PDF — no backend or server required.

---

## Features

- Upload an Excel file (`.xlsx` / `.xls`) directly in the browser
- Automatically parse and analyze employee exit records
- Display interactive charts and summary statistics:
  - Total attrition per year (grouped by exit reason)
  - Highest month of attrition
  - Average attrition rate
- Export the full report to a new Excel file
- Export the full report to a PDF

---

## Tech Stack

| Purpose | Library |
|---|---|
| Excel parsing & export | [SheetJS (xlsx)](https://sheetjs.com/) |
| Charts & graphs | [Chart.js](https://www.chartjs.org/) |
| PDF export | [jsPDF](https://github.com/parallax/jsPDF) + [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) |
| Styling | Plain CSS (no framework) |

All libraries are loaded via CDN — no build tools or npm required.

---

## Expected Excel Input Format

Your Excel file must have a **header row** as the first row. The following columns are required (column names are case-insensitive):

| Column Name | Type | Example |
|---|---|---|
| `Name` | Text | Juan dela Cruz |
| `Department` | Text | Engineering |
| `Exit Date` | Date | 2024-03-15 |
| `Reason` | Text | Resignation |

**Accepted values for `Reason`:** `Resignation`, `Termination`, `Retirement`, `Redundancy`, `End of Contract`

Any additional columns in the file are ignored.

### Sample Data

```
Name             | Department   | Exit Date  | Reason
----------------|--------------|------------|------------
Juan dela Cruz   | Engineering  | 2024-01-10 | Resignation
Maria Santos     | HR           | 2024-01-22 | Termination
Pedro Reyes      | Finance      | 2024-03-05 | Resignation
Ana Lim          | IT           | 2024-05-18 | Retirement
Carlo Mendoza    | Operations   | 2023-11-30 | Resignation
```

---

## Project Structure

```
data-attrition-report/
├── index.html          # Main application page
├── css/
│   └── style.css       # Application styles
├── js/
│   ├── app.js          # Entry point — wires up UI events
│   ├── parser.js       # Excel parsing and data normalization
│   ├── analytics.js    # Attrition calculations and aggregations
│   ├── charts.js       # Chart.js chart rendering
│   └── exporter.js     # Excel and PDF export logic
├── assets/
│   └── sample-data.xlsx  # Sample input file for testing
└── README.md
```

---

## Implementation Plan

### Phase 1 — File Upload & Parsing (`parser.js`)
- Render a drag-and-drop / click-to-upload zone in `index.html`
- Use the `FileReader` API to read the uploaded file as an `ArrayBuffer`
- Pass the buffer to SheetJS (`XLSX.read`) to parse the workbook
- Extract the first sheet and convert it to a JSON array of row objects
- Normalize column names (trim whitespace, lowercase comparison)
- Parse `Exit Date` values into JavaScript `Date` objects
- Validate required columns; show user-friendly errors if missing

### Phase 2 — Analytics (`analytics.js`)
Compute the following from the parsed row array:

1. **Total attrition per year**
   - Group rows by `year` extracted from `Exit Date`
   - Sub-group by `Reason` within each year
   - Output: `{ year, total, byReason: { Resignation: N, Termination: N, ... } }`

2. **Highest month of attrition**
   - Group rows by `YYYY-MM`
   - Find the month with the highest row count
   - Output: month label, count, and percentage of all exits

3. **Average attrition rate**
   - Requires knowing total headcount per year (either read from a second sheet named `Headcount` or entered manually via a UI input)
   - Formula: `(Total Exits in Year / Average Headcount) × 100`
   - If no headcount data is provided, display raw exit counts instead

### Phase 3 — Charts (`charts.js`)
Render three Chart.js charts inside `<canvas>` elements:

| Chart | Type | Data Source |
|---|---|---|
| Attrition by Year | Grouped Bar (stacked by Reason) | Phase 2 → total per year |
| Monthly Attrition Trend | Line chart | Row count grouped by month |
| Reason Breakdown | Doughnut chart | All rows grouped by Reason |

Each chart includes a legend, tooltips, and responsive sizing.

### Phase 4 — Summary Cards
Display three stat cards above the charts:

- **Total Exits** — sum of all rows
- **Peak Month** — month label + count
- **Avg Attrition Rate** — percentage (or "—" if no headcount provided)

### Phase 5 — Export (`exporter.js`)

**Export to Excel:**
- Build a new SheetJS workbook with two sheets:
  - `Summary` — yearly totals table + peak month + avg rate
  - `Raw Data` — the original parsed rows, cleaned and normalized
- Trigger a browser download using `XLSX.writeFile`

**Export to PDF:**
- Use `jsPDF` to create an A4 document
- Render the summary stats as text blocks
- Use `jsPDF-AutoTable` to render the yearly totals table
- Use `chart.toBase64Image()` to embed each Chart.js chart as an image
- Trigger download via `doc.save()`

---

## How to Run

1. Clone or download this repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge)
3. Click **Upload Excel File** and select your `.xlsx` file
4. The report generates automatically
5. Use **Export to Excel** or **Export to PDF** buttons to download

> No installation, no server, no build step required.

---

## Browser Compatibility

| Browser | Supported |
|---|---|
| Chrome 90+ | Yes |
| Firefox 88+ | Yes |
| Edge 90+ | Yes |
| Safari 14+ | Yes |
| Internet Explorer | No |

---

## Libraries & CDN Links

```html
<!-- SheetJS -->
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<!-- jsPDF -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>

<!-- jsPDF-AutoTable -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```

---

## Roadmap / Optional Enhancements

- [ ] Filter report by department or date range
- [ ] Support for multiple sheets / multi-company files
- [ ] Manual headcount input per year for accurate attrition rate
- [ ] Dark mode toggle
- [ ] Save last uploaded file in `localStorage` for quick reload
