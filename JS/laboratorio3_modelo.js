(function (raiz) {
    "use strict";

    const PARAMETROS = Object.freeze({
        horas: 48,
        paso: 0.05,
        demandaBase: 30,
        capacidadInicial: 36,
        factorPico: 2.2,
        inicioPico: 12,
        finPico: 30,
        horizonteCola: 4,
        tiempoAbandono: 4,
        degradacion: 0.08,
        tasaObsolescencia: 0.002,
        gananciaInversion: 10,
        maxAmpliacion: 8,
        slaMaximo: 15
    });

    // Euler explícito: dos stocks (cola y capacidad) y cinco flujos.
    function simular(opciones, escenario) {
        const p = Object.assign({}, PARAMETROS, opciones || {});
        const tipo = escenario || "base";
        const pico = tipo !== "base";
        const ampliar = tipo === "ampliacion";
        const numeros = ["horas", "paso", "demandaBase", "capacidadInicial",
            "factorPico", "inicioPico", "finPico", "horizonteCola",
            "tiempoAbandono", "degradacion", "tasaObsolescencia",
            "gananciaInversion", "maxAmpliacion", "slaMaximo"];
        if (numeros.some(function (k) { return !Number.isFinite(p[k]); }) ||
            p.horas <= 0 || p.paso <= 0 || p.demandaBase < 0 ||
            p.capacidadInicial <= 0 || p.factorPico < 1 ||
            p.inicioPico < 0 || p.finPico > p.horas ||
            p.inicioPico >= p.finPico || p.horizonteCola <= 0 ||
            p.tiempoAbandono <= 0 || p.degradacion < 0 ||
            p.tasaObsolescencia < 0 || p.gananciaInversion < 0 ||
            p.maxAmpliacion < 0 || p.slaMaximo < 0 || p.slaMaximo > 100 ||
            p.paso > p.tiempoAbandono) {
            throw new Error("Parámetros no válidos. Revisá los rangos y el paso de integración.");
        }

        const pasos = Math.ceil(p.horas / p.paso);
        let cola = 0;
        let capacidad = p.capacidadInicial;
        let recibidas = 0;
        let atendidas = 0;
        let abandonadas = 0;
        let colaMaxima = 0;
        const serie = [{ tiempo: 0, cola: cola, capacidad: capacidad,
            recibidas: 0, atendidas: 0, abandonadas: 0,
            abandonoPorcentaje: 0, esperaMinutos: 0 }];

        for (let i = 0; i < pasos; i++) {
            const tiempo = i * p.paso;
            const dt = Math.min(p.paso, p.horas - tiempo);
            if (dt <= 0) break;
            const multiplicador = pico && tiempo >= p.inicioPico && tiempo < p.finPico
                ? p.factorPico : 1;
            const arribos = p.demandaBase * multiplicador;
            // Presión: demanda actual / capacidad + acumulación en cola / capacidad y horizonte.
            const presion = arribos / Math.max(1, capacidad) +
                cola / (Math.max(1, capacidad) * p.horizonteCola);
            const eficiencia = 1 / (1 + p.degradacion * Math.max(0, presion - 1));
            const capacidadEfectiva = capacidad * eficiencia;

            // Restricciones de disponibilidad impiden servir más que cola + arribos.
            const maxDisponible = arribos + cola / dt;
            const flujoAtenciones = Math.min(capacidadEfectiva, maxDisponible);
            const flujoAbandonos = Math.min(cola / p.tiempoAbandono,
                Math.max(0, maxDisponible - flujoAtenciones));
            const flujoAmpliacion = ampliar
                ? Math.min(p.maxAmpliacion, p.gananciaInversion * Math.max(0, presion - 1))
                : 0;
            const flujoObsolescencia = capacidad * p.tasaObsolescencia;

            cola = Math.max(0, cola + (arribos - flujoAtenciones - flujoAbandonos) * dt);
            capacidad = Math.max(1, capacidad +
                (flujoAmpliacion - flujoObsolescencia) * dt);
            recibidas += arribos * dt;
            atendidas += flujoAtenciones * dt;
            abandonadas += flujoAbandonos * dt;
            colaMaxima = Math.max(colaMaxima, cola);

            serie.push({
                tiempo: Math.min(p.horas, tiempo + dt),
                cola: cola,
                capacidad: capacidad,
                recibidas: recibidas,
                atendidas: atendidas,
                abandonadas: abandonadas,
                abandonoPorcentaje: recibidas > 0 ? 100 * abandonadas / recibidas : 0,
                esperaMinutos: capacidad > 0 ? 60 * cola / capacidad : 0
            });
        }

        const porcentaje = recibidas > 0 ? 100 * abandonadas / recibidas : 0;
        return {
            nombre: tipo === "base" ? "Demanda base" :
                tipo === "pico" ? "Pico sin ampliación" : "Pico con ampliación",
            tipo: tipo,
            parametros: p,
            serie: serie,
            resumen: {
                recibidas: recibidas,
                atendidas: atendidas,
                abandonadas: abandonadas,
                pendientes: cola,
                colaMaxima: colaMaxima,
                capacidadFinal: capacidad,
                porcentajeAbandono: porcentaje,
                cumpleSla: porcentaje <= p.slaMaximo,
                balance: recibidas - atendidas - abandonadas - cola
            }
        };
    }

    const api = { PARAMETROS: PARAMETROS, simular: simular };
    raiz.Lab3Modelo = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
