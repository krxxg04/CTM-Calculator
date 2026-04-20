"use client";

import { useMemo, useState } from "react";

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

const numberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 6,
});

function tokenizeInput(input: string): string[] {
  const lines = input.replaceAll("\r", "").split("\n");
  const tokens: string[] = [];

  for (const line of lines) {
    const segments = line.split(/[;\t]+/);

    for (const segment of segments) {
      const trimmed = segment.trim();
      if (!trimmed) {
        continue;
      }

      const whitespaceChunks = trimmed.split(/\s+/).filter(Boolean);

      for (const chunk of whitespaceChunks) {
        if (!chunk.includes(",")) {
          tokens.push(chunk);
          continue;
        }

        // Si hay un solo numero con coma decimal, lo convertimos a punto.
        const isDecimalComma = /^[-+]?\d+,\d+(?:e[-+]?\d+)?$/i.test(chunk);
        if (isDecimalComma) {
          tokens.push(chunk.replace(",", "."));
          continue;
        }

        tokens.push(...chunk.split(",").map((value) => value.trim()).filter(Boolean));
      }
    }
  }

  return tokens;
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
  const [input, setInput] = useState<string>(SAMPLE_DATA);

  const parsed = useMemo(() => parseValues(input), [input]);
  const stats = useMemo(
    () => (parsed.values.length > 0 ? calculateStatistics(parsed.values) : null),
    [parsed.values],
  );

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
        <div className="absolute -top-20 -left-16 h-64 w-64 rounded-full bg-[#f59e0b]/20 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-80 w-80 rounded-full bg-[#0ea5e9]/20 blur-3xl" />
      </div>

      <main className="relative mx-auto w-full max-w-6xl rounded-3xl border border-slate-900/10 bg-white/85 p-4 shadow-2xl backdrop-blur-md sm:p-6 lg:p-8">
        <header className="mb-6 space-y-2">
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
            Estadistica Descriptiva
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">
            Calculadora Estadistica
          </h1>
          <p className="max-w-3xl text-sm text-slate-600 sm:text-base">
            Pega tus numeros separados por comas, saltos de linea, tabulaciones
            o punto y coma. El calculo se actualiza automaticamente.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Entrada de datos</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInput(SAMPLE_DATA)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  Cargar ejemplo
                </button>
                <button
                  type="button"
                  onClick={() => setInput("")}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              spellCheck={false}
              className="h-72 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
              placeholder="Ejemplo: 10, 12, 15\n20\n25"
            />

            <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
              <p>
                Valores validos: <strong>{parsed.values.length}</strong>
              </p>
              <p>
                Valores invalidos: <strong>{parsed.invalidTokens.length}</strong>
              </p>
            </div>

            {parsed.invalidTokens.length > 0 && (
              <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Se ignoraron estos valores por no ser numericos: {" "}
                {parsed.invalidTokens.slice(0, 12).join(", ")}
                {parsed.invalidTokens.length > 12 ? "..." : ""}
              </p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Resultados</h2>

            {stats ? (
              <>
                <dl className="grid gap-2 sm:grid-cols-2">
                  {metricRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2"
                    >
                      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                        {label}
                      </dt>
                      <dd className="mt-1 text-base font-semibold text-slate-900 break-words">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-900">
                  Error tipico = s / sqrt(n), donde s es la desviacion estandar
                  muestral. La asimetria y la curtosis usan estimadores
                  muestrales corregidos (Fisher-Pearson / exceso de curtosis).
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-600">
                Ingresa al menos un numero valido para ver los resultados.
              </p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
