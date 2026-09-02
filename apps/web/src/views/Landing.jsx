import { Cloud } from 'lucide-react';
import { apiUrl } from '../lib/api.js';

export function Landing() {
  const expiredNotice = window.sessionStorage.getItem('nuvlo_auth_expired_notice');
  if (expiredNotice) window.sessionStorage.removeItem('nuvlo_auth_expired_notice');

  return (
    <main className="landing-shell">
      <section className="hero-card">
        {expiredNotice ? <div className="landing-notice">{expiredNotice}</div> : null}
        <div className="brand-mark"><Cloud size={26} /> Nuvlo</div>
        <p className="eyebrow">Nube + flujo para equipos agiles</p>
        <h1>Metricas claras para entender como avanza tu trabajo en Jira.</h1>
        <p className="lead">
          Nuvlo conectara con Atlassian mediante OAuth, sincronizara datos de Jira Cloud y
          mostrara Velocity, WIP, Lead Time y Cycle Time con trazabilidad del analisis.
        </p>
        <div className="actions">
          <a className="primary-button" href={`${apiUrl}/api/auth/atlassian/start`}>
            Conectar con Jira
          </a>
          <a className="secondary-button" href="/dashboard">Ver demo local</a>
        </div>
      </section>
    </main>
  );
}
