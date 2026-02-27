let coChart;
let co2Chart;

function buildBaseConfig(label, borderColor, warningLine, dangerLine) {
  return {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          borderColor,
          backgroundColor: "rgba(59,130,246,0.2)",
          tension: 0.25,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(148,163,184,0.15)" },
        },
        y: {
          ticks: { color: "#cbd5e1" },
          grid: { color: "rgba(148,163,184,0.15)" },
        },
      },
      plugins: {
        legend: {
          labels: { color: "#e2e8f0" },
        },
        annotation: {
          annotations: {
            warning: {
              type: "line",
              yMin: warningLine,
              yMax: warningLine,
              borderColor: "#f59e0b",
              borderWidth: 2,
            },
            danger: {
              type: "line",
              yMin: dangerLine,
              yMax: dangerLine,
              borderColor: "#ef4444",
              borderWidth: 2,
            },
          },
        },
      },
    },
  };
}

function initCharts() {
  const coCtx = document.getElementById("coChart");
  const co2Ctx = document.getElementById("co2Chart");

  if (!coCtx || !co2Ctx) return;

  coChart = new Chart(coCtx, buildBaseConfig("CO PPM", "#22c55e", 35, 70));
  co2Chart = new Chart(co2Ctx, buildBaseConfig("CO2 PPM", "#06b6d4", 1000, 2000));
}

function updateCharts(readings) {
  if (!coChart || !co2Chart) return;

  const sorted = [...readings].sort((a, b) => {
    const ta = a.timestamp?.seconds || 0;
    const tb = b.timestamp?.seconds || 0;
    return ta - tb;
  });

  const labels = sorted.map((r) => {
    const seconds = r.timestamp?.seconds;
    if (!seconds) return "--";
    return new Date(seconds * 1000).toLocaleTimeString();
  });

  const coValues = sorted.map((r) => Number(r.co_ppm || 0));
  const co2Values = sorted.map((r) => Number(r.co2_ppm || 0));

  coChart.data.labels = labels;
  coChart.data.datasets[0].data = coValues;
  coChart.update();

  co2Chart.data.labels = labels;
  co2Chart.data.datasets[0].data = co2Values;
  co2Chart.update();
}

export { initCharts, updateCharts };
