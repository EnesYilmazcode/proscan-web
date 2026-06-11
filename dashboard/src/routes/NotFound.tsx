import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 24px',
    background: '#fcfcfc',
    color: '#2a343e',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  code: {
    fontSize: '3rem',
    fontWeight: 700,
    margin: '0 0 8px',
  },
  text: {
    fontSize: '1.05rem',
    opacity: 0.75,
    margin: '0 0 28px',
  },
  links: {
    display: 'flex',
    gap: '16px',
  },
  link: {
    color: '#2a343e',
    fontWeight: 600,
    textDecoration: 'underline',
  },
};

export default function NotFound() {
  return (
    <div style={styles.page}>
      <h1 style={styles.code}>404</h1>
      <p style={styles.text}>That page does not exist in the ProScan Dashboard.</p>
      <div style={styles.links}>
        <Link to="/" style={styles.link}>
          Dashboard home
        </Link>
        <a href="/" style={styles.link}>
          ProScan home
        </a>
      </div>
    </div>
  );
}
