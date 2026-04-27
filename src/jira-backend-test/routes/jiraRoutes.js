// Ruta para hablar con la API de Jira Cloud
const express = require('express');
const jiraService = require('../services/jiraService');

// express.Router() nos permite crear rutas modulares y montables
// luego en el server.js importaremos este router y lo montaremos en una ruta base como /api/jira
// escribimos '/test' pero la url final será '/api/jira/test' por ejemplo
const router = express.Router();

// Manejo de errores
function handleJiraError(res, error) {

    // CASO 1: Error de conexión (no se pudo conectar a Jira)
    // Axios pone la respuesta en error.response si el servidor respondió con un error (4xx o 5xx)
    if (error.response) {
        const status = error.response.status;
        // Jira incluye mensajes de error en el cuerpo de la respuesta
        const jiraErrors = error.response.data?.errorMessages || [];
        const jiraMessage = error.response.data?.messages || '';

        console.log(`Error de Jira (HTTP ${status}):`, jiraErrors, jiraMessage);

        // Switch que evalua el código de estado HTTP para dar una respuesta más específica
        switch (status) {
            case 400:
                // 401 Unauthorized: credenciales incorrectas o token inválido
                return res.status(400).json({
                    error: 'No autorizado',
                    message: 'Solicitud inválida. Verifica tu consulta o datos enviados.',
                    details: jiraErrors,
                });
            case 401:
                return res.status(401).json({
                    error: 'No autorizado',
                    message: 'No autorizado. Verifica tus credenciales o token de API.',
                    details: jiraErrors,
                });
            case 403:
                return res.status(403).json({
                    error: 'Prohibido',
                    message: 'Acceso prohibido. Es posible que no tengas permisos para realizar esta acción.',
                    details: jiraErrors,
                });
            case 404:
                return res.status(404).json({
                    error: 'No encontrado',
                    message: 'Recurso no encontrado. Verifica la URL o el endpoint que estás intentando acceder.',
                    details: jiraErrors,
                });
            case 429:
                return res.status(429).json({
                    error: 'Demasiadas solicitudes',
                    message: 'Has excedido el límite de solicitudes. Intenta nuevamente más tarde.',
                    retryAfter: error.response.headers['retry-after'] || 'No especificado',
                });
            default:
                // Cualquier otro error HTTP
                return res.status(status).json({
                    error: `Error de Jira (HTTP ${status})`,
                    message: jiraMessage || 'Error desconocido de Jira Cloud API.',
                    details: jiraErrors,
                });
        }
    }

    // CASO 2: Error de red o sin respuesta (no se pudo conectar a Jira)
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        console.error('Error de conexión a Jira Cloud API:', error.message);
        return res.status(503).json({
            error: 'Servicio no disponible',
            message: 'No se pudo conectar a Jira Cloud API. Verifica tu conexión a internet o la URL de Jira.',
        });
    }

    // CASO 3: la peticion tarda demasiado (timeout)
    if (error.code === 'ECONNABORTED') {
        console.error('Error de timeout al conectar con Jira Cloud API:', error.message);
        return res.status(504).json({
            error: 'Gateway Timeout',
            message: 'La solicitud a Jira Cloud API tardó demasiado. Intenta nuevamente más tarde.',
        });
    }

    // CASO 4: Error desconocido
    console.error('Error desconocido al interactuar con Jira Cloud API:', error);
    return res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Ocurrió un error inesperado al interactuar con Jira Cloud API.',
    });
}

// Endpoints
// GET /api/jira/test - Verifica la conexión con Jira Cloud API
router.get('/test', async (req, res) => {
    try {
        const result = await jiraService.testConnection();
        res.json(result);
    } catch (error) {
        handleJiraError(res, error);
    }
});

// GET /api/jira/myself - Obtener información del usuario autenticado
router.get('/myself', async (req, res) => {
    try {
        const user = await jiraService.getMyself();
        res.json(user);
    } catch (error) {
        handleJiraError(res, error);
    }
});

// GET /api/jira/projects - Obtener la lista de proyectos en Jira Cloud
router.get('/projects', async (req, res) => {
    try {
        const projects = await jiraService.getProjects();
        res.json(projects);
    } catch (error) {
        handleJiraError(res, error);
    }
});

// GET /api/jira/issues?jql=... - Buscar issues con JQL (obligatorio)
router.get('/issues', async (req, res) => {
    try {
        const { jql, maxResults } = req.query;

        // Si no se proporciona JQL, devolver un error 400 Bad Request
        if (!jql) {
            return res.status(400).json({
                error: 'Parametro "jql" faltante',
                message: 'El parámetro "jql" es obligatorio para buscar issues.',
                ejemplo: '/api/jira/issues?jql=project=TFG ORDER BY created DESC',
            });
        }

        const limit = Math.min(parseInt(maxResults) || 10, 50); // Limitar maxResults a 50 para evitar sobrecargar la API 
        const results = await jiraService.searchIssues(jql, limit); // Buscar issues usando el servicio de Jira

        res.json(results);
    } catch (error) {
        handleJiraError(res, error);
    }
});

// Exportamos el router para usarlo en server.js
module.exports = router;