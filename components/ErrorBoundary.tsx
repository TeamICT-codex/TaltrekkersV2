
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans text-slate-800">
                    <div className="max-w-2xl w-full bg-white rounded-xl shadow-lg border border-red-100 overflow-hidden">
                        <div className="bg-red-50 p-6 border-b border-red-100">
                            <h1 className="text-2xl font-bold text-red-700 flex items-center gap-2">
                                <span>🚫</span> Oeps, er ging iets mis!
                            </h1>
                            <p className="text-red-600 mt-2">
                                De applicatie is onverwacht gestopt. Hier is de technische foutmelding:
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed">
                                <p className="text-red-300 font-bold mb-2">Error: {this.state.error?.toString()}</p>
                                <pre className="text-slate-400 whitespace-pre-wrap">{this.state.errorInfo?.componentStack}</pre>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2.5 bg-tal-purple text-white font-semibold rounded-lg hover:bg-tal-purple-dark transition shadow-sm"
                                >
                                    🔄 Pagina Verversen
                                </button>
                                <a
                                    href="/"
                                    className="text-slate-500 hover:text-tal-purple text-sm font-medium"
                                >
                                    Terug naar Start
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
