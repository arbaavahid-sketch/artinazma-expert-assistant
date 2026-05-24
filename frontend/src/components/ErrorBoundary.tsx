"use client";

import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] p-6">
          <div className="max-w-md rounded-[24px] border border-red-100 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
              ⚠️
            </div>
            <h2 className="mb-2 text-xl font-black text-slate-900">
              خطایی رخ داده است
            </h2>
            <p className="mb-6 leading-7 text-slate-600">
              متأسفانه مشکلی در بارگذاری این بخش پیش آمد. لطفاً صفحه را
              بازنشانی کنید.
            </p>
            {this.state.error && (
              <p className="mb-6 rounded-lg bg-red-50 px-4 py-2 text-right font-mono text-xs text-red-600">
                {this.state.error.message}
              </p>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="ui-btn ui-btn-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3"
            >
              بازنشانی صفحه
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
