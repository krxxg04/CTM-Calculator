"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

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
};

const SAMPLE_DATA = `12, 18, 21, 21, 25
30
32
35
35
40`;

const STORAGE_INPUT_KEY = "ctm-calculator.input";

const numberFormatter = new Intl.NumberFormat("es-ES", {
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
  const [actionMessage, setActionMessage] = useState<string>("");
  const [isStateRestored, setIsStateRestored] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(() => parseValues(input), [input]);

  const stats = useMemo(
    () => (parsed.values.length > 0 ? calculateStatistics(parsed.values) : null),
    [parsed.values],
  );

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

      if (savedInput !== null) {
        setInput(savedInput);
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
  }, [input, isStateRestored]);

  function handleLoadExample(): void {
    setInput(SAMPLE_DATA);
    setActionMessage("Ejemplo cargado correctamente.");
    textareaRef.current?.focus();
  }

  function handleClear(): void {
    setInput("");
    setActionMessage("Datos limpiados.");
    textareaRef.current?.focus();
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
      ];

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
    stats?.mode.length === 0
      ? "Sin moda"
      : stats?.mode.map((value) => formatNumber(value)).join(", ");

  const metricRows = stats
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
      ]
    : [];

  return (
    <div className="relative flex min-h-screen items-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-zinc-900/10 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-zinc-200/80 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-6xl rounded-3xl border border-zinc-900/20 bg-white/95 p-4 shadow-[0_25px_70px_rgba(0,0,0,0.2)] backdrop-blur-md sm:p-6 lg:p-8">
        <header className="mb-6">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-zinc-400 bg-white shadow-sm">
              <Image
                src="/image.png"
                alt="Logo de Osito Calculator"
                fill
                className="object-contain p-1 invert contrast-125"
                priority
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold tracking-[0.2em] text-zinc-500 uppercase">
                OSITO CALCULATOR
              </p>
              <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl lg:text-4xl">
                Osito Calculator
              </h1>
            </div>
          </div>

          <p className="mt-3 max-w-3xl text-sm text-zinc-600 sm:text-base">
            Pega tus numeros separados por comas, saltos de linea, tabulaciones
            o punto y coma. Usa punto para decimales (ej. 12.5). El calculo se
            actualiza automaticamente.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-zinc-300 bg-zinc-50 p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-zinc-900">Entrada de datos</h2>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadExample}
                  className="rounded-full border border-zinc-400 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-600 hover:bg-zinc-200"
                >
                  Cargar ejemplo
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-full border border-zinc-400 px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-600 hover:bg-zinc-200"
                >
                  Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={!stats}
                  className="rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:border-zinc-400 disabled:bg-zinc-300 disabled:text-zinc-500"
                >
                  Exportar Excel
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              className="h-72 w-full resize-y rounded-xl border border-zinc-400 bg-white p-3 font-mono text-sm text-zinc-900 outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-400/40"
              placeholder="Ejemplo: 10, 12, 15\n20\n25"
            />

            <div className="mt-3 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
              <p>
                Valores validos: <strong>{parsed.values.length}</strong>
              </p>
              <p>
                Valores invalidos: <strong>{parsed.invalidTokens.length}</strong>
              </p>
            </div>

            <p className="mt-2 text-xs text-zinc-600">
              Regla: coma para separar numeros y punto para decimales.
            </p>

            {actionMessage && (
              <p className="mt-2 rounded-xl border border-zinc-400 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
                {actionMessage}
              </p>
            )}

            {parsed.invalidTokens.length > 0 && (
              <p className="mt-2 rounded-xl border border-zinc-400 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
                Se ignoraron estos valores por no ser numericos: {" "}
                {parsed.invalidTokens.slice(0, 12).join(", ")}
                {parsed.invalidTokens.length > 12 ? "..." : ""}
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-zinc-300 bg-white p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">Resultados</h2>

            {stats ? (
              <>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {metricRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2"
                    >
                      <dt className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                        {label}
                      </dt>
                      <dd className="mt-1 break-words text-base font-semibold text-zinc-900">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <p className="rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
                Ingresa al menos un numero valido para ver los resultados.
              </p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
