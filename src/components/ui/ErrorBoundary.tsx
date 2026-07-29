import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional fallback UI to display on error. Defaults to a built-in error state. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Application-level Error Boundary.
 * Catches render errors in child components and displays a recoverable error state
 * instead of letting the entire React tree unmount (which causes a black screen).
 *
 * Detailed error information is logged to the developer console only —
 * no tokens, environment values, or stack traces are shown to the user.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log detailed info to developer console only
    console.error('[ErrorBoundary] Component error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary-fallback" role="alert">
          <div className="error-boundary-fallback__card">
            <div className="error-boundary-fallback__icon">⚠</div>
            <div className="error-boundary-fallback__title">Something went wrong</div>
            <div className="error-boundary-fallback__message">
              This section encountered an error and could not be displayed.
            </div>
            <button
              className="error-boundary-fallback__retry"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              type="button"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
