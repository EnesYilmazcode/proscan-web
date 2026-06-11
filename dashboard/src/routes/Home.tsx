// ProScan Dashboard placeholder — auth + real dashboard land in M2.
// Styling mirrors the landing page palette: dark #2a343e on light #fcfcfc.
import type { CSSProperties } from 'react';

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    background: '#fcfcfc',
    color: '#2a343e',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    background: '#2a343e',
    color: '#fcfcfc',
    padding: '16px 32px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  logo: {
    fontSize: '1.25rem',
    fontWeight: 700,
    letterSpacing: '0.02em',
  },
  badge: {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    background: '#fcfcfc',
    color: '#2a343e',
    borderRadius: '999px',
    padding: '3px 10px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 24px',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: '0 0 12px',
  },
  subtitle: {
    fontSize: '1.05rem',
    opacity: 0.75,
    maxWidth: '28rem',
    margin: '0 0 32px',
    lineHeight: 1.6,
  },
  link: {
    display: 'inline-block',
    background: '#2a343e',
    color: '#fcfcfc',
    textDecoration: 'none',
    fontWeight: 600,
    padding: '12px 28px',
    borderRadius: '8px',
  },
};

export default function Home() {
  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <span style={styles.logo}>ProScan</span>
        <span style={styles.badge}>Dashboard</span>
      </header>
      <main style={styles.main}>
        <h1 style={styles.title}>ProScan Dashboard — coming soon</h1>
        <p style={styles.subtitle}>
          Your account, scan history, and subscription management are on the
          way. Sign-in launches with the next milestone.
        </p>
        <a href="/" style={styles.link}>
          Back to ProScan home
        </a>
      </main>
    </div>
  );
}
