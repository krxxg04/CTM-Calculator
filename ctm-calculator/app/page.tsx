"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type ParseResult = {
  values: number[];
  invalidTokens: string[];
};

type StatisticsResult = {
  mean: number;
  standardError: number | null;
  median: number;
  mode: number[];
  sampleStdDev: number | null;
  sampleVariance: number | null;
  kurtosis: number | null;
  skewness: number | null;
  range: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  q1: number;
  q2: number;
  q3: number;
  deciles: number[];
  sortedValues: number[];
};

const SAMPLE_DATA = `12, 18, 21, 21, 25
30
32
35
35
40`;

const STORAGE_INPUT_KEY = "ctm-calculator.input";
const STORAGE_DECILE_KEY = "ctm-calculator.decile";
const STORAGE_PERCENTILE_KEY = "ctm-calculator.percentile";

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});

function tokenizeInput(input: string): string[] {
  const normalizedInput = input.replaceAll("\r", "");
  return normalizedInput
    .split(/[,\n;\t\s]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function parseValues(input: string): ParseResult {
  const numericPattern = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i;
  const values: number[] = [];
  const invalidTokens: string[] = [];

  for (const token of tokenizeInput(input)) {
    if (!numericPattern.test(token)) {
      invalidTokens.push(token);
      continue;
    }

    const value = Number(token);
    if (Number.isFinite(value)) {
      values.push(value);
    } else {
      invalidTokens.push(token);
    }
  }

  return { values, invalidTokens };
}

function percentileFromSorted(sortedValues: number[], percentile: number): number | null {
  if (sortedValues.length === 0) {
    return null;
  }

  if (percentile <= 0) {
    return sortedValues[0];
  }

  if (percentile >= 100) {
    return sortedValues[sortedValues.length - 1];
  }

  const rank = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  const weight = rank - lower;

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight;
}

function parsePercentileInput(value: string): number | null {
  if (!value.trim()) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 99) {
    return null;
  }

  return numeric;
}

function calculateStatistics(values: number[]): StatisticsResult {
  const count = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((accumulator, current) => accumulator + current, 0);
  const mean = sum / count;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  const middle = Math.floor(count / 2);
  const median =
    count % 2 === 0
      ? (sorted[middle - 1] + sorted[middle]) / 2
      : sorted[middle];

  const frequencies = new Map<number, number>();
  for (const value of values) {
    frequencies.set(value, (frequencies.get(value) ?? 0) + 1);
  }

  const highestFrequency = Math.max(...frequencies.values());
  const mode =
    highestFrequency > 1
      ? [...frequencies.entries()]
          .filter(([, frequency]) => frequency === highestFrequency)
          .map(([value]) => value)
          .sort((a, b) => a - b)
      : [];

  let squaredDiffSum = 0;
  let cubedDiffSum = 0;
  let fourthDiffSum = 0;

  for (const value of values) {
    const diff = value - mean;
    const squaredDiff = diff * diff;
    squaredDiffSum += squaredDiff;
    cubedDiffSum += squaredDiff * diff;
    fourthDiffSum += squaredDiff * squaredDiff;
  }

  const sampleVariance = count > 1 ? squaredDiffSum / (count - 1) : null;
  const sampleStdDev = sampleVariance !== null ? Math.sqrt(sampleVariance) : null;
  const standardError =
    sampleStdDev !== null ? sampleStdDev / Math.sqrt(count) : null;

  const skewness =
    sampleStdDev !== null && sampleStdDev > 0 && count > 2
      ? (count / ((count - 1) * (count - 2))) *
        (cubedDiffSum / Math.pow(sampleStdDev, 3))
      : null;

  const kurtosis =
    sampleStdDev !== null && sampleStdDev > 0 && count > 3
      ? (count * (count + 1)) / ((count - 1) * (count - 2) * (count - 3)) *
          (fourthDiffSum / Math.pow(sampleStdDev, 4)) -
        (3 * Math.pow(count - 1, 2)) / ((count - 2) * (count - 3))
      : null;

  const q1 = percentileFromSorted(sorted, 25) ?? sorted[0];
  const q2 = percentileFromSorted(sorted, 50) ?? sorted[0];
  const q3 = percentileFromSorted(sorted, 75) ?? sorted[sorted.length - 1];

  const deciles = Array.from({ length: 9 }, (_, index) => {
    const value = percentileFromSorted(sorted, (index + 1) * 10);
    return value ?? sorted[0];
  });

  return {
    mean,
    standardError,
    median,
    mode,
    sampleStdDev,
    sampleVariance,
    kurtosis,
    skewness,
    range,
    min,
    max,
    sum,
    count,
    q1,
    q2,
    q3,
    deciles,
    sortedValues: sorted,
  };
}

function formatNumber(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "N/A";
  }

  const absolute = Math.abs(value);
  if (absolute > 0 && (absolute >= 1_000_000_000 || absolute < 0.000001)) {
    return value.toExponential(6);
  }

  return numberFormatter.format(value);
}

export default function Home() {
  const [input, setInput] = useState<string>("");
  const [submittedInput, setSubmittedInput] = useState<string>("");
  const [selectedDecile, setSelectedDecile] = useState<number>(5);
  const [percentileInput, setPercentileInput] = useState<string>("90");
  const [actionMessage, setActionMessage] = useState<string>("");
  const [isStateRestored, setIsStateRestored] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(() => parseValues(submittedInput), [submittedInput]);

  const stats = useMemo(
    () => (parsed.values.length > 0 ? calculateStatistics(parsed.values) : null),
    [parsed.values],
  );

  const percentileNumber = useMemo(
    () => parsePercentileInput(percentileInput),
    [percentileInput],
  );

  const selectedDecileValue = useMemo(() => {
    if (!stats) {
      return null;
    }

    return stats.deciles[selectedDecile - 1] ?? null;
  }, [stats, selectedDecile]);

  const specificPercentileValue = useMemo(() => {
    if (!stats || percentileNumber === null) {
      return null;
    }

    return percentileFromSorted(stats.sortedValues, percentileNumber);
  }, [stats, percentileNumber]);

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionMessage("");
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [actionMessage]);

  useEffect(() => {
    try {
      const savedInput = window.localStorage.getItem(STORAGE_INPUT_KEY);
      const savedDecile = window.localStorage.getItem(STORAGE_DECILE_KEY);
      const savedPercentile = window.localStorage.getItem(STORAGE_PERCENTILE_KEY);

      if (savedInput !== null) {
        setInput(savedInput);
        setSubmittedInput(savedInput);
      }

      if (savedDecile !== null) {
        const decileValue = Number(savedDecile);
        if (Number.isInteger(decileValue) && decileValue >= 1 && decileValue <= 9) {
          setSelectedDecile(decileValue);
        }
      }

      if (savedPercentile !== null) {
        setPercentileInput(savedPercentile);
      }
    } finally {
      setIsStateRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!isStateRestored) {
      return;
    }

    window.localStorage.setItem(STORAGE_INPUT_KEY, input);
    window.localStorage.setItem(STORAGE_DECILE_KEY, String(selectedDecile));
    window.localStorage.setItem(STORAGE_PERCENTILE_KEY, percentileInput);
  }, [input, isStateRestored, selectedDecile, percentileInput]);

  function handleLoadExample(): void {
    setInput(SAMPLE_DATA);
    setSubmittedInput(SAMPLE_DATA);
    setActionMessage("Ejemplo cargado correctamente.");
    textareaRef.current?.focus();
  }

  function handleClear(): void {
    setInput("");
    setSubmittedInput("");
    setActionMessage("Datos limpiados.");
    textareaRef.current?.focus();
  }

  function handleCalculate(): void {
    setSubmittedInput(input);
    if (percentileNumber === null) {
      setActionMessage("Resultados actualizados. El percentil debe ser entero entre 1 y 99.");
      return;
    }

    setActionMessage("Resultados actualizados.");
  }

  async function handleExportExcel(): Promise<void> {
    if (!stats) {
      setActionMessage("No hay datos validos para exportar.");
      return;
    }

    try {
      const XLSX = await import("xlsx");

      const resultsSheetData: Array<[string, number | string]> = [
        ["Indicador", "Valor"],
        ["Media", stats.mean],
        ["Error tipico", stats.standardError ?? "N/A"],
        ["Mediana", stats.median],
        ["Moda", stats.mode.length > 0 ? stats.mode.join(", ") : "Sin moda"],
        ["Desviacion estandar (muestral)", stats.sampleStdDev ?? "N/A"],
        ["Varianza de la muestra", stats.sampleVariance ?? "N/A"],
        ["Curtosis (exceso)", stats.kurtosis ?? "N/A"],
        ["Coeficiente de asimetria", stats.skewness ?? "N/A"],
        ["Rango", stats.range],
        ["Minimo", stats.min],
        ["Maximo", stats.max],
        ["Suma", stats.sum],
        ["Cuenta", stats.count],
        ["Q1 (P25)", stats.q1],
        ["Q2 (P50)", stats.q2],
        ["Q3 (P75)", stats.q3],
      ];

      stats.deciles.forEach((value, index) => {
        resultsSheetData.push([`Decil D${index + 1}`, value]);
      });

      resultsSheetData.push([
        `Decil seleccionado D${selectedDecile}`,
        selectedDecileValue ?? "N/A",
      ]);

      resultsSheetData.push([
        percentileNumber === null
          ? "Percentil especifico (1-99)"
          : `Percentil P${percentileNumber}`,
        specificPercentileValue ?? "N/A",
      ]);

      const valuesSheetData: Array<[number, number]> = parsed.values.map(
        (value, index) => [index + 1, value],
      );

      const workbook = XLSX.utils.book_new();
      const resultsSheet = XLSX.utils.aoa_to_sheet(resultsSheetData);
      const valuesSheet = XLSX.utils.aoa_to_sheet([
        ["Indice", "Valor"],
        ...valuesSheetData,
      ]);

      XLSX.utils.book_append_sheet(workbook, resultsSheet, "Resultados");
      XLSX.utils.book_append_sheet(workbook, valuesSheet, "Datos");

      if (parsed.invalidTokens.length > 0) {
        const invalidSheet = XLSX.utils.aoa_to_sheet([
          ["Valores ignorados"],
          ...parsed.invalidTokens.map((token) => [token]),
        ]);
        XLSX.utils.book_append_sheet(workbook, invalidSheet, "Ignorados");
      }

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      XLSX.writeFile(workbook, `estadistica-descriptiva-${timestamp}.xlsx`);
      setActionMessage("Archivo Excel exportado.");
    } catch {
      setActionMessage("No se pudo exportar Excel. Intenta nuevamente.");
    }
  }

  const modeLabel =
    stats === null
      ? "N/A"
      : stats.mode.length === 0
        ? "Sin moda"
        : stats.mode.map((value) => formatNumber(value)).join(", ");

  const metricRows: Array<[string, string]> = stats
    ? [
        ["Media", formatNumber(stats.mean)],
        ["Error tipico", formatNumber(stats.standardError)],
        ["Mediana", formatNumber(stats.median)],
        ["Moda", modeLabel],
        ["Desviacion estandar (muestral)", formatNumber(stats.sampleStdDev)],
        ["Varianza de la muestra", formatNumber(stats.sampleVariance)],
        ["Curtosis (exceso)", formatNumber(stats.kurtosis)],
        ["Coeficiente de asimetria", formatNumber(stats.skewness)],
        ["Rango", formatNumber(stats.range)],
        ["Minimo", formatNumber(stats.min)],
        ["Maximo", formatNumber(stats.max)],
        ["Suma", formatNumber(stats.sum)],
        ["Cuenta", String(stats.count)],
        ["Q1 (P25)", formatNumber(stats.q1)],
        ["Q2 (P50)", formatNumber(stats.q2)],
        ["Q3 (P75)", formatNumber(stats.q3)],
        [`Decil D${selectedDecile}`, formatNumber(selectedDecileValue)],
        [
          percentileNumber === null ? "Percentil (1-99)" : `Percentil P${percentileNumber}`,
          formatNumber(specificPercentileValue),
        ],
      ]
    : [];

  return (
    <div className={styles.page}>
      <main className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.logoBox}>
            <Image
              src="/Blackosito.png"
              alt="Logo de Osito Calculator"
              fill
              className={styles.logo}
              priority
            />
          </div>

          <div>
            <p className={styles.kicker}>OSITO UPC</p>
            <h1 className={styles.title}>Osito Calculator</h1>
            <p className={styles.subtitle}>
              Pega tus numeros y presiona Calcular. Incluye estadistica
              descriptiva, cuartiles, deciles y percentiles.
            </p>
          </div>
        </header>

        <section className={styles.layoutGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Entrada de datos</h2>

              <div className={styles.actions}>
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className={`${styles.button} ${styles.buttonGhost}`}
                >
                  Cargar ejemplo
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className={`${styles.button} ${styles.buttonGhost}`}
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleCalculate}
                  className={`${styles.button} ${styles.buttonPrimary}`}
                >
                  Calcular
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={!stats}
                  className={`${styles.button} ${styles.buttonDark}`}
                >
                  Exportar Excel
                </button>
              </div>

              <div className={styles.positionControls}>
                <label className={styles.inlineField}>
                  <span>Decil (selector)</span>
                  <select
                    value={selectedDecile}
                    onChange={(event) => setSelectedDecile(Number(event.target.value))}
                    className={styles.select}
                  >
                    {Array.from({ length: 9 }, (_, index) => (
                      <option key={index + 1} value={index + 1}>
                        D{index + 1}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.inlineField}>
                  <span>Percentil especifico (1-99)</span>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    step={1}
                    value={percentileInput}
                    onChange={(event) => setPercentileInput(event.target.value)}
                    className={styles.input}
                  />
                </label>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              className={styles.textarea}
              placeholder="Ejemplo: 10, 12, 15\n20\n25"
            />

            <div className={styles.metaGrid}>
              <p>
                Valores validos: <strong>{parsed.values.length}</strong>
              </p>
              <p>
                Valores invalidos: <strong>{parsed.invalidTokens.length}</strong>
              </p>
            </div>

            {actionMessage && <p className={styles.message}>{actionMessage}</p>}

            {parsed.invalidTokens.length > 0 && (
              <p className={styles.invalid}>
                Se ignoraron estos valores por no ser numericos: {" "}
                {parsed.invalidTokens.slice(0, 12).join(", ")}
                {parsed.invalidTokens.length > 12 ? "..." : ""}
              </p>
            )}
          </article>

          <article className={styles.panel}>
            <h2 className={styles.panelTitle}>Resultados</h2>

            {stats ? (
              <>
                <dl className={styles.resultsGrid}>
                  {metricRows.map(([label, value]) => (
                    <div key={label} className={styles.resultTile}>
                      <dt className={styles.resultLabel}>{label}</dt>
                      <dd className={styles.resultValue}>{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className={styles.decilesBlock}>
                  <h3 className={styles.subsectionTitle}>Resumen Deciles (D1-D9)</h3>
                  <div className={styles.decilesGrid}>
                    {stats.deciles.map((value, index) => (
                      <div key={`decil-${index + 1}`} className={styles.decileItem}>
                        <span className={styles.decileKey}>D{index + 1}</span>
                        <span className={styles.decileValue}>{formatNumber(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.emptyState}>
                Ingresa al menos un numero valido y presiona Calcular.
              </p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
