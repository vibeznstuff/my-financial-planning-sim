import { useEffect, useState } from "react";

/**
 * Validated categorical palette (see docs/ARCHITECTURE.md — charts section).
 * SVG presentation attributes can't resolve CSS variables, so chart colors
 * are supplied as concrete hex per color scheme.
 */
const LIGHT = {
  series: ["#2a78d6", "#008300", "#e87ba4", "#eda100", "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"],
  grid: "#e1e0d9",
  baseline: "#c3c2b7",
  muted: "#898781",
  surface: "#fcfcfb",
  text: "#0b0b0b",
};

const DARK = {
  series: ["#3987e5", "#008300", "#d55181", "#c98500", "#199e70", "#d95926", "#9085e9", "#e66767"],
  grid: "#2c2c2a",
  baseline: "#383835",
  muted: "#898781",
  surface: "#1a1a19",
  text: "#ffffff",
};

export type ChartPalette = typeof LIGHT;

export function useChartPalette(): ChartPalette {
  const [dark, setDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return dark ? DARK : LIGHT;
}
