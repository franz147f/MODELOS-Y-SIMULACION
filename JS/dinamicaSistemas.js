// =========================================================================
// LABORATORIO 3: PROYECTO DE SIMULACIÓN - DINÁMICA DE SISTEMAS
// Caso: Simulación Continua de Rendimiento y Cola de Peticiones de un Servidor
// Método numérico: Integración de Euler sobre ecuaciones diferenciales (Forrester)
// =========================================================================

let chartStock = null;
let chartFlujos = null;
let chartAuxiliares = null;
let chartEscenarios = null;

// Presets para el Apartado (g) Experimentación de Escenarios Hipotéticos
const ESCENARIOS_PRESET = {
    1: {
        nombre: "Escenario 1: Operación Nominal (Caso Base)",
        descripcion: "Demanda estándar (120 pet/h) con servidor de capacidad nominal (K = 1.0) y buffer de 100 peticiones.",
        tasaDemanda: 120,
        colaInicial: 15,
        capacidadBuffer: 100,
        factorServidor: 1.0,
        tiempoProc: 0.25,
        coefContencion: 1.2,
        umbralSla: 15,
        horizonteHoras: 24,
        dt: 0.25,
        modoDemanda: "constante"
    },
    2: {
        nombre: "Escenario 2: Pico de Tráfico / Sobrecarga (Stress Test)",
        descripcion: "Aumento brusco de la demanda a 210 pet/h sin escalar hardware. Activa el bucle reforzador R1 de contención.",
        tasaDemanda: 210,
        colaInicial: 15,
        capacidadBuffer: 100,
        factorServidor: 1.0,
        tiempoProc: 0.25,
        coefContencion: 1.2,
        umbralSla: 15,
        horizonteHoras: 24,
        dt: 0.25,
        modoDemanda: "constante"
    },
    3: {
        nombre: "Escenario 3: Política de Escalamiento de Recursos (Mitigación)",
        descripcion: "Demanda alta (210 pet/h) compensada con ampliación de CPU/BD (K = 1.75) y expansión de buffer a 150 peticiones.",
        tasaDemanda: 210,
        colaInicial: 15,
        capacidadBuffer: 150,
        factorServidor: 1.75,
        tiempoProc: 0.25,
        coefContencion: 1.2,
        umbralSla: 15,
        horizonteHoras: 24,
        dt: 0.25,
        modoDemanda: "constante"
    },
    4: {
        nombre: "Escenario 4: Contención Crítica en Base de Datos (Thrashing)",
        descripcion: "Demanda moderada (140 pet/h) pero con bloqueos severos en BD (α = 2.4) y degradación de capacidad (K = 0.80).",
        tasaDemanda: 140,
        colaInicial: 25,
        capacidadBuffer: 90,
        factorServidor: 0.80,
        tiempoProc: 0.25,
        coefContencion: 2.4,
        umbralSla: 15,
        horizonteHoras: 24,
        dt: 0.25,
        modoDemanda: "constante"
    }
};

// =========================================================================
// 1. MOTOR DE INTEGRACIÓN NUMÉRICA DE DINÁMICA DE SISTEMAS (EULER)
// =========================================================================
function ejecutarModeloForrester(params) {
    const {
        tasaDemanda,      // Lambda_0 (peticiones/hora)
        colaInicial,      // Q(0) (peticiones)
        capacidadBuffer,  // C_max (peticiones)
        factorServidor,   // K_srv (adimensional)
        tiempoProc,       // tau_proc (horas)
        coefContencion,   // alpha_cont (adimensional)
        umbralSla,        // SLA_max (%)
        horizonteHoras,   // T_final (horas)
        dt,               // TIME STEP (horas)
        modoDemanda       // "constante" | "ciclica"
    } = params;

    // Constantes estructurales heredadas del Laboratorio 2
    const propSimples = 0.60;        // 60% Consultas Simples
    const propBd = 0.35;             // 35% Transacciones BD
    const tasaBaseError = 0.05 / tiempoProc; // 5% de tasa base de error de red (0.20 1/h para tau=0.25)
    const coefTimeout = 0.35;        // Penalización de timeout por saturación (1/h)
    const latenciaBase = 155;        // Latencia base ponderada en ms (60% simples + 35% BD)
    const coefLatencia = 0.85;       // Sensibilidad de latencia a la saturación

    let Q = colaInicial; // Nivel (Stock): Peticiones en Cola
    const pasos = Math.round(horizonteHoras / dt);

    const historial = [];
    let acumSla = 0;
    let acumLatencia = 0;
    let acumEficiencia = 0;
    let maxCola = Q;
    let maxLatencia = 0;
    let maxSla = 0;
    let totalArribos = 0;
    let totalSimples = 0;
    let totalBd = 0;
    let totalDescartes = 0;

    for (let paso = 0; paso <= pasos; paso++) {
        const t = Number((paso * dt).toFixed(4));

        // --- VARIABLES AUXILIARES ---
        // Auxiliar 1: Índice de Saturación del Servidor
        const indiceSaturacion = Q / capacidadBuffer;

        // Auxiliar 2: Eficiencia Operativa del Servidor (Bucle Reforzador R1 de contención CPU/BD)
        const eficienciaOperativa = 1 / (1 + coefContencion * Math.pow(indiceSaturacion, 2));

        // Auxiliar 3: Latencia Promedio del Sistema (ms)
        const latenciaPromedio = latenciaBase * (1 + (coefLatencia * indiceSaturacion) / eficienciaOperativa);

        // Auxiliar 4: Porcentaje de Incumplimiento SLA (% Alta Latencia + Timeouts)
        const porcIncumplimientoSla = Math.min(
            100,
            100 * (0.05 + 0.18 * (indiceSaturacion / eficienciaOperativa))
        );

        // Auxiliar 5: Factor de Control de Admisión / Backpressure (Bucle Compensador B2)
        const factorAdmision = Math.max(0.10, 1 - 0.15 * Math.pow(indiceSaturacion, 2));

        // Modulación opcional de demanda horaria (constante o sinusoidal de 24h)
        const moduladorHorario = modoDemanda === "ciclica"
            ? (1 + 0.30 * Math.sin((2 * Math.PI * (t - 6)) / 24))
            : 1.0;

        // --- VARIABLES DE FLUJO (peticiones / hora) ---
        // Flujo 1 (Entrada): Flujo de Arribo de Peticiones
        const flujoArribo = tasaDemanda * moduladorHorario * factorAdmision;

        // Flujo 2 (Salida 1): Flujo de Procesamiento de Consultas Simples
        const flujoSimples = propSimples * (Q / tiempoProc) * factorServidor * eficienciaOperativa;

        // Flujo 3 (Salida 2): Flujo de Procesamiento de Transacciones BD
        const flujoBd = propBd * (Q / tiempoProc) * factorServidor * eficienciaOperativa;

        // Flujo 4 (Salida 3): Flujo de Descarte por Timeout y Error
        const flujoDescarte = Q * (tasaBaseError + coefTimeout * Math.pow(indiceSaturacion, 2));

        // Flujo Neto (dQ/dt)
        const flujoNeto = flujoArribo - (flujoSimples + flujoBd + flujoDescarte);

        // Registro de métricas estadísticas
        acumSla += porcIncumplimientoSla;
        acumLatencia += latenciaPromedio;
        acumEficiencia += eficienciaOperativa;
        if (Q > maxCola) maxCola = Q;
        if (latenciaPromedio > maxLatencia) maxLatencia = latenciaPromedio;
        if (porcIncumplimientoSla > maxSla) maxSla = porcIncumplimientoSla;

        historial.push({
            paso,
            t,
            Q,
            indiceSaturacion,
            eficienciaOperativa,
            latenciaPromedio,
            porcIncumplimientoSla,
            factorAdmision,
            flujoArribo,
            flujoSimples,
            flujoBd,
            flujoDescarte,
            flujoNeto
        });

        // Integración de Euler hacia el siguiente instante t + dt
        if (paso < pasos) {
            totalArribos += flujoArribo * dt;
            totalSimples += flujoSimples * dt;
            totalBd += flujoBd * dt;
            totalDescartes += flujoDescarte * dt;

            Q = Math.max(0, Q + flujoNeto * dt);
        }
    }

    const nPuntos = historial.length;
    const estadoFinal = historial[nPuntos - 1];
    const promedioSla = acumSla / nPuntos;
    const promedioLatencia = acumLatencia / nPuntos;
    const promedioEficiencia = (acumEficiencia / nPuntos) * 100;
    const cumpleHipotesis = estadoFinal.porcIncumplimientoSla <= umbralSla && promedioSla <= umbralSla;

    return {
        params,
        historial,
        resumen: {
            colaFinal: estadoFinal.Q,
            maxCola,
            saturacionFinal: estadoFinal.indiceSaturacion * 100,
            eficienciaFinal: estadoFinal.eficienciaOperativa * 100,
            promedioEficiencia,
            latenciaFinal: estadoFinal.latenciaPromedio,
            promedioLatencia,
            maxLatencia,
            slaFinal: estadoFinal.porcIncumplimientoSla,
            promedioSla,
            maxSla,
            totalArribos,
            totalSimples,
            totalBd,
            totalDescartes,
            cumpleHipotesis
        }
    };
}

// =========================================================================
// 2. GESTIÓN DE LA INTERFAZ Y ACTUALIZACIÓN DE RESULTADOS
// =========================================================================
function leerParametrosFormulario() {
    return {
        tasaDemanda: parseFloat(document.getElementById("tasaDemanda").value),
        colaInicial: parseFloat(document.getElementById("colaInicial").value),
        capacidadBuffer: parseFloat(document.getElementById("capacidadBuffer").value),
        factorServidor: parseFloat(document.getElementById("factorServidor").value),
        tiempoProc: parseFloat(document.getElementById("tiempoProc").value),
        coefContencion: parseFloat(document.getElementById("coefContencion").value),
        umbralSla: parseFloat(document.getElementById("umbralSla").value),
        horizonteHoras: parseFloat(document.getElementById("horizonteHoras").value),
        dt: parseFloat(document.getElementById("pasoIntegracion").value),
        modoDemanda: document.getElementById("modoDemanda").value
    };
}

function cargarEscenarioPreset(idEscenario) {
    const preset = ESCENARIOS_PRESET[idEscenario];
    if (!preset) return;

    document.getElementById("tasaDemanda").value = preset.tasaDemanda;
    document.getElementById("colaInicial").value = preset.colaInicial;
    document.getElementById("capacidadBuffer").value = preset.capacidadBuffer;
    document.getElementById("factorServidor").value = preset.factorServidor;
    document.getElementById("tiempoProc").value = preset.tiempoProc;
    document.getElementById("coefContencion").value = preset.coefContencion;
    document.getElementById("umbralSla").value = preset.umbralSla;
    document.getElementById("horizonteHoras").value = preset.horizonteHoras;
    document.getElementById("pasoIntegracion").value = preset.dt;
    document.getElementById("modoDemanda").value = preset.modoDemanda;

    // Resaltar botón activo
    document.querySelectorAll(".btn-escenario").forEach((btn) => {
        btn.classList.remove("activo-escenario");
    });
    const btnActivo = document.getElementById(`btnEscenario${idEscenario}`);
    if (btnActivo) btnActivo.classList.add("activo-escenario");

    const bannerEscenario = document.getElementById("bannerEscenarioActivo");
    if (bannerEscenario) {
        bannerEscenario.innerHTML = `<strong>${preset.nombre}:</strong> ${preset.descripcion}`;
    }

    simularYRenderizar();
}

function simularYRenderizar() {
    const params = leerParametrosFormulario();
    const resultado = ejecutarModeloForrester(params);
    const { resumen, historial } = resultado;

    // 1. Actualizar Tarjetas de Indicadores de Estado Estacionario
    document.getElementById("kpiColaEquilibrio").textContent = `${resumen.colaFinal.toFixed(1)} pet`;
    document.getElementById("kpiSaturacion").textContent = `Saturación Buffer: ${resumen.saturacionFinal.toFixed(1)}% (Pico: ${resumen.maxCola.toFixed(1)})`;

    document.getElementById("kpiLatencia").textContent = `${resumen.latenciaFinal.toFixed(1)} ms`;
    document.getElementById("kpiEficiencia").textContent = `Eficiencia Operativa: ${resumen.eficienciaFinal.toFixed(1)}%`;

    document.getElementById("kpiSlaFinal").textContent = `${resumen.slaFinal.toFixed(2)}%`;
    const badgeSla = document.getElementById("kpiEstadoSla");
    if (resumen.cumpleHipotesis) {
        badgeSla.className = "badge bg-success mt-1";
        badgeSla.textContent = `Cumple SLA (≤ ${params.umbralSla}%)`;
    } else {
        badgeSla.className = "badge bg-danger mt-1";
        badgeSla.textContent = `Incumple SLA (> ${params.umbralSla}%)`;
    }

    const totalProcesadas = resumen.totalSimples + resumen.totalBd + resumen.totalDescartes;
    document.getElementById("kpiVolumenTotal").textContent = `${Math.round(totalProcesadas)} pet`;
    document.getElementById("kpiDesgloseFlujos").textContent =
        `Simples: ${Math.round(resumen.totalSimples)} | BD: ${Math.round(resumen.totalBd)} | Descartes: ${Math.round(resumen.totalDescartes)}`;

    // 2. Actualizar Alerta de Veredicto de la Hipótesis Sistémica
    const alertaDiv = document.getElementById("alertaHipotesisLab3");
    if (resumen.cumpleHipotesis) {
        alertaDiv.className = "alert alert-success border-success mb-4 shadow-sm";
        alertaDiv.innerHTML = `
            <h5 class="alert-heading fw-bold mb-1">✅ HIPÓTESIS SISTÉMICA VALIDADA (Equilibrio Dinámico Estable dentro de SLA)</h5>
            <p class="mb-0 fs-6 fw-normal text-dark">
                Los bucles compensadores de procesamiento (<strong>B₁</strong>) y admisión (<strong>B₂</strong>) estabilizaron el nivel 
                <strong>Peticiones en Cola</strong> en <strong>${resumen.colaFinal.toFixed(1)} peticiones</strong> (${resumen.saturacionFinal.toFixed(1)}% del buffer). 
                La <strong>Latencia Promedio</strong> convergió a <strong>${resumen.latenciaFinal.toFixed(1)} ms</strong> con una 
                <strong>Eficiencia Operativa</strong> del <strong>${resumen.eficienciaFinal.toFixed(1)}%</strong>, manteniendo el 
                <strong>Incumplimiento SLA en ${resumen.slaFinal.toFixed(2)}%</strong> (inferior al umbral máximo del <strong>${params.umbralSla}%</strong>).
            </p>
        `;
    } else {
        alertaDiv.className = "alert alert-danger border-danger mb-4 shadow-sm";
        alertaDiv.innerHTML = `
            <h5 class="alert-heading fw-bold mb-1">❌ HIPÓTESIS SISTÉMICA REFUTADA EN ESTE ESCENARIO (Dominancia del Bucle Reforzador R₁)</h5>
            <p class="mb-0 fs-6 fw-normal text-dark">
                La acumulación en <strong>Peticiones en Cola</strong> alcanzó <strong>${resumen.colaFinal.toFixed(1)} peticiones</strong> 
                (saturación del <strong>${resumen.saturacionFinal.toFixed(1)}%</strong>), activando el bucle positivo de contención (<strong>R₁</strong>) 
                que degradó la <strong>Eficiencia Operativa</strong> al <strong>${resumen.eficienciaFinal.toFixed(1)}%</strong> y elevó la 
                <strong>Latencia Promedio</strong> a <strong>${resumen.latenciaFinal.toFixed(1)} ms</strong>. El <strong>Incumplimiento SLA llegó al 
                ${resumen.slaFinal.toFixed(2)}%</strong>, superando el límite tolerado del <strong>${params.umbralSla}%</strong>. 
                <strong>Recomendación Sistémica:</strong> Escalar el factor de capacidad del servidor ($K_{srv} \\ge 1.6$) o ampliar el buffer.
            </p>
        `;
    }

    // 3. Renderizar Gráficos de Evolución Continua
    renderizarGraficoStock(historial, params.capacidadBuffer);
    renderizarGraficoFlujos(historial);
    renderizarGraficoAuxiliares(historial, params.umbralSla);

    // 4. Llenar Tabla de Integración Temporal (Muestreo cada 1 hora o todos los pasos)
    llenarTablaEvolucion(historial);

    // 5. Ejecutar Comparativa Multicorrida de los 4 Escenarios (Apartados g y h)
    ejecutarComparativaEscenarios();
}

// =========================================================================
// 3. GRÁFICOS DE DINÁMICA DE SISTEMAS (CHART.JS)
// =========================================================================
function renderizarGraficoStock(historial, capacidadBuffer) {
    const ctx = document.getElementById("graficoStock").getContext("2d");
    if (chartStock) chartStock.destroy();

    const labels = historial.map((d) => `${d.t}h`);
    const datosCola = historial.map((d) => Number(d.Q.toFixed(2)));
    const lineaCapacidad = historial.map(() => capacidadBuffer);

    chartStock = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Nivel: Peticiones en Cola Q(t) [peticiones]",
                    data: datosCola,
                    borderColor: "#00b4d8",
                    backgroundColor: "rgba(0, 180, 216, 0.18)",
                    borderWidth: 2.5,
                    pointRadius: 1.5,
                    fill: true,
                    tension: 0.25
                },
                {
                    label: "Capacidad Nominal del Buffer (C_max)",
                    data: lineaCapacidad,
                    borderColor: "#ef476f",
                    borderDash: [6, 6],
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: obtenerOpcionesChart("Tiempo (Horas)", "Peticiones acumuladas")
    });
}

function renderizarGraficoFlujos(historial) {
    const ctx = document.getElementById("graficoFlujos").getContext("2d");
    if (chartFlujos) chartFlujos.destroy();

    const labels = historial.map((d) => `${d.t}h`);

    chartFlujos = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Flujo Entrada: Arribo de Peticiones",
                    data: historial.map((d) => Number(d.flujoArribo.toFixed(2))),
                    borderColor: "#38b000",
                    borderWidth: 2.5,
                    pointRadius: 1,
                    tension: 0.25
                },
                {
                    label: "Flujo Salida 1: Consultas Simples (60%)",
                    data: historial.map((d) => Number(d.flujoSimples.toFixed(2))),
                    borderColor: "#00b4d8",
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.25
                },
                {
                    label: "Flujo Salida 2: Transacciones BD (35%)",
                    data: historial.map((d) => Number(d.flujoBd.toFixed(2))),
                    borderColor: "#ffb703",
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.25
                },
                {
                    label: "Flujo Salida 3: Descarte por Timeout y Error",
                    data: historial.map((d) => Number(d.flujoDescarte.toFixed(2))),
                    borderColor: "#e63946",
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.25
                }
            ]
        },
        options: obtenerOpcionesChart("Tiempo (Horas)", "Flujo (peticiones / hora)")
    });
}

function renderizarGraficoAuxiliares(historial, umbralSla) {
    const ctx = document.getElementById("graficoAuxiliares").getContext("2d");
    if (chartAuxiliares) chartAuxiliares.destroy();

    const labels = historial.map((d) => `${d.t}h`);

    chartAuxiliares = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "% Incumplimiento SLA (Alta Latencia / Timeout)",
                    data: historial.map((d) => Number(d.porcIncumplimientoSla.toFixed(2))),
                    borderColor: "#ff006e",
                    backgroundColor: "rgba(255, 0, 110, 0.12)",
                    borderWidth: 2.5,
                    pointRadius: 1.5,
                    fill: true,
                    yAxisID: "y"
                },
                {
                    label: `Umbral Máximo SLA (${umbralSla}%)`,
                    data: historial.map(() => umbralSla),
                    borderColor: "#ffbe0b",
                    borderDash: [5, 5],
                    borderWidth: 2,
                    pointRadius: 0,
                    yAxisID: "y"
                },
                {
                    label: "Eficiencia Operativa del Servidor (%)",
                    data: historial.map((d) => Number((d.eficienciaOperativa * 100).toFixed(1))),
                    borderColor: "#06d6a0",
                    borderWidth: 2,
                    pointRadius: 1,
                    yAxisID: "y"
                },
                {
                    label: "Latencia Promedio del Sistema (ms)",
                    data: historial.map((d) => Number(d.latenciaPromedio.toFixed(1))),
                    borderColor: "#8338ec",
                    borderWidth: 2,
                    pointRadius: 1,
                    yAxisID: "y1"
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: { labels: { color: "#e0e0e0", font: { size: 11 } } }
            },
            scales: {
                x: {
                    title: { display: true, text: "Tiempo (Horas)", color: "#e0e0e0" },
                    ticks: { color: "#e0e0e0", maxTicksLimit: 13 },
                    grid: { color: "rgba(255,255,255,0.08)" }
                },
                y: {
                    type: "linear",
                    position: "left",
                    beginAtZero: true,
                    max: 100,
                    title: { display: true, text: "Porcentaje (%)", color: "#e0e0e0" },
                    ticks: { color: "#e0e0e0" },
                    grid: { color: "rgba(255,255,255,0.08)" }
                },
                y1: {
                    type: "linear",
                    position: "right",
                    beginAtZero: true,
                    title: { display: true, text: "Latencia (ms)", color: "#c77dff" },
                    ticks: { color: "#c77dff" },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function ejecutarComparativaEscenarios() {
    const resultadosEscenarios = [1, 2, 3, 4].map((id) => {
        const preset = ESCENARIOS_PRESET[id];
        return {
            id,
            preset,
            sim: ejecutarModeloForrester(preset)
        };
    });

    // Renderizar Gráfico Multicorrida (% Incumplimiento SLA en los 4 escenarios)
    const ctx = document.getElementById("graficoComparativoEscenarios").getContext("2d");
    if (chartEscenarios) chartEscenarios.destroy();

    const labels = resultadosEscenarios[0].sim.historial.map((d) => `${d.t}h`);
    const colores = ["#00b4d8", "#e63946", "#06d6a0", "#ffb703"];

    const datasets = resultadosEscenarios.map((item, idx) => ({
        label: item.preset.nombre,
        data: item.sim.historial.map((d) => Number(d.porcIncumplimientoSla.toFixed(2))),
        borderColor: colores[idx],
        borderWidth: 2.5,
        pointRadius: 1,
        tension: 0.25
    }));

    datasets.push({
        label: "Límite SLA Hipótesis (15%)",
        data: labels.map(() => 15),
        borderColor: "#ffffff",
        borderDash: [6, 6],
        borderWidth: 1.8,
        pointRadius: 0
    });

    chartEscenarios = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },
        options: obtenerOpcionesChart("Tiempo (Horas)", "% Incumplimiento SLA (Alta Latencia / Timeout)")
    });

    // Llenar tabla comparativa de escenarios (Apartados g y h)
    const tbodyComp = document.getElementById("tablaComparativaEscenarios");
    if (tbodyComp) {
        tbodyComp.innerHTML = "";
        resultadosEscenarios.forEach((item) => {
            const r = item.sim.resumen;
            const p = item.preset;
            const estadoBadge = r.cumpleHipotesis
                ? `<span class="badge bg-success">VALIDADA (≤ 15%)</span>`
                : `<span class="badge bg-danger">REFUTADA (> 15%)</span>`;

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="text-start fw-bold">${p.nombre}</td>
                <td>${p.tasaDemanda} pet/h</td>
                <td>K = ${p.factorServidor} | C = ${p.capacidadBuffer}</td>
                <td><strong>${r.colaFinal.toFixed(1)} pet</strong> (${r.saturacionFinal.toFixed(1)}%)</td>
                <td>${r.eficienciaFinal.toFixed(1)}%</td>
                <td>${r.latenciaFinal.toFixed(1)} ms</td>
                <td><span class="fw-bold ${r.cumpleHipotesis ? "text-info" : "text-warning"}">${r.slaFinal.toFixed(2)}%</span></td>
                <td>${estadoBadge}</td>
            `;
            tbodyComp.appendChild(tr);
        });
    }
}

function llenarTablaEvolucion(historial) {
    const tbody = document.getElementById("cuerpoTablaEvolucion");
    if (!tbody) return;
    tbody.innerHTML = "";

    // Mostrar los pasos enteros de hora (o todos si son pocos) para facilitar lectura
    historial.forEach((fila) => {
        if (Number.isInteger(fila.t) || historial.length <= 50) {
            const tr = document.createElement("tr");
            const badgeSla = fila.porcIncumplimientoSla <= 15
                ? `<span class="badge bg-success">${fila.porcIncumplimientoSla.toFixed(2)}%</span>`
                : `<span class="badge bg-danger">${fila.porcIncumplimientoSla.toFixed(2)}%</span>`;

            tr.innerHTML = `
                <td><strong>${fila.t.toFixed(2)} h</strong></td>
                <td class="text-info fw-bold">${fila.Q.toFixed(2)}</td>
                <td>${fila.flujoArribo.toFixed(2)}</td>
                <td>${fila.flujoSimples.toFixed(2)}</td>
                <td>${fila.flujoBd.toFixed(2)}</td>
                <td class="text-danger">${fila.flujoDescarte.toFixed(2)}</td>
                <td>${(fila.indiceSaturacion * 100).toFixed(1)}%</td>
                <td>${(fila.eficienciaOperativa * 100).toFixed(1)}%</td>
                <td>${fila.latenciaPromedio.toFixed(1)} ms</td>
                <td>${badgeSla}</td>
            `;
            tbody.appendChild(tr);
        }
    });
}

function obtenerOpcionesChart(tituloX, tituloY) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
            legend: { labels: { color: "#e0e0e0", font: { size: 11 } } }
        },
        scales: {
            x: {
                title: { display: true, text: tituloX, color: "#e0e0e0" },
                ticks: { color: "#e0e0e0", maxTicksLimit: 13 },
                grid: { color: "rgba(255,255,255,0.08)" }
            },
            y: {
                beginAtZero: true,
                title: { display: true, text: tituloY, color: "#e0e0e0" },
                ticks: { color: "#e0e0e0" },
                grid: { color: "rgba(255,255,255,0.08)" }
            }
        }
    };
}

// Descargar archivo Vensim (.mdl) directamente desde el navegador
function descargarModeloVensim() {
    const contenidoMdl = `{UTF-8}
Peticiones en Cola = INTEG(
	Flujo de Arribo de Peticiones - Flujo de Procesamiento Consultas Simples - Flujo de Procesamiento Transacciones BD - Flujo de Descarte por Timeout y Error,
	15)
	~	peticiones
	~	Nivel (Stock) principal que acumula las solicitudes pendientes en el buffer del servidor.
	|

Flujo de Arribo de Peticiones = Tasa Base de Demanda * Factor de Control de Admision
	~	peticiones/Hora
	~	Flujo de entrada efectiva de solicitudes al servidor.
	|

Flujo de Procesamiento Consultas Simples = Proporcion Consultas Simples * (Peticiones en Cola / Tiempo Medio de Procesamiento) * Factor de Capacidad del Servidor * Eficiencia Operativa del Servidor
	~	peticiones/Hora
	~	Flujo de salida de consultas simples resueltas (60% de la carga nominal).
	|

Flujo de Procesamiento Transacciones BD = Proporcion Transacciones BD * (Peticiones en Cola / Tiempo Medio de Procesamiento) * Factor de Capacidad del Servidor * Eficiencia Operativa del Servidor
	~	peticiones/Hora
	~	Flujo de salida de transacciones de base de datos completadas (35% de la carga nominal).
	|

Flujo de Descarte por Timeout y Error = Peticiones en Cola * (Tasa Base de Error + Coeficiente de Timeout * Indice de Saturacion del Servidor * Indice de Saturacion del Servidor)
	~	peticiones/Hora
	~	Flujo de salida de peticiones descartadas por errores de red (5% base) y vencimiento de timeout por congestion.
	|

Indice de Saturacion del Servidor = Peticiones en Cola / Capacidad Nominal del Buffer
	~	Dmnl
	~	Variable Auxiliar 1: Ratio de ocupacion de la cola respecto a la capacidad nominal del buffer.
	|

Eficiencia Operativa del Servidor = 1 / (1 + Coeficiente de Contencion * Indice de Saturacion del Servidor * Indice de Saturacion del Servidor)
	~	Dmnl
	~	Variable Auxiliar 2: Eficiencia del servidor afectada por contencion de CPU y bloqueos de BD.
	|

Latencia Promedio del Sistema = Latencia Base Ponderada * (1 + (Coeficiente de Sensibilidad Latencia * Indice de Saturacion del Servidor) / Eficiencia Operativa del Servidor)
	~	ms
	~	Variable Auxiliar 3: Tiempo medio de respuesta en milisegundos.
	|

Porcentaje de Incumplimiento SLA = MIN(100, 5 + 18 * ((Latencia Promedio del Sistema - 155) / 131.75))
	~	%
	~	Variable Auxiliar 4: Porcentaje estimado de peticiones con Alta Latencia o Error frente al limite SLA del 15%.
	|

Factor de Control de Admision = MAX(0.1, 1 - 0.15 * Indice de Saturacion del Servidor * Indice de Saturacion del Servidor)
	~	Dmnl
	~	Variable Auxiliar 5: Mecanismo de backpressure que modera el ingreso cuando el buffer se satura.
	|

Tasa Base de Demanda = 120 ~ peticiones/Hora ~ |
Capacidad Nominal del Buffer = 100 ~ peticiones ~ |
Factor de Capacidad del Servidor = 1 ~ Dmnl ~ |
Tiempo Medio de Procesamiento = 0.25 ~ Hora ~ |
Proporcion Consultas Simples = 0.6 ~ Dmnl ~ |
Proporcion Transacciones BD = 0.35 ~ Dmnl ~ |
Tasa Base de Error = 0.2 ~ 1/Hora ~ |
Coeficiente de Timeout = 0.35 ~ 1/Hora ~ |
Coeficiente de Contencion = 1.2 ~ Dmnl ~ |
Latencia Base Ponderada = 155 ~ ms ~ |
Coeficiente de Sensibilidad Latencia = 0.85 ~ Dmnl ~ |
FINAL TIME = 24 ~ Hora ~ |
INITIAL TIME = 0 ~ Hora ~ |
SAVEPER = TIME STEP ~ Hora ~ |
TIME STEP = 0.125 ~ Hora ~ |

\\\\\\---/// Sketch information - do not modify anything except names
V300  Do not put anything below this section - it will be ignored
*View 1
$192-192-192,0,Times New Roman|12||0-0-0|0-0-0|0-0-255|-1--1--1|-1--1--1|96,96,100,0
10,1,Peticiones en Cola,480,240,65,28,3,3,0,0,0,0,0,0
12,2,48,140,240,10,8,0,3,0,0,-1,0,0,0
1,3,5,1,4,0,0,22,0,0,0,-1--1--1,,1|(380,240)|
1,4,5,2,100,0,0,22,0,0,0,-1--1--1,,1|(215,240)|
11,5,48,290,240,6,8,34,3,0,0,1,0,0,0
10,6,Flujo de Arribo de Peticiones,290,266,58,19,40,3,0,0,-1,0,0,0
12,7,48,900,110,10,8,0,3,0,0,-1,0,0,0
1,8,10,1,100,0,0,22,0,0,0,-1--1--1,,1|(580,110)|
1,9,10,7,4,0,0,22,0,0,0,-1--1--1,,1|(810,110)|
11,10,48,720,110,6,8,34,3,0,0,1,0,0,0
10,11,Flujo de Procesamiento Consultas Simples,720,136,72,19,40,3,0,0,-1,0,0,0
12,12,48,900,240,10,8,0,3,0,0,-1,0,0,0
1,13,15,1,100,0,0,22,0,0,0,-1--1--1,,1|(600,240)|
1,14,15,12,4,0,0,22,0,0,0,-1--1--1,,1|(810,240)|
11,15,48,720,240,6,8,34,3,0,0,1,0,0,0
10,16,Flujo de Procesamiento Transacciones BD,720,266,72,19,40,3,0,0,-1,0,0,0
12,17,48,900,370,10,8,0,3,0,0,-1,0,0,0
1,18,20,1,100,0,0,22,0,0,0,-1--1--1,,1|(580,370)|
1,19,20,17,4,0,0,22,0,0,0,-1--1--1,,1|(810,370)|
11,20,48,720,370,6,8,34,3,0,0,1,0,0,0
10,21,Flujo de Descarte por Timeout y Error,720,396,68,19,40,3,0,0,-1,0,0,0
10,22,Indice de Saturacion del Servidor,480,420,62,19,8,3,0,0,0,0,0,0
10,23,Eficiencia Operativa del Servidor,600,310,62,19,8,3,0,0,0,0,0,0
10,24,Latencia Promedio del Sistema,640,500,60,19,8,3,0,0,0,0,0,0
10,25,Porcentaje de Incumplimiento SLA,880,500,65,19,8,3,0,0,0,0,0,0
10,26,Factor de Control de Admision,290,390,58,19,8,3,0,0,0,0,0,0
10,27,Tasa Base de Demanda,160,140,52,19,8,3,0,0,0,0,0,0
10,29,Capacidad Nominal del Buffer,340,490,58,19,8,3,0,0,0,0,0,0
10,30,Factor de Capacidad del Servidor,560,50,62,19,8,3,0,0,0,0,0,0
10,31,Tiempo Medio de Procesamiento,370,80,62,19,8,3,0,0,0,0,0,0
10,32,Proporcion Consultas Simples,880,45,58,19,8,3,0,0,0,0,0,0
10,33,Proporcion Transacciones BD,910,185,58,19,8,3,0,0,0,0,0,0
10,34,Tasa Base de Error,910,315,48,19,8,3,0,0,0,0,0,0
10,35,Coeficiente de Timeout,880,435,52,19,8,3,0,0,0,0,0,0
10,36,Coeficiente de Contencion,480,520,55,19,8,3,0,0,0,0,0,0
10,37,Latencia Base Ponderada,640,575,55,19,8,3,0,0,0,0,0,0
10,38,Coeficiente de Sensibilidad Latencia,480,575,68,19,8,3,0,0,0,0,0,0
1,40,27,6,0,0,0,0,0,64,0,-1--1--1,,1|(225,200)|
1,41,26,6,0,0,0,0,0,64,0,-1--1--1,,1|(290,330)|
1,42,32,11,0,0,0,0,0,64,0,-1--1--1,,1|(800,90)|
1,43,1,11,0,0,0,0,0,64,0,-1--1--1,,1|(600,175)|
1,44,31,11,0,0,0,0,0,64,0,-1--1--1,,1|(545,105)|
1,45,30,11,0,0,0,0,0,64,0,-1--1--1,,1|(640,90)|
1,46,23,11,0,0,0,0,0,64,0,-1--1--1,,1|(660,220)|
1,47,33,16,0,0,0,0,0,64,0,-1--1--1,,1|(815,225)|
1,48,1,16,0,0,0,0,0,64,0,-1--1--1,,1|(600,255)|
1,49,31,16,0,0,0,0,0,64,0,-1--1--1,,1|(545,170)|
1,50,30,16,0,0,0,0,0,64,0,-1--1--1,,1|(640,155)|
1,51,23,16,0,0,0,0,0,64,0,-1--1--1,,1|(660,288)|
1,52,1,21,0,0,0,0,0,64,0,-1--1--1,,1|(600,320)|
1,53,34,21,0,0,0,0,0,64,0,-1--1--1,,1|(815,355)|
1,54,35,21,0,0,0,0,0,64,0,-1--1--1,,1|(800,415)|
1,55,22,21,0,0,0,0,0,64,0,-1--1--1,,1|(600,408)|
1,56,1,22,0,0,0,0,0,64,0,-1--1--1,,1|(480,330)|
1,57,29,22,0,0,0,0,0,64,0,-1--1--1,,1|(410,455)|
1,58,36,23,0,0,0,0,0,64,0,-1--1--1,,1|(540,415)|
1,59,22,23,0,0,0,0,0,64,0,-1--1--1,,1|(540,365)|
1,60,37,24,0,0,0,0,0,64,0,-1--1--1,,1|(640,538)|
1,61,38,24,0,0,0,0,0,64,0,-1--1--1,,1|(560,538)|
1,62,22,24,0,0,0,0,0,64,0,-1--1--1,,1|(560,460)|
1,63,23,24,0,0,0,0,0,64,0,-1--1--1,,1|(620,405)|
1,64,24,25,0,0,0,0,0,64,0,-1--1--1,,1|(760,500)|
1,65,22,26,0,0,0,0,0,64,0,-1--1--1,,1|(385,405)|
///---\\\\\\
:L<%^E!@
9:Current.vdf
15:0,0,0,0,0,0
19:100,0
27:2,
34:0,
4:Time
5:Peticiones en Cola
24:0
25:24
26:24
`;

    const blob = new Blob([contenidoMdl], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_servidor_lab3.mdl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Inicialización al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("formDinamicaLab3");
    if (form) {
        form.addEventListener("submit", (e) => {
            e.preventDefault();
            simularYRenderizar();
        });
    }
    cargarEscenarioPreset(1);
});
