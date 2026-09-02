export function normalizeForSearch(value) {
  return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function formatIssueEffort(points) {
  const value = Number(points);
  if (!Number.isFinite(value) || value <= 0) return 'Sin puntos';
  return value === 1 ? '1 punto' : `${value} puntos`;
}

export function isDoneStatus(status) {
  return ['done', 'listo', 'finalizada', 'finalizado'].includes(normalizeForSearch(status));
}

export function isWipStatus(status) {
  return ['in progress', 'en curso', 'review', 'revision'].includes(normalizeForSearch(status));
}
