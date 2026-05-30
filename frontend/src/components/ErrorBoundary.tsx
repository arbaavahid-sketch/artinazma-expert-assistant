"use client";

import React from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  /** Custom fallback UI. If omitted, the default full-page error card is shown. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Label shown in the error card title (default: "خطایی رخ داده است") */
  title?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// ── Main ErrorBoundary ────────────────────────────────────────────────────────

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    const { error } = this.state;

    // Custom fallback
    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    // Default full-page error card
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f8] p-6">
        <div className="max-w-md w-full rounded-[24px] border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-3xl">
            ⚠️
          </div>
          <h2 className="mb-2 text-xl font-black text-slate-900">
            {this.props.title ?? "خطایی رخ داده است"}
          </h2>
          <p className="mb-6 leading-7 text-slate-600">
            متأسفانه مشکلی در بارگذاری این بخش پیش آمد. لطفاً صفحه را
            بازنشانی کنید.
          </p>
          <p className="mb-6 rounded-lg bg-red-50 px-4 py-2 text-right font-mono text-xs text-red-600 break-all">
            {error.message}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.reset}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              تلاش مجدد
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              بازنشانی صفحه
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// ── Lightweight inline error boundary for sections/widgets ────────────────────
// Shows a small inline error card instead of taking over the full page.

export class SectionErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[SectionErrorBoundary]", error.message, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback && this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-center text-sm text-red-700">
        <span className="font-semibold">خطا در بارگذاری این بخش.</span>{" "}
        <button
          onClick={this.reset}
          className="underline hover:no-underline"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }
}
