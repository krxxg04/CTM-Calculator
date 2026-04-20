# Osito Calculator (CTM-Calculator)

Complete statistical calculator with a custom frontend UI and full descriptive + position measures.

This workspace contains a Next.js app in the subfolder:

- ctm-calculator

## Overview

Osito Calculator lets you paste a numeric dataset and compute:

1. Descriptive statistics (mean, median, mode, variance, etc.)
2. Position measures (quartiles, deciles, and custom percentiles)
3. Exportable results in Excel format (.xlsx)

The UI includes:

1. Large input area for pasted values
2. Calculate button (explicit calculation trigger)
3. Example loader and clear actions
4. Decile selector and custom percentile input
5. Results grid and deciles summary

## Features

### 1. Input parsing

Accepted separators:

- Comma: 10, 12, 15
- New line
- Tab
- Semicolon
- Spaces

Decimal rule:

- Dot only for decimals (example: 12.5)

Invalid tokens are ignored and shown in the UI.

### 2. Descriptive statistics

The calculator computes:

1. Mean
2. Standard Error
3. Median
4. Mode
5. Sample Standard Deviation
6. Sample Variance
7. Kurtosis (excess, bias-corrected sample estimate)
8. Skewness (Fisher-Pearson sample skewness)
9. Range
10. Minimum
11. Maximum
12. Sum
13. Count

### 3. Position measures

The calculator also computes:

1. Quartiles: Q1 (P25), Q2 (P50), Q3 (P75)
2. Deciles D1 to D9 (summary block)
3. Selected decile via selector (D1-D9)
4. Custom percentile P1-P99 via numeric input

Important equivalences:

- Median = Q2 = D5 = P50

### 4. Excel export

Export button creates an .xlsx file with:

1. Result sheet (descriptive stats + quartiles + deciles + selected percentile)
2. Raw data sheet (index + numeric value)
3. Ignored tokens sheet (if invalid values exist)

### 5. Local persistence

The app stores these values in localStorage:

1. Input dataset
2. Selected decile
3. Percentile input

So the state is restored after refresh.

## Formula notes

### Standard Error

SE = s / sqrt(n)

Where:

- s = sample standard deviation
- n = sample size

### Sample variance and standard deviation

s^2 = sum((xi - xbar)^2) / (n - 1)

s = sqrt(s^2)

### Skewness (Fisher-Pearson sample skewness)

G1 = [n / ((n - 1)(n - 2))] * sum(((xi - xbar) / s)^3)

### Kurtosis (excess, sample corrected)

G2 = [n(n + 1) / ((n - 1)(n - 2)(n - 3))] * sum(((xi - xbar) / s)^4)
	- [3(n - 1)^2 / ((n - 2)(n - 3))]

### Percentiles, quartiles, and deciles

Percentiles are computed using linear interpolation on sorted data:

1. rank = (p / 100) * (n - 1)
2. interpolate between floor(rank) and ceil(rank)

Quartiles and deciles are derived from this percentile function:

- Q1 = P25, Q2 = P50, Q3 = P75
- Dk = P(k * 10)

## Run locally

From the workspace root:

```bash
cd ctm-calculator
npm install
npm run dev
```

Then open:

- http://localhost:3000

## Build and quality checks

```bash
cd ctm-calculator
npm run lint
npm run build
npm run start
```

## Stack

1. Next.js 16
2. React 19
3. TypeScript
4. XLSX (SheetJS) for Excel export
5. CSS modules for UI styling

## Project notes

- Main page logic and UI: ctm-calculator/app/page.tsx
- Main page styles: ctm-calculator/app/page.module.css
- App metadata and icons: ctm-calculator/app/layout.tsx
