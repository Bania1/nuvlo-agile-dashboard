import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BarChart3, Cloud, RefreshCcw, ShieldCheck } from 'lucide-react';
import './styles.css';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';

function App() {
  const [demo, setDemo] = useState(null);

  useEffect(() => {
    fetch(`${apiUrl}/api/dashboard/demo`, { credentials: 'include' })
      .then((response) => response.json())
      .then(setDemo)
      .catch(() => setDemo(null));
  }, []);

  return (
    <main className="shell">
      <section className="hero-card">
        <div className="brand-mark"><Cloud size={28} /> Nuvlo</div>
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

      <section className="grid">
        <article className="panel">
          <ShieldCheck />
          <h2>OAuth y seguridad</h2>
          <p>Sin registro local. Tokens cifrados, cookies httpOnly y scopes minimos de Atlassian.</p>
        </article>
        <article className="panel">
          <RefreshCcw />
          <h2>Sync controlada</h2>
          <p>Paginacion, campos necesarios, backoff ante 429 y sincronizacion bajo demanda por ambito.</p>
        </article>
        <article className="panel">
          <BarChart3 />
          <h2>Validacion</h2>
          <p>Dataset demo, pruebas unitarias, integracion y E2E para cubrir RF/RNF/RI de la memoria.</p>
        </article>
      </section>

      <section className="demo-card" id="dashboard">
        <h2>Demo de metricas calculadas</h2>
        {demo ? (
          <div className="metric-row">
            <Metric label="Lead Time" value={demo.leadTime?.average ?? '-'} unit="dias" />
            <Metric label="Cycle Time" value={demo.cycleTime?.average ?? '-'} unit="dias" />
            <Metric label="WIP" value={demo.wip} unit="issues" />
            <Metric label="Velocity" value={demo.velocity} unit="pts" />
          </div>
        ) : <p>No se pudo cargar la demo del backend.</p>}
      </section>
    </main>
  );
}

function Metric({ label, value, unit }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{unit}</small>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
