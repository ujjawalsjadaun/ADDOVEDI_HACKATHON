import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error', error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-lg p-8 text-center">
        <h1 className="text-lg font-semibold">This screen failed to load</h1>
        <p className="mt-2 text-sm text-slate-600">
          Nothing was changed. Reload the page to try again. If this is an emergency, contact the hospital directly.
        </p>
        <button type="button" className="btn-primary mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
