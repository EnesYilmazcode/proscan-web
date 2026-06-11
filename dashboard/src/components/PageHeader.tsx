import type { ReactNode } from 'react';
import './components.css';

export interface PageHeaderProps {
  title: string;
  /** One line under the title (e.g. the buyer-semantics legend). */
  subtitle?: ReactNode;
  /** Right-aligned actions slot. */
  actions?: ReactNode;
}

/** 22px Archivo 700 page title with an actions slot. */
export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-header__title">{title}</h1>
        {subtitle ? <div className="page-header__sub">{subtitle}</div> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
