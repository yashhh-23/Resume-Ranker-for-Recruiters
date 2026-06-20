import { Component } from "react";

class ResultsErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      prevResetKey: props.resetKey,
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (props.resetKey !== state.prevResetKey) {
      return {
        hasError: false,
        prevResetKey: props.resetKey,
      };
    }
    return null;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-slate-950/40 border border-slate-900 font-mono">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-500 mb-2">System Error</p>
          <p className="text-sm font-bold text-slate-200">Results failed to render.</p>
          <p className="text-xs text-slate-500 mt-2 mb-4">Please check candidate data format and retry.</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-mono bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 transition-colors"
          >
            Retry Render
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ResultsErrorBoundary;
