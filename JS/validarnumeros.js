function calcularMCD(a, b) {
    while (b !== 0) {
        let temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}
function validador() {
    const x0 = parseInt(document.getElementById("semilla").value, 10);
    const a = parseInt(document.getElementById("multiplicador").value, 10);
    const m = parseInt(document.getElementById("modulo").value, 10);
    const n = parseInt(document.getElementById("cantidad").value, 10);
    
    if (isNaN(x0) || isNaN(a) || isNaN(m) || isNaN(n)) {
        alert("Todos los campos son obligatorios y deben ser números enteros.");
        return false;
    }
    
    if (x0 <= 0 || a <= 0 || m <= 0 || n <= 0) {
        alert("Todos los valores (X0, a, m, n) deben ser enteros mayores a 0.");
        return false;
    }
    
    if (x0 >= m) {
        alert("La semilla (X0) debe ser menor que el módulo (m).");
        return false;
    }
    if (a >= m) {
        alert("El multiplicador (a) debe ser menor que el módulo (m).");
        return false;
    }
    
    if (calcularMCD(x0, m) !== 1) {
        alert("La semilla (X0) y el módulo (m) deben ser primos relativos (MCD = 1).");
        return false;
    }
    // 5. Validación adicional para período máximo en base binaria (m potencia de 2)
    const esPotenciaDe2 = (m & (m - 1)) === 0 && m > 0;
    if (esPotenciaDe2) {
        if (x0 % 2 === 0) {
            alert("Para módulo m = 2^g, la semilla (X0) debe ser impar.");
            return false;
        }
        if ((a - 3) % 8 !== 0 && (a - 5) % 8 !== 0) {
            alert("Para período máximo en base binaria, el multiplicador 'a' debe cumplir: a = 3 + 8k ó a = 5 + 8k.");
            return false;
        }
    }
    return true; // Si pasa todas las validaciones, envía el formulario
}