export function normalizePath(path) {
  const cleanPath = path.replace(/\/$/, '') || '/dashboard';
  return cleanPath.startsWith('/dashboard') ? cleanPath : '/dashboard';
}

export function resolveView(path) {
  if (path.startsWith('/dashboard/board')) return { title: 'Tablero Kanban', section: 'Tablero', description: 'Sprint actual simulado desde CSV' };
  if (path.startsWith('/dashboard/alerts')) return { title: 'Gestion de alertas', section: 'Alertas', description: 'Reglas y avisos del proyecto' };
  if (path.startsWith('/dashboard/activity')) return { title: 'Registro de actividad', section: 'Actividad', description: 'Eventos recientes del sistema' };
  if (path.startsWith('/dashboard/settings')) return { title: 'Configuracion', section: 'Configuracion', description: 'Preferencias de demo e integracion Jira' };
  return { title: 'Panel de flujo agile', section: 'Dashboard', description: 'Metricas principales del proyecto' };
}
