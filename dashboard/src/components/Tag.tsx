import type { CSSProperties } from 'react';
import { useWorkspace } from '../lib/hooks';
import './components.css';

export interface TagProps {
  label: string;
  /** Explicit color wins; otherwise workspace tagMeta[label].color is used. */
  color?: string;
}

/** Workspace tag pill with its tagMeta color swatch (falls back to slate). */
export default function Tag({ label, color }: TagProps) {
  const { workspace } = useWorkspace();
  const metaColor = color ?? workspace?.tagMeta?.[label]?.color;
  const style = metaColor
    ? ({ '--tag-color': metaColor } as CSSProperties)
    : undefined;
  return (
    <span className="tag" style={style}>
      <span className="tag__swatch" />
      {label}
    </span>
  );
}
