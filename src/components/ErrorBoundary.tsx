import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kendala saat memuat tampilan simulasi.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-6">
            <h1 className="text-lg font-bold text-[#1A2B5F]">Terjadi Kendala Aplikasi Simulasi</h1>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Sistem mendeteksi gangguan tak terduga. Data simulasi Anda tetap tersimpan dengan aman.
            </p>
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs font-mono text-slate-700 break-all">
              {this.state.message}
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 px-4 py-2 bg-[#1A2B5F] text-white text-sm font-semibold rounded-md hover:bg-[#111D42] transition-colors"
            >
              Muat Ulang Simulator
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
