document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const x0 = parseInt(urlParams.get("semilla"), 10);
    const a = parseInt(urlParams.get("multiplicador"), 10);
    const m = parseInt(urlParams.get("modulo"), 10);
    const n = parseInt(urlParams.get("cantidad"), 10);

    const resumenDiv = document.getElementById("resumenParametros");
    const tbody = document.getElementById("cuerpoTablageneradora");

    if (isNaN(x0) || isNaN(a) || isNaN(m) || isNaN(n)) {
        resumenDiv.innerHTML = `<div class="col-12 text-warning">No se recibieron parámetros válidos. Vuelve al inicio para ingresar los datos.</div>`;
        return;
    }

    resumenDiv.innerHTML = `
        <div class="col-md-3"><strong>Semilla (X₀):</strong> ${x0}</div>
        <div class="col-md-3"><strong>Multiplicador (a):</strong> ${a}</div>
        <div class="col-md-3"><strong>Módulo (m):</strong> ${m}</div>
        <div class="col-md-3"><strong>Cantidad (n):</strong> ${n}</div>
    `;

    let xActual = x0;
    let periodoDetectado = false;
    // lista de valores para realziar el grafico 
    const uValores = [];
    // iteracion de las operaciones para hacer el calculo de los siguientes numeros

    for (let i = 1; i <= n; i++) {
        const producto = a * xActual;
        const xSiguiente = producto % m;
        const u_n = xSiguiente / m;
        // se añade u_n a la lista
        uValores.push(u_n);
        // creacion dinamica del la fila 
        const tr = document.createElement("tr");

        // Resaltar si vuelve a aparecer una semilla (repetición / ciclo)
        if (xSiguiente === x0 && !periodoDetectado && i > 1) {
            tr.classList.add("table-warning");
            periodoDetectado = true;
        }
        // se insertan los valores a la fila creada dinamicamente

        tr.innerHTML = `
            <td><strong>${i}</strong></td>
            <td>${xActual}</td>
            <td>${producto}</td>
            <td><span class="badge bg-primary fs-6">${xSiguiente}</span></td>
            <td><code>${u_n.toFixed(5)}</code></td>
        `;
        // se añade ese hijo a la tabla creada en el html

        tbody.appendChild(tr);

        // Avanzamos para la siguiente iteración
        xActual = xSiguiente;
    }

    // Renderizar los gráficos de dispersión
    renderizarGraficos(uValores, n);
});
// Función para renderizar los gráficos de dispersión se uso la libreria chart.js para hacer los graficos de dispersión
function renderizarGraficos(uValores, n) {
    // 1. Datos para dispersión 2D de pares consecutivos (U_i, U_{i+1})
    const dataPares = [];
    for (let i = 0; i < uValores.length - 1; i++) {
        dataPares.push({
            x: Number(uValores[i].toFixed(5)),
            y: Number(uValores[i + 1].toFixed(5))
        });
    }

    // 2. Datos para dispersión secuencial (i, U_i)
    const dataSecuencia = uValores.map((val, idx) => ({
        x: idx + 1,
        y: Number(val.toFixed(5))
    }));

    const gridColor = "rgba(255, 255, 255, 0.1)";
    const tickColor = "#e0e0e0";

    // Gráfico 1: Pares Consecutivos (Ui vs Ui+1)
    const canvasPares = document.getElementById("graficoPares");
    if (canvasPares) {
        const ctxPares = canvasPares.getContext("2d");
        new Chart(ctxPares, {
            type: "scatter",
            data: {
                datasets: [{
                    label: "Puntos (Uᵢ, Uᵢ₊₁)",
                    data: dataPares,
                    backgroundColor: "#00b4d8",
                    borderColor: "#90e0ef",
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: tickColor } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` (U_${ctx.dataIndex + 1}, U_${ctx.dataIndex + 2}) = (${ctx.parsed.x}, ${ctx.parsed.y})`
                        }
                    }
                },
                scales: {
                    x: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: "Uᵢ", color: tickColor },
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: "Uᵢ₊₁", color: tickColor },
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    }
                }
            }
        });
    }

    // Gráfico 2: Secuencia (i vs Ui)
    const canvasSecuencia = document.getElementById("graficoSecuencia");
    if (canvasSecuencia) {
        const ctxSecuencia = canvasSecuencia.getContext("2d");
        new Chart(ctxSecuencia, {
            type: "scatter",
            data: {
                datasets: [{
                    label: "Puntos (i, Uᵢ)",
                    data: dataSecuencia,
                    backgroundColor: "#2ec4b6",
                    borderColor: "#cbf3f0",
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: tickColor } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => ` Iteración ${ctx.parsed.x}: U = ${ctx.parsed.y}`
                        }
                    }
                },
                scales: {
                    x: {
                        min: 1,
                        max: n,
                        title: { display: true, text: "Iteración (i)", color: tickColor },
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    },
                    y: {
                        min: 0,
                        max: 1,
                        title: { display: true, text: "Uᵢ (Valor entre 0 y 1)", color: tickColor },
                        grid: { color: gridColor },
                        ticks: { color: tickColor }
                    }
                }
            }
        });
    }
}