// Punto de entrada del servidor Express para el backend de Jira
const express = require('express'); // Importamos Express para crear el servidor
const config = require('./config/env'); // La configuración del entorno (Jira URL, email, API token)
const jiraRoutes = require('./routes/jiraRoutes');  // Importamos las rutas de Jira

// Crear una instancia de Express
const app = express();

// Middleware para parsear JSON en las solicitudes
app.use(express.json());

// Usamos las rutas de Jira para manejar las solicitudes a /api/jira
app.use((req, res, next) => {
    // Req.method = GET, POST, etc.
    // Req.url = la ruta solicitada (ej: "/api/jira/test")
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();

});

// Rutas ---- Todas estan bajo el perfil de /api/jira
app.use('/api/jira', jiraRoutes);

// Ruta raiz de bienvenida -- muestra los endpoints disponibles para facilitar la exploracion
app.get('/', (req, res) => {
    res.json({
        mensaje: 'Backend de prueba para la API de Jira Cloud',
        version: '1.0.0',
        endpoints: {
            test: 'GET /api/jira/test - Verifica la conexion con Jira',
            myself: 'GET /api/jira/myself - Para ver info del usuario autenticado',
            projects: 'GET /api/jira/projects - Ver listas de proyectos de Jira',
            issues: 'GET /api/jira/issues?jql... - Busquedas de issues con JQL',
        },
        docs: 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/',
    });
});

// Ruta 404 para endpoints no encontrados
app.use((req, res) => {
    res.status(404).json({
        error: 'Ruta no encontrada',
        message: `La ruta ${req.method} ${req.url} no existe. Visita / para ver los endpoints disponibles.`
    });
});

// Arrancar el servidor
const PORT = config.server.port;

app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('Servidor arrancado correctamente');
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Jira: ${config.jira.baseUrl}`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Endpoints disponibles:');
    console.log(`  GET http://localhost:${PORT}/api/jira/test`);
    console.log(`  GET http://localhost:${PORT}/api/jira/myself`);
    console.log(`  GET http://localhost:${PORT}/api/jira/projects`);
    console.log(`  GET http://localhost:${PORT}/api/jira/issues?jql=...`);
    console.log('');
});