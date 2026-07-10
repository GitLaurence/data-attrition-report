# Data Attrition Report

A client-side web application that reads employee data from an Excel file, generates graphical attrition reports, and exports results to Excel or PDF — no backend or server required.

---

## Features

- Upload an Excel file (`.xlsx` / `.xls`) directly in the browser via drag-and-drop or file picker
- Automatically detect and parse flexible column names — no reformatting required
- Display interactive charts and summary statistics:
  - Total attrition per year, stacked by exit reason
  - Monthly attrition trend
  - Reason breakdown (doughnut chart)
  - Attrition by department (ranked horizontal bar chart)
- **Monthly Headcount Analysis** — redesigned card-based view for HR managers:
  - At-a-glance period KPI bar (Period Start, Total Hired, Total Exits, Period End, Avg Attrition Rate)
  - Per-month cards showing end-of-month headcount, net change direction (▲/▼), hired vs. departed breakdown, and colour-coded attrition rate badge
  - Headcount trend sparkline in the Period Summary card
  - Year and month filter pills to narrow the view
- Stat card tooltips explaining each metric (hover the ⓘ icon)
- Export the full report to Excel (Summary + Raw Data sheets, including monthly headcount analysis)
- Export the full report to a multi-page PDF with embedded charts

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

## Excel Input Format

Your file must have a **header row as the first row**. Column names are matched case-insensitively.

### Accepted Column Names

| Field | Accepted column headers | Required |
|---|---|---|
| Employee Name | `Last Name` + `First Name` + `Middle Name` — or — `Name`, `Employee Name`, `Full Name` | Yes |
| Department | `Department`, `Dept`, `Division`, `Team` | Yes |
| Exit Date | `Date of Last Day`, `Exit Date`, `Termination Date`, `Separation Date`, `Last Day`, `Turned Over Date` | Yes (leave blank for active employees) |
| Reason | `Last Update`, `Reason`, `Exit Reason`, `Separation Reason`, `Type`, `Reason for Leaving` | Yes (leave blank for active employees) |
| Date Hired | `Date Hired`, `Date of Hire`, `Hire Date` | Required for Monthly Headcount Analysis |
| Remarks | `Remarks`, `Notes`, `Comment` | No |

Any other columns in the file are ignored.

### Including Active Employees

To unlock the full **Monthly Headcount Analysis** (Beginning Count, Ending Count, Attrition Rate), your file should include **all employees** — both current and departed — each with a `Date Hired` value:

- **Departed employees** — fill in `Date Hired`, `Exit Date`, and `Reason`
- **Active employees** — fill in `Date Hired` only; leave `Exit Date` and `Reason` blank

If the file contains only departed employees, the Beginning/Ending Count and Attrition Rate columns will show `—`.

### Accepted Reason Values

The `Reason` (or `Last Update`) column is normalized automatically. Accepted values and their aliases:

| Category | Accepted values |
|---|---|
| **Resignation** | `Resignation`, `Resigned`, `Resign`, `Voluntary`, `Voluntary Resignation`, or any value starting with `Resign` |
| **Termination** | `Termination`, `Terminated`, `Involuntary`, `Dismissed`, `Fired`, `AWOL`, `Absent Without Leave` |
| **Retirement** | `Retirement`, `Retired`, or any value starting with `Retir` |
| **Redundancy** | `Redundancy`, `Redundant`, `Laid Off`, `Layoff`, `Retrenchment` |
| **End of Contract** | `End of Contract`, `EOC`, `Contract Ended`, `Contract Expired`, `Fixed Term`, `End of Employment` |
| **Other** | Anything not matched above |

### Sample Data (split-name format, all employees)

```
Last Name  | First Name | Middle Name | Department  | Date Hired | Date of Last Day | Last Update  | Remarks
-----------|------------|-------------|-------------|------------|------------------|--------------|---------------------------
dela Cruz  | Juan       | Santos      | Engineering | 2020-05-01 | 2024-01-10       | RESIGN       |
Santos     | Maria      | Lopez       | HR          | 2019-03-15 | 2024-01-22       | TERMINATION  |
Reyes      | Pedro      | Garcia      | Finance     | 2021-07-20 | 2024-03-05       | RESIGN       |
Lim        | Ana        | Cruz        | IT          | 2018-01-10 | 2024-05-18       | RETIREMENT   |
Mendoza    | Carlo      | Bautista    | Operations  | 2022-02-28 | 2023-11-30       | AWOL         | No show since Nov 15
Garcia     | Rosa       | Reyes       | Engineering | 2021-09-01 |                  |              |
Bautista   | Jose       | Santos      | IT          | 2023-03-15 |                  |              |
```
*(Last two rows are active employees — no Exit Date or Reason)*

### Sample Data (single-name format)

```
Name             | Department  | Date of Last Day | Last Update
-----------------|-------------|------------------|------------
Juan dela Cruz   | Engineering | 2024-01-10       | Resignation
Maria Santos     | HR          | 2024-01-22       | Termination
Pedro Reyes      | Finance     | 2024-03-05       | Resignation
```

---

## Project Structure

```
data-attrition-report/
├── index.html              # Main application page
├── generate-sample.html    # Utility to generate a sample Excel file
├── css/
│   └── style.css           # Application styles
├── js/
│   ├── app.js              # Entry point — wires up UI events and state
│   ├── parser.js           # Excel parsing, column detection, normalization
│   ├── analytics.js        # Attrition calculations and aggregations
│   ├── charts.js           # Chart.js chart rendering
│   └── exporter.js         # Excel and PDF export logic
└── README.md
```

---

## Stat Cards

| Metric | Description |
|---|---|
| **Total Exits** | Count of all employee separation records found in the uploaded file. |
| **Peak Month** | The calendar month with the highest number of exits, with its count and share of all exits. |
| **Avg Attrition Rate** | Average exits per year across all years in the data. |

Hover the **ⓘ** icon on any card to see a tooltip explanation directly in the app.

---

## Monthly Headcount Analysis

The section beneath the charts displays a card-based view designed for HR managers, with all values derived directly from the uploaded file.

### Period KPI Bar

A summary row at the top of the section shows totals for the currently filtered period:

| KPI | Description |
|---|---|
| **Period Start** | Headcount at the beginning of the first visible month |
| **Total Hired** | Sum of all new hires across visible months |
| **Total Exits** | Sum of all departures across visible months |
| **Period End** | Headcount at the end of the last visible month |
| **Avg Attrition** | `Total Exits ÷ Period Start × 100`, colour-coded green / yellow / red |

### Month Cards

Each card shows:

| Element | How it is calculated |
|---|---|
| **Attrition rate badge** | `Departures ÷ Beginning Count × 100` — green < 2%, yellow 2–5%, red ≥ 5% |
| **End of Month** | Employees hired on or before the last day with no exit date, or exit date after month end |
| **Net change** (▲ / ▼) | `Hired − Departed` for that month |
| **Hired** | Employees whose `Date Hired` falls within the month |
| **Departed** | Employees whose `Exit Date` falls within the month |

### Period Summary Card

A full-width card at the bottom aggregates the visible months and includes a **headcount trend sparkline** showing whether the workforce grew or shrank over the selected period.

### Filters

Use the **Year** and **Month** filter pills to narrow the view. The period KPI bar and summary card update automatically.

---

## How to Run

1. Clone or download this repository
2. Open `index.html` in any modern browser (Chrome, Firefox, Edge)
3. Drag and drop your `.xlsx` file onto the upload zone, or click **Browse File**
4. The report generates automatically — charts, stat cards, and the monthly headcount table all populate from the file
5. Click **Export Excel** or **Export PDF** to download the report

> No installation, no server, no build step required.

---

## Export Output

### Excel (`attrition-report.xlsx`)

| Sheet | Contents |
|---|---|
| Summary | Overview metrics, attrition by year & reason, monthly headcount analysis (Beginning Count, Employees Added, Departures, Ending Count, Attrition Rate), reason breakdown, attrition by department |
| Raw Data | One row per employee: Name, Department, Date Hired, Exit Date, Reason, Remarks, Year, Month |

### PDF (landscape A4)

| Page | Contents |
|---|---|
| 1 | Header, stat cards (Total Exits, Peak Month, Avg Rate), Attrition by Year bar chart |
| 2 | Monthly trend line chart, Reason breakdown doughnut, Yearly summary table |
| 3 | Monthly Headcount Analysis table (Beginning Count, Employees Added, Departures, Ending Count, Attrition Rate) |
| 4 | Attrition by department chart and table (Department, Count, Percentage) |
| 5+ | Employee exit records table (auto-paginated) |

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

## CDN Libraries

```html
<script src="https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```
