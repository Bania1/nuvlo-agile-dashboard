function localTimestamp() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'medium',
    hour12: false,
  }).format(new Date());
}

function serializeMeta(meta) {
  if (!meta) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

export function logInfo(message, meta) {
  console.log(`[nuvlo] ${localTimestamp()} INFO ${message}${serializeMeta(meta)}`);
}

export function logError(message, error, meta) {
  const details = {
    ...meta,
    error: error?.code || error?.message || String(error),
  };
  console.error(`[nuvlo] ${localTimestamp()} ERROR ${message}${serializeMeta(details)}`);
}
