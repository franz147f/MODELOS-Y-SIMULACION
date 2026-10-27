// Variables globales para el Generador Congruencial Multiplicativo (Laboratorio 1)
let xActual = 7;
let aGlobal = 16807;
let mGlobal = 2147483647;
let graficoInstancia = null;

// 1. MOTOR GENERADOR PSEUDOALEATORIO (Reutilizado del Laboratorio 1)

function obtenerSiguienteU() {
    const producto = aGlobal * xActual;
    const xSiguiente = producto % mGlobal;
    const u_n = xSiguiente / mGlobal;
    xActual = xSiguiente;
    return u_n;
}

// 2. SUBRUTINAS DE DISTRIBUCIONES TEÓRICAS DE PROBABILIDAD (Unidad 3)


// A. Distribución de Poisson (Eventos por hora)
function procPoisson(lambda) {
    const b = Math.exp(-lambda);
    let x = 0;
    let p = 1.0;

    while (p > b) {
        const u = obtenerSiguienteU();
        p = p * u;
        x = x + 1;
    }
    return x - 1;
}

// B. Distribución Uniforme Continua (Transformación Inversa)
function procUniforme(a, b) {
    const u = obtenerSiguienteU();
    return a + (b - a) * u;
}

// C. Distribución Normal (Teorema del Límite Central - 12 uniformes)
function procNormal(media, desvio) {
    let sum = 0.0;
    for (let i = 1; i <= 12; i++) {
        sum += obtenerSiguienteU();
    }
    return desvio * (sum - 6.0) + media;
}

// =========================================================================
// 3. LÓGICA PRINCIPAL DEL SIMULADOR
// =========================================================================
document.getElementById("formSimulacion").addEventListener("submit", function (e) {
    e.preventDefault();

    // 1. Capturar parámetros ingresados por el usuario
    xActual = parseInt(document.getElementById("semilla").value, 10);
    aGlobal = parseInt(document.getElementById("multiplicador").value, 10);
    mGlobal = parseInt(document.getElementById("modulo").value, 10);

    const horasSimular = parseInt(document.getElementById("horas").value, 10);
    const lambdaPeticiones = parseFloat(document.getElementById("lambda").value);
    const umbralSla = parseFloat(document.getElementById("umbralSla").value);

    const unifA = parseFloat(document.getElementById("unifA").value);
    const unifB = parseFloat(document.getElementById("unifB").value);
    const limiteSimple = parseFloat(document.getElementById("limiteSimple").value);

    const normMedia = parseFloat(document.getElementById("normMedia").value);
    const normDesvio = parseFloat(document.getElementById("normDesvio").value);
    const limiteBd = parseFloat(document.getElementById("limiteBd").value);

    if (unifA >= unifB) {
        alert("En la distribución Uniforme, el límite mínimo (a) debe ser menor que el máximo (b).");
        return;
    }

    // 2. Inicializar contadores de estado
    let totalSimple = 0, lentaSimple = 0;
    let totalBd = 0, lentaBd = 0;
    let totalError = 0;
    let contadorGlobal = 0;

    const tbodySimulacion = document.getElementById("cuerpoTablaSimulacion");
    const tbodyPorHora = document.getElementById("tablaPorHora");
    tbodySimulacion.innerHTML = "";
    tbodyPorHora.innerHTML = "";

    // 3. BUCLE EXTERNO: Horas de simulación
    for (let hora = 1; hora <= horasSimular; hora++) {
        const arribosHoy = procPoisson(lambdaPeticiones);
        let simplesHora = 0, bdHora = 0, errorHora = 0;

        // 4. BUCLE INTERNO: Peticiones de la hora actual
        for (let i = 1; i <= arribosHoy; i++) {
            contadorGlobal++;
            const uClasificacion = obtenerSiguienteU();

            let tipoTexto = "";
            let tiempoTexto = "";
            let calidadBadge = "";

            if (uClasificacion < 0.05) {
                totalError++;
                errorHora++;
                tipoTexto = `<span class="badge bg-danger">Error de Red</span>`;
                tiempoTexto = `-`;
                calidadBadge = `<span class="text-secondary">Descartada</span>`;

            } else if (uClasificacion < 0.65) {
                totalSimple++;
                simplesHora++;
                const duracion = procUniforme(unifA, unifB);
                tiempoTexto = `${duracion.toFixed(2)} ms`;
                tipoTexto = `<span class="badge bg-info text-dark">Consulta Simple</span>`;

                if (duracion > limiteSimple) {
                    lentaSimple++;
                    calidadBadge = `<span class="badge bg-warning text-dark">Alta Latencia (> ${limiteSimple}ms)</span>`;
                } else {
                    calidadBadge = `<span class="badge bg-success">Rendimiento Normal</span>`;
                }

            } else {
                totalBd++;
                bdHora++;
                const duracion = Math.max(1, procNormal(normMedia, normDesvio));
                tiempoTexto = `${duracion.toFixed(2)} ms`;
                tipoTexto = `<span class="badge bg-warning text-dark">Transacción BD</span>`;

                if (duracion > limiteBd) {
                    lentaBd++;
                    calidadBadge = `<span class="badge bg-danger">Alta Latencia (> ${limiteBd}ms)</span>`;
                } else {
                    calidadBadge = `<span class="badge bg-success">Rendimiento Normal</span>`;
                }
            }

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><strong>${contadorGlobal}</strong></td>
                <td>Hora ${hora}</td>
                <td><code>${uClasificacion.toFixed(5)}</code></td>
                <td>${tipoTexto}</td>
                <td>${tiempoTexto}</td>
                <td>${calidadBadge}</td>
            `;
            tbodySimulacion.appendChild(tr);
        }

        const trHora = document.createElement("tr");
        trHora.innerHTML = `
            <td><strong>Hora ${hora}</strong></td>
            <td><span class="badge bg-primary">${arribosHoy}</span></td>
            <td>${simplesHora}</td>
            <td>${bdHora}</td>
            <td>${errorHora}</td>
        `;
        tbodyPorHora.appendChild(trHora);
    }

    // 5. CÁLCULO DE PORCENTAJES FINALES Y EVALUACIÓN DE LA HIPÓTESIS
    const porcLentaSimple = totalSimple > 0 ? (lentaSimple / totalSimple) * 100 : 0;
    const porcLentaBd = totalBd > 0 ? (lentaBd / totalBd) * 100 : 0;
    const porcError = contadorGlobal > 0 ? (totalError / contadorGlobal) * 100 : 0;

    // Mostrar resultados quitando la clase CSS .oculto
    document.getElementById("seccionResultados").classList.remove("oculto");
    document.getElementById("resTotalPeticiones").textContent = contadorGlobal;
    document.getElementById("resDetalleHoras").textContent = `En ${horasSimular} horas simuladas`;

    document.getElementById("resTotalSimple").textContent = `${totalSimple} (${lentaSimple} lentas)`;
    document.getElementById("resPorcSimple").textContent = `${porcLentaSimple.toFixed(2)}% Alta Latencia`;

    document.getElementById("resTotalBd").textContent = `${totalBd} (${lentaBd} lentas)`;
    document.getElementById("resPorcBd").textContent = `${porcLentaBd.toFixed(2)}% Alta Latencia`;

    document.getElementById("resTotalError").textContent = totalError;
    document.getElementById("resPorcError").textContent = `${porcError.toFixed(2)}% del total`;

    const alertaDiv = document.getElementById("alertaHipotesis");
    if (porcLentaSimple <= umbralSla && porcLentaBd <= umbralSla) {
        alertaDiv.className = "alert alert-success border-success mb-4 shadow-sm";
        alertaDiv.innerHTML = `
            <h5 class="alert-heading fw-bold mb-1">✅ HIPÓTESIS ACEPTADA (El servidor cumple el SLA)</h5>
            <p class="mb-0 fs-6 fw-normal text-dark">
                Tanto las Consultas Simples (<strong>${porcLentaSimple.toFixed(2)}%</strong>) como las Transacciones BD (<strong>${porcLentaBd.toFixed(2)}%</strong>) 
                mantuvieron su porcentaje de alta latencia por debajo del límite máximo tolerado del <strong>${umbralSla}%</strong>. 
                <strong>Decisión:</strong> No se requiere inversión adicional en hardware.
            </p>
        `;
    } else {
        alertaDiv.className = "alert alert-danger border-danger mb-4 shadow-sm";
        alertaDiv.innerHTML = `
            <h5 class="alert-heading fw-bold mb-1">❌ HIPÓTESIS RECHAZADA (Se supera el límite del ${umbralSla}%)</h5>
            <p class="mb-0 fs-6 fw-normal text-dark">
                Se registraron niveles de Alta Latencia de <strong>${porcLentaSimple.toFixed(2)}%</strong> en Consultas Simples y 
                <strong>${porcLentaBd.toFixed(2)}%</strong> en Transacciones BD. Al superar el umbral del <strong>${umbralSla}%</strong>, 
                <strong>Decisión:</strong> Se recomienda escalar los recursos del servidor (ampliar CPU/RAM o implementar balanceo de carga).
            </p>
        `;
    }

    renderizarGraficoComparativo(porcLentaSimple, porcLentaBd, umbralSla);
});

function renderizarGraficoComparativo(porcSimple, porcBd, umbral) {
    const ctx = document.getElementById("graficoComparativo").getContext("2d");
    if (graficoInstancia) {
        graficoInstancia.destroy();
    }

    graficoInstancia = new Chart(ctx, {
        type: "bar",
        data: {
            labels: ["Consultas Simples (%)", "Transacciones BD (%)", "Límite Máx. Hipótesis (%)"],
            datasets: [{
                label: "Porcentaje de Bajo Rendimiento (%)",
                data: [porcSimple.toFixed(2), porcBd.toFixed(2), umbral],
                backgroundColor: ["#00b4d8", "#ffb703", "#e63946"]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: "#e0e0e0" } }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: "#e0e0e0" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                },
                x: {
                    ticks: { color: "#e0e0e0" },
                    grid: { color: "rgba(255,255,255,0.1)" }
                }
            }
        }
    });
}