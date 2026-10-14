"use client";

import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler
);

ChartJS.defaults.font.family = '"Segoe UI", "Noto Sans Thai", Tahoma, Arial, sans-serif';
ChartJS.defaults.color = "#6b7280";

const GRID = "rgba(148, 163, 184, 0.25)";

export interface Pair {
  label: string;
  value: number;
}

export function StatusDoughnut({ data }: { data: Pair[] }) {
  return (
    <Doughnut
      data={{
        labels: data.map((d) => d.label),
        datasets: [
          {
            data: data.map((d) => d.value),
            backgroundColor: ["#0f766e", "#d97706", "#dc2626"],
            borderColor: "#ffffff",
            borderWidth: 3,
            hoverOffset: 8,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        cutout: "66%",
        plugins: {
          legend: { position: "bottom", labels: { usePointStyle: true, padding: 16 } },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed} รายการ` } },
        },
      }}
    />
  );
}

export function ExpiryMonthBar({ data }: { data: Pair[] }) {
  return (
    <Bar
      data={{
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: "เอกสารที่หมดอายุ",
            data: data.map((d) => d.value),
            backgroundColor: "#2563eb",
            hoverBackgroundColor: "#1d4ed8",
            borderRadius: 6,
            maxBarThickness: 34,
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y} รายการ` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: GRID } },
        },
      }}
    />
  );
}

export function AddTrendLine({ data }: { data: Pair[] }) {
  const values = data.map((d) => d.value);
  return (
    <Line
      data={{
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: "เอกสารที่บันทึกรายเดือน",
            data: values,
            borderColor: "#0f766e",
            backgroundColor: (ctx) => {
              const { ctx: c, chartArea } = ctx.chart;
              if (!chartArea) return "rgba(15,118,110,0.15)";
              const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, "rgba(15,118,110,0.35)");
              g.addColorStop(1, "rgba(15,118,110,0.02)");
              return g;
            },
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: "#0f766e",
          },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45 } },
          y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: GRID } },
        },
      }}
    />
  );
}

export function HorizontalBar({ data, color = "#2563eb" }: { data: Pair[]; color?: string }) {
  return (
    <Bar
      data={{
        labels: data.map((d) => d.label),
        datasets: [
          {
            label: "จำนวนเอกสาร",
            data: data.map((d) => d.value),
            backgroundColor: color,
            borderRadius: 6,
            maxBarThickness: 22,
          },
        ],
      }}
      options={{
        indexAxis: "y" as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: GRID } },
          y: { grid: { display: false } },
        },
      }}
    />
  );
}
