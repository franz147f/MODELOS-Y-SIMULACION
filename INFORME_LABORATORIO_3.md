# LABORATORIO 3 – PROYECTO DE SIMULACIÓN (DINÁMICA DE SISTEMAS)

**Universidad Nacional de Catamarca**  
**Facultad de Tecnología y Ciencias Aplicadas – Departamento de Informática**  
**Cátedra:** Modelos y Simulación  
**Autores:**
- **Sedan Caniza, Joel Franco** (`MU: 01930`)
- **Bordon Guanco, Joel** (`MU: 2010`)

---

## a) Título

**“Simulación de Rendimiento de Servidor”**  
*(Reinterpretación bajo el enfoque de la Dinámica de Sistemas Continuos)*

---

## b) Planteamiento del Problema e Hipótesis

### 1. Redefinición Sistémica de la Problemática
En el **Laboratorio 2**, el rendimiento de un servidor fue modelado mediante eventos estocásticos discretos independientes (arribos por hora según Poisson $\lambda$, con un **60%** de *Consultas Simples*, un **35%** de *Transacciones de Base de Datos* y un **5%** de *Errores de Red*). Sin embargo, en la operación continua real de un centro de datos, las peticiones no son independientes entre sí: cuando la tasa de llegada supera transitoriamente la velocidad de atención, las solicitudes se acumulan en memoria formando un nivel (stock) de **Peticiones en Cola (Buffer del Servidor)**.

Desde la perspectiva de la **Dinámica de Sistemas**, el comportamiento del servidor está determinado por su estructura interna de niveles, flujos y bucles de retroalimentación:
1. A medida que aumenta el nivel de **Peticiones en Cola**, se incrementa el **Índice de Saturación del Servidor**.
2. La saturación eleva no linealmente la **Latencia Promedio del Sistema** y la tasa de **Descarte por Timeout**.
3. Simultáneamente, una cola congestionada genera contención de recursos (bloqueos de tablas en la Base de Datos y cambios de contexto de CPU, fenómeno conocido como *thrashing*), degradando la **Eficiencia Operativa del Servidor** y reduciendo la capacidad efectiva de los flujos de salida (*bucle reforzador de degradación*).

### 2. Hipótesis Dinámica (SLA Sistémico)
> **Hipótesis:**  
> *“Bajo un régimen de demanda nominal sostenida ($\lambda_0 \le 120\text{ peticiones/hora}$), con capacidad estándar de servidor ($K_{srv} = 1.0$) y un buffer nominal de $C_{max} = 100\text{ peticiones}$, los bucles de retroalimentación negativa (drenaje por procesamiento y control de admisión) dominarán el comportamiento del sistema, alcanzando un **equilibrio estacionario estable** en el cual el **Porcentaje de Incumplimiento de SLA (Alta Latencia y Timeouts) se mantiene por debajo del 15%** durante las 24 horas de operación. Por el contrario, ante escenarios de sobrecarga ($\lambda_0 \ge 180\text{ pet/h}$) o contención severa de Base de Datos sin escalamiento de hardware, el bucle reforzador de contención ($R_1$) dominará al sistema, provocando caída de eficiencia y superando el umbral crítico del 15%.”*

---

## c) Definición de Variables del Sistema

El modelo incorpora **1 variable de nivel (stock)**, **4 variables de flujo** (superando el mínimo exigido de 3) y **5 variables auxiliares** (superando el mínimo exigido de 2), además de sus parámetros constantes:

| Clasificación | Nombre de la Variable (Vensim) | Símbolo | Unidades | Descripción Sistémica |
| :--- | :--- | :---: | :---: | :--- |
| **Nivel (Stock)** | `Peticiones en Cola` | $Q(t)$ | `peticiones` | Cantidad acumulada de solicitudes alojadas en el buffer del servidor pendientes de resolución en el instante $t$. |
| **Flujo (Entrada)** | `Flujo de Arribo de Peticiones` | $F_{arribo}(t)$ | `peticiones/Hora` | Tasa de entrada efectiva de nuevas solicitudes al buffer del servidor. |
| **Flujo (Salida 1)** | `Flujo de Procesamiento Consultas Simples` | $F_{simples}(t)$ | `peticiones/Hora` | Tasa de resolución de consultas rápidas (60% de la carga nominal). |
| **Flujo (Salida 2)** | `Flujo de Procesamiento Transacciones BD` | $F_{bd}(t)$ | `peticiones/Hora` | Tasa de resolución de transacciones sobre la Base de Datos (35% de la carga nominal). |
| **Flujo (Salida 3)** | `Flujo de Descarte por Timeout y Error` | $F_{descarte}(t)$ | `peticiones/Hora` | Tasa de solicitudes descartadas por errores de red (5% base) y por vencimiento de tiempo de espera (*timeout*). |
| **Auxiliar 1** | `Indice de Saturacion del Servidor` | $S(t)$ | `Dmnl` | Razón entre las peticiones actuales en cola y la capacidad nominal del buffer ($Q(t)/C_{max}$). |
| **Auxiliar 2** | `Eficiencia Operativa del Servidor` | $E(t)$ | `Dmnl` | Factor de rendimiento $[0, 1]$ que disminuye cuando aumenta la contención de CPU y bloqueos de BD. |
| **Auxiliar 3** | `Latencia Promedio del Sistema` | $L(t)$ | `ms` | Tiempo medio de respuesta en milisegundos en función de la saturación y la eficiencia. |
| **Auxiliar 4** | `Porcentaje de Incumplimiento SLA` | $I_{SLA}(t)$ | `%` | Porcentaje estimado de peticiones que sufren alta latencia o descarte frente al límite del 15%. |
| **Auxiliar 5** | `Factor de Control de Admision` | $B(t)$ | `Dmnl` | Regulador de *backpressure* que reduce la admisión cuando la cola se aproxima a la saturación. |
| **Parámetros** | `Tasa Base de Demanda` ($\lambda_0 = 120$), `Capacidad Nominal del Buffer` ($C_{max} = 100$), `Factor de Capacidad del Servidor` ($K_{srv} = 1.0$), `Tiempo Medio de Procesamiento` ($\tau_{proc} = 0.25\text{ h}$), `Coeficiente de Contencion` ($\alpha_{cont} = 1.2$), `Latencia Base Ponderada` ($L_{base} = 155\text{ ms}$), `Umbral Maximo SLA` ($15\%$). | — | Varias | Constantes estructurales y de experimentación del modelo. |

---

## d) Diagrama Causal y Bucles de Retroalimentación

El sistema está regido por **cuatro bucles de retroalimentación** (tres negativos/compensadores y uno positivo/reforzador):

1. **Bucle Compensador $B_1$ (Negativo – Drenaje por Procesamiento Normal):**
   - `Peticiones en Cola` $\xrightarrow{+}$ `Flujos de Procesamiento (Consultas Simples y Transacciones BD)` $\xrightarrow{-}$ `Peticiones en Cola`.
   - *Comportamiento:* A mayor cantidad de peticiones acumuladas, mayor es la tasa de salida procesada por el servidor, estabilizando la cola.
2. **Bucle Compensador $B_2$ (Negativo – Control de Admisión / Backpressure):**
   - `Peticiones en Cola` $\xrightarrow{+}$ `Índice de Saturación` $\xrightarrow{-}$ `Factor de Control de Admisión` $\xrightarrow{+}$ `Flujo de Arribo de Peticiones` $\xrightarrow{+}$ `Peticiones en Cola`.
   - *Comportamiento:* Limita la entrada de nuevas solicitudes cuando el buffer se acerca a su capacidad máxima.
3. **Bucle Compensador $B_3$ (Negativo – Purga por Timeout):**
   - `Peticiones en Cola` $\xrightarrow{+}$ `Índice de Saturación` $\xrightarrow{+}$ `Flujo de Descarte por Timeout y Error` $\xrightarrow{-}$ `Peticiones en Cola`.
   - *Comportamiento:* Alivia forzadamente la cola descartando peticiones vencidas cuando la congestión es elevada, aunque deteriora el SLA.
4. **Bucle Reforzador $R_1$ (Positivo – Contención de Recursos / Thrashing en BD):**
   - `Peticiones en Cola` $\xrightarrow{+}$ `Índice de Saturación` $\xrightarrow{-}$ `Eficiencia Operativa del Servidor` $\xrightarrow{+}$ `Flujos de Procesamiento (Simples y BD)` $\xrightarrow{-}$ `Peticiones en Cola`.
   - *Comportamiento:* Contiene dos relaciones negativas cuyo producto es positivo (`+`). Cuando la cola supera un umbral crítico, los bloqueos en la Base de Datos reducen la eficiencia del servidor, lo que disminuye la velocidad de salida y provoca una acumulación aún mayor en la cola.

---

## e) Diagrama de Forrester (Vensim)

- La representación gráfica interactiva del **Diagrama de Forrester** bajo la convención de **Vensim PLE** se encuentra implementada en [`laboratorio3.html`](laboratorio3.html).
- El archivo fuente nativo para abrir directamente en **Vensim PLE** se encuentra en [`vensim/modelo_servidor_lab3.mdl`](vensim/modelo_servidor_lab3.mdl).

---

## f) Formulación de Ecuaciones

### 1. Ecuación Diferencial e Integral del Nivel (Stock)
$$\frac{dQ(t)}{dt} = F_{arribo}(t) - F_{simples}(t) - F_{bd}(t) - F_{descarte}(t)$$

$$Q(t + \Delta t) = Q(t) + \left[ F_{arribo}(t) - F_{simples}(t) - F_{bd}(t) - F_{descarte}(t) \right] \cdot \Delta t, \quad Q(0) = Q_0$$

### 2. Ecuaciones de las Variables de Flujo
- **Flujo de Arribo:** $F_{arribo}(t) = \lambda_0 \cdot M(t) \cdot B(t)$
- **Flujo Consultas Simples (60%):** $F_{simples}(t) = 0.60 \cdot \left(\frac{Q(t)}{\tau_{proc}}\right) \cdot K_{srv} \cdot E(t)$
- **Flujo Transacciones BD (35%):** $F_{bd}(t) = 0.35 \cdot \left(\frac{Q(t)}{\tau_{proc}}\right) \cdot K_{srv} \cdot E(t)$
- **Flujo Descarte por Timeout y Error:** $F_{descarte}(t) = Q(t) \cdot \left(\tau_{error} + c_{timeout} \cdot S(t)^2\right)$

### 3. Ecuaciones de las Variables Auxiliares
- **Índice de Saturación:** $S(t) = \frac{Q(t)}{C_{max}}$
- **Eficiencia Operativa:** $E(t) = \frac{1}{1 + \alpha_{cont} \cdot S(t)^2}$
- **Latencia Promedio:** $L(t) = L_{base} \cdot \left(1 + \frac{0.85 \cdot S(t)}{E(t)}\right)$
- **Porcentaje de Incumplimiento SLA:** $I_{SLA}(t) = \min\left(100,\; 100 \cdot \left(0.05 + 0.18 \cdot \frac{S(t)}{E(t)}\right)\right)$
- **Factor de Control de Admisión:** $B(t) = \max\left(0.10,\; 1 - 0.15 \cdot S(t)^2\right)$

---

## g) Experimentación y h) Análisis de Resultados y Conclusiones

Se ejecutaron **4 corridas experimentales** durante un horizonte continuo de $T = 24\text{ horas}$ ($\Delta t = 0.25\text{ h}$):

| Escenario Experimental | Demanda ($\lambda_0$) | Parámetros Modificados | Cola Equilibrio $Q(24)$ | Eficiencia $E(24)$ | Latencia $L(24)$ | Incumplimiento SLA | Veredicto Hipótesis |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Escenario 1: Nominal (Caso Base)** | $120\text{ pet/h}$ | $K_{srv}=1.0,\; C_{max}=100,\; \alpha=1.2$ | $32.5\text{ pet}$ ($32.5\%$) | $88.7\%$ | $203.3\text{ ms}$ | **11.59%** | **VALIDADA ($\le 15\%$)** |
| **Escenario 2: Pico de Sobrecarga** | $210\text{ pet/h}$ | $K_{srv}=1.0,\; C_{max}=100,\; \alpha=1.2$ | $75.8\text{ pet}$ ($75.8\%$) | $59.2\%$ | $323.7\text{ ms}$ | **28.05%** | **REFUTADA ($> 15\%$)** |
| **Escenario 3: Escalamiento de Recursos** | $210\text{ pet/h}$ | $K_{srv}=1.75,\; C_{max}=150,\; \alpha=1.2$ | $31.8\text{ pet}$ ($21.2\%$) | $94.9\%$ | $184.4\text{ ms}$ | **9.02%** | **VALIDADA ($\le 15\%$)** |
| **Escenario 4: Contención Crítica en BD** | $140\text{ pet/h}$ | $K_{srv}=0.80,\; C_{max}=90,\; \alpha=2.4$ | $57.2\text{ pet}$ ($63.5\%$) | $50.8\%$ | $319.8\text{ ms}$ | **27.52%** | **REFUTADA ($> 15\%$)** |

### Conclusiones Principales
1. **Equilibrio Dinámico bajo Carga Nominal (Escenario 1):** El servidor alcanza el estado estacionario alrededor de la hora $t = 2.5\text{ h}$ con una cola estable de $32.5\text{ peticiones}$, una latencia de $203.3\text{ ms}$ y un porcentaje de incumplimiento SLA del **11.59%**, validando la hipótesis de aptitud bajo condiciones nominales.
2. **Dominancia del Bucle Reforzador $R_1$ en Sobrecarga (Escenarios 2 y 4):** Ante un incremento de demanda a $210\text{ pet/h}$ o bloqueos severos en la Base de Datos ($\alpha_{cont} = 2.4$), la caída de la eficiencia operativa por debajo del $60\%$ frena los flujos de salida y duplica el incumplimiento de SLA ($\sim 28\%$), demostrando que la degradación en sistemas reales no es lineal sino retroalimentada.
3. **Política de Mitigación Estructural (Escenario 3):** El escalamiento conjunto de la capacidad de procesamiento ($K_{srv} = 1.75$) y del buffer ($C_{max} = 150$) neutraliza el bucle reforzador $R_1$, permitiendo absorber $210\text{ pet/h}$ con apenas **9.02%** de incumplimiento SLA.
