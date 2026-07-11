import { Component, type ErrorInfo, type ReactNode } from "react";

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled application error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="fatal-error" role="alert">
        <h1>The interface could not continue safely.</h1>
        <p>Your data was not changed. Reload the page or sign out and start again.</p>
        <div className="top-actions">
          <button className="button primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            className="button ghost"
            onClick={() => {
              localStorage.removeItem("access_token");
              localStorage.removeItem("user");
              window.location.assign("/");
            }}
          >
            Sign out
          </button>
        </div>
      </main>
    );
  }
}
