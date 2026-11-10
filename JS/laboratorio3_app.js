(function () {
    "use strict";
    const colores = {
        base: "#38bdf8",
        pico: "#fb923c",
        ampliacion: "#34d399"
    };
    const escenarios = ["base", "pico", "ampliacion"];
    const graficos = [];

    const $ = function (id) { return document.getElementById(id); };
    const fmt = function (n, dec) {
        return Number(n).toLocaleString("es-AR", {
            maximumFractionDigits: dec === undefined ? 1 : dec,
            minimumFractionDigits: dec === undefined ? 1 : dec
        });
    };

    function leerParametros() {
        const p = {};
        const campos = ["horas", "demandaBase", "capacidadInicial", "factorPico",
            "inicioPico", "finPico", "tiempoAbandono", "gananciaInversion",
            "maxAmpliacion", "slaMaximo"];
        campos.forEach(function (campo) {
            p[campo] = Number($(campo).value);
        });
        return p;
    }

    function crearGrafico(id, resultados, clave, tituloEje) {
        const etiquetas = resultados[0].serie.map(function (p) {
            return p.tiempo;
        });
        const chart = new Chart($(id), {
            type: "line",
            data: {
                labels: etiquetas,
                datasets: resultados.map(function (r) {
                    return {
                        label: r.nombre,
                        data: r.serie.map(function (dato) { return dato[clave]; }),
                        borderColor: colores[r.tipo],
                        backgroundColor: colores[r.tipo],
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.08,
                        fill: false
                    };
                })
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: "index", intersect: false },
                plugins: { legend: { labels: { color: "#dceaf7" } } },
                scales: {
                    x: {
                        ticks: { color: "#b5c9de", maxTicksLimit: 10,
                            callback: function (v) { return fmt(etiquetas[v], 0); } },
                        grid: { color: "rgba(255,255,255,.07)" },
                        title: { display: true, text: "Tiempo (horas)", color: "#b5c9de" }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: "#b5c9de" },
                        grid: { color: "rgba(255,255,255,.07)" },
                        title: { display: true, text: tituloEje, color: "#b5c9de" }
                    }
                }
            }
        });
        graficos.push(chart);
    }

    function ejecutar(e) {
        if (e) e.preventDefault();
        try {
            const opciones = leerParametros();
            const resultados = escenarios.map(function (escenario) {
                return Lab3Modelo.simular(opciones, escenario);
            });
            const base = resultados[0].resumen;
            const pico = resultados[1].resumen;
            const mejora = resultados[2].resumen;
            $("kpiPico").textContent = fmt(pico.colaMaxima) + " solicitudes";
            $("kpiPerdidas").textContent = fmt(pico.porcentajeAbandono, 2) + "%";
            $("kpiMejora").textContent = fmt(mejora.porcentajeAbandono, 2) + "%";
            $("kpiSla").textContent = fmt(opciones.slaMaximo, 1) + "%";
            $("tablaExperimentos").innerHTML = resultados.map(function (r) {
                const d = r.resumen;
                return '<tr><td><span class="punto" style="background:' + colores[r.tipo] +
                    '"></span>' + r.nombre + '</td>' +
                    '<td>' + fmt(d.recibidas, 0) + '</td>' +
                    '<td>' + fmt(d.atendidas, 0) + '</td>' +
                    '<td>' + fmt(d.abandonadas, 0) + '</td>' +
                    '<td>' + fmt(d.colaMaxima) + '</td>' +
                    '<td>' + fmt(d.capacidadFinal) + '</td>' +
                    '<td><strong>' + fmt(d.porcentajeAbandono, 2) +
                    '%</strong></td><td><span class="estado ' +
                    (d.cumpleSla ? 'bien' : 'mal') + '">' +
                    (d.cumpleSla ? 'Cumple' : 'No cumple') +
                    '</span></td></tr>';
            }).join("");
            const diferencia = pico.porcentajeAbandono - mejora.porcentajeAbandono;
            $("conclusion").textContent = "En el escenario de pico, la ampliación " +
                (diferencia >= 0 ? "reduce" : "no reduce") +
                " el abandono acumulado en " + fmt(Math.abs(diferencia), 2) +
                " puntos porcentuales respecto del pico sin ampliación. " +
                "Con el SLA propuesto de " + fmt(opciones.slaMaximo, 1) +
                "%, el escenario con ampliación " +
                (mejora.cumpleSla ? "cumple" : "no cumple") + " el objetivo. " +
                "El escenario base registra " + fmt(base.porcentajeAbandono, 2) +
                "% de abandonos. Son resultados de un modelo hipotético, no mediciones reales.";
            graficos.splice(0).forEach(function (g) { g.destroy(); });
            crearGrafico("grafCola", resultados, "cola", "Solicitudes pendientes");
            crearGrafico("grafCapacidad", resultados, "capacidad", "Solicitudes por hora");
            crearGrafico("grafPerdidas", resultados, "abandonoPorcentaje", "Abandono acumulado (%)");
            $("errorModelo").hidden = true;
            $("resultados").hidden = false;
        } catch (err) {
            $("errorModelo").textContent = err.message;
            $("errorModelo").hidden = false;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        $("formModelo").addEventListener("submit", ejecutar);
        ejecutar();
    });
})();
