// test-diagnostic.js - Uso: node test-diagnostic.js [puerto]

async function testEndpoint(port = 3000) {
    const url = `http://localhost:${port}/hello`;
    
    try {
        console.log(`🔍 Probando conexión a ${url}...`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: 'Tester' })
        });
        
        console.log('📊 Status:', response.status, response.statusText);
        console.log('📝 Headers:', Object.fromEntries(response.headers.entries()));
        
        // Intentar leer como texto primero
        const text = await response.text();
        console.log('📄 Respuesta (texto):', text);
        
        // Luego intentar como JSON si parece JSON
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
            try {
                const json = JSON.parse(text);
                console.log('✅ JSON parseado:', json);
            } catch (jsonError) {
                console.log('⚠️ No es JSON válido');
            }
        }
        
    } catch (error) {
        console.error('❌ Error de conexión:', error.message);
        console.log('\nPosibles soluciones:');
        console.log(`1. El servidor no está corriendo en puerto ${port}`);
        console.log('2. La ruta /hello no existe (404)');
        console.log('3. El servidor está en otro puerto - prueba:');
        console.log('   node test-diagnostic.js 8080');
        console.log('   node test-diagnostic.js 3001');
        console.log('4. El servidor necesita otra configuración');
    }
}

// Obtener puerto de los argumentos
function getPortFromArgs() {
    const args = process.argv.slice(2);
    
    // Buscar argumento --port o -p
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--port' || args[i] === '-p') {
            return parseInt(args[i + 1], 10);
        }
        // Si el argumento es solo un número
        if (/^\d+$/.test(args[i])) {
            return parseInt(args[i], 10);
        }
    }
    
    return 3000; // Puerto por defecto
}

// Función principal con opciones de ayuda
function main() {
    const args = process.argv.slice(2);
    
    // Mostrar ayuda si se solicita
    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Uso: node test-diagnostic.js [opciones] [puerto]

Opciones:
  -p, --port <puerto>  Especificar puerto (default: 3000)
  -h, --help           Mostrar esta ayuda
  <puerto>             Número de puerto directamente

Ejemplos:
  node test-diagnostic.js           # Prueba puerto 3000
  node test-diagnostic.js 8080      # Prueba puerto 8080
  node test-diagnostic.js -p 3001   # Prueba puerto 3001
  node test-diagnostic.js --port 5000
        `);
        return;
    }
    
    const port = getPortFromArgs();
    
    // Validar puerto
    if (isNaN(port) || port < 1 || port > 65535) {
        console.error('❌ Error: Puerto inválido. Debe ser un número entre 1 y 65535');
        process.exit(1);
    }
    
    console.log(`🚀 Iniciando prueba en puerto ${port}...\n`);
    testEndpoint(port);
}

// Ejecutar
main();