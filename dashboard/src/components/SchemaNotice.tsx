import type { SchemaProblem } from '../lib/checked';
import './components.css';

/** Says how many documents were left out for failing the schema check,
 *  with the first one's path and problems. Renders nothing when none were. */
export default function SchemaNotice({ invalid }: { invalid: SchemaProblem[] }) {
  if (invalid.length === 0) return null;
  const first = invalid[0];
  const noun = invalid.length === 1 ? 'document' : 'documents';
  return (
    <div className="notice notice--warn" role="status">
      <b>
        {invalid.length.toLocaleString('en-US')} {noun} left out
      </b>{' '}
      because {invalid.length === 1 ? 'it does' : 'they do'} not match the ProScan schema. An
      older extension build may have written {invalid.length === 1 ? 'it' : 'them'}.
      <details className="notice__details">
        <summary className="mono">{first.path}</summary>
        <ul className="mono">
          {first.problems.slice(0, 6).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
