// Servicio para interactuar con la API de Jira Cloud
const axios = require('axios');
const config = require('../config/env');

// Crear una instancia de Axios con la configuración de Jira
const jiraClient = axios.create({
    baseURL: `${config.jira.baseUrl}/rest/api/3`,

    headers: {
        // Accept: le decimos a Jira que queremos recibir respuestas en formato JSON
        'Accept': 'application/json',
        // Content-Type: le decimos a Jira que los post generan datos en formato JSON
        'Content-Type': 'application/json',
    },

    // Autenticación básica con email y API token
    auth: {
        username: config.jira.email,
        password: config.jira.apiToken,
    },

    // Timeout para las solicitudes (opcional)
    timeout: 10000, // 10 segundos
});

// Funciones del servicio para interactuar con Jira Cloud API

async function testConnection() {
    console.log('Probando conexión con Jira Cloud API...');

    // await para esperar la respuesta de la API
    // .get para hacer una solicitud GET a la API de Jira
    const response = await jiraClient.get('/myself');

    console.log('Conexion exitosa!!');

    // Devolver la respuesta de la API que nos interese
    return {
        success: true,
        message: 'Conexión exitosa con Jira Cloud API',
        user: response.data.displayName, // Nombre del usuario autenticado
        email: response.data.emailAddress, // Email del usuario autenticado
    };
}

// Get myself: para obtener información del usuario autenticado
async function getMyself() {
    console.log('Obteniendo información del usuario autenticado...');
    const response = await jiraClient.get('/myself');
    const data = response.data;

    // Filtramos campos utiles
    return {
        accountId: data.accountId,
        displayName: data.displayName,  // Nombre del usuario autenticado
        emailAddress: data.emailAddress,    // Email del usuario autenticado
        active: data.active,    // Si el usuario está activo o no
        locale: data.locale,    // Idioma del usuario
        timeZone: data.timeZone,    // Zona horaria del usuario

        // ?. es "optional chaining" para evitar errores si el campo no existe
        avatarUrl: data.avatarUrls?.['48x48'] || null, // URL del avatar del usuario (tamaño 48x48) o null si no existe
    };
}

/**
 * searchIssues: para buscar issues en Jira usando JQL (Jira Query Language)
 * Para buscar issues, podemos usar el endpoint /search de la API de Jira y pasarle una consulta JQL.
 * 
 * NOTA: Jira depreco GET /search en la API v3, ahora se debe usar POST /search con el cuerpo de la consulta en formato JSON.
 */

async function searchIssues(jql, maxResults = 10) {
    console.log(`Buscando issues en Jira con JQL: "${jql}" (maxResults: ${maxResults})`);
    // POST enviamos datos a jira para buscar issues usando JQL
    // En GET los datos van URL, en POST van en el cuerpo de la solicitud
    const response = await jiraClient.post('/search/jql', {
        jql: jql,
        maxResults: maxResults,

        //fields: le decimos a jira que SOLO devuelva estos campos
        fields: ['summary', 'status', 'assignee', 'assignee', 'created', 'updated', 'priority', 'issuetype'],
    });

    const data = response.data;

    //.map para transformar cada issue del formato de Jira a un formato más simple
    // es como un bucle foreach pero que devuelve un nuevo array
    const issues = data.issues.map((issue) => ({
        key: issue.key,    // Clave del issue (ejemplo: PROY-123)
        summary: issue.fields.summary,    // Resumen del issue
        status: issue.fields.status?.name || 'Sin estado',   // Estado del issue (ejemplo: "To Do", "In Progress", "Done")
        assignee: issue.fields.assignee?.displayName || 'Sin asignar',   // Persona asignada al issue si no hay
        priority: issue.fields.priority?.name || 'Sin prioridad',   // Prioridad (ejemplo: "High", "Medium", "Low")
        type: issue.fields.issuetype?.name || 'Sin tipo',   // Tipo de issue (ejemplo: "Bug", "Task", "Story")
        created: issue.fields.created,    // Fecha de creación del issue
        updated: issue.fields.updated,    // Fecha de última actualización del issue
    }));

    return {
        total: data.total,    // Total de issues encontrados
        maxResults: data.maxResults,    // Máximo de resultados devueltos
        startAT: data.startAt,    // Índice del primer issue devuelto
        issues: issues,   // Array de issues encontrados
    };
}

// getProjects: para obtener la lista de proyectos en Jira
async function getProjects() {
    console.log('Obteniendo lista de proyectos en Jira...');
    const response = await jiraClient.get('/project');

    return response.data.map((project) => ({
        id: project.id,    // ID del proyecto
        key: project.key,   // Clave del proyecto (ejemplo: PROY)
        name: project.name, // Nombre del proyecto
        style: project.style,   // Estilo del proyecto (ejemplo: "classic", "next-gen")
    }));
}

// Exportar las funciones del servicio para que puedan ser usadas en otras partes de la aplicación
module.exports = {
    testConnection,
    getMyself,
    searchIssues,
    getProjects,
};