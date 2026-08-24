import { HelpCircle, ShieldCheck } from 'lucide-react';

export function MetricCard({ icon, label, value, unit, detail, help }) {
  return (
    <article className="metric-card">
      <div className="metric-card-top">
        <div className="metric-icon">{icon}</div>
        {help ? <HelpHint text={help} /> : null}
      </div>
      <span>{label}</span>
      <strong>{value}<small>{unit}</small></strong>
      <p>{detail}</p>
    </article>
  );
}

export function CardHeader({ title, subtitle, help }) {
  return (
    <div className="card-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="card-header-tools">
        {help ? <HelpHint text={help} /> : null}
        <ShieldCheck size={18} />
      </div>
    </div>
  );
}

export function Field({ label, value }) {
  return (
    <div className="field-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function HelpHint({ text }) {
  return (
    <span className="help-hint" tabIndex="0" aria-label={text}>
      <HelpCircle size={16} />
      <span className="help-tooltip">{text}</span>
    </span>
  );
}
