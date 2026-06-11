// The Firebase Hosting rewrite sends every unknown /dashboard/* path into
// this SPA, so this catch-all must look intentional. Renders inside the
// authed shell.

import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

export default function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState
        title="404 — off the scan grid"
        body="That page does not exist in the ProScan dashboard."
        cta={
          <Link to="/" className="btn btn--primary">
            Back to Products
          </Link>
        }
      />
    </>
  );
}
