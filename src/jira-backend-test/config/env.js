// configuración de entorno para la aplicación de prueba de conexión con Jira Cloud API
const dotenv = require('dotenv');

dotenv.config();

// Validar que las variables de entorno necesarias estén presentes
const requiredVars = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];

// Verificar que todas las variables requeridas estén definidas
requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
        console.error(`Error: Missing required environment variable ${varName}`);
        process.exit(1);
    }
});

// Exportar la configuración para su uso en otras partes de la aplicación
const config = {
    // Configuración de Jira Cloud API
    jira: {
        baseUrl: process.env.JIRA_BASE_URL,
        email: process.env.JIRA_EMAIL,
        apiToken: process.env.JIRA_API_TOKEN
    },
    // Configuración del servidor
    server: {
        port: process.env.PORT || 3000,
    },
};

// Puedes agregar más configuraciones aquí si es necesario
module.exports = config;