// Router errorElement: a render crash or a failed lazy chunk lands here
// instead of a blank page.

import { useRouteError } from 'react-router-dom';
import ErrorState from '../components/ErrorState';

export default function RouteError() {
  const error = useRouteError();
  console.error('[proscan] route crashed', error);
  return <ErrorState title="Something broke on this page" error={error} />;
}
