import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '32px 24px',
            maxWidth: 640,
            margin: '80px auto',
            backgroundColor: '#1f2937',
            border: '1px solid #ef4444',
            borderRadius: 12,
            color: '#f3f4f6',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            fontFamily: 'Inter, -apple-system, sans-serif',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 28 }} aria-hidden="true">⚠️</span>
            <h1 style={{ fontSize: 20, margin: 0, color: '#f87171' }}>
              Simulator Execution Error Encountered
            </h1>
          </div>

          <p style={{ fontSize: 14, color: '#9ca3af', lineHeight: 1.6, marginBottom: 16 }}>
            A rendering boundary caught an unhandled exception. The simulation state remains protected.
          </p>

          {this.state.error && (
            <pre
              style={{
                padding: 12,
                backgroundColor: '#111827',
                border: '1px solid #374151',
                borderRadius: 6,
                fontSize: 12,
                fontFamily: 'monospace',
                color: '#fca5a5',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                marginBottom: 20,
              }}
            >
              {this.state.error.toString()}
            </pre>
          )}

          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ↻ Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
