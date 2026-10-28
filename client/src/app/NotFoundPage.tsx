import { Link } from 'react-router';
import { EmptyState } from '../components/ui/states';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      action={
        <Link to="/" className="btn-secondary">
          Go home
        </Link>
      }
    >
      The address may be mistyped, or the page may have moved.
    </EmptyState>
  );
}
