import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface Props { children: ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-[var(--bg-primary)]">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FF3B30]/10 flex items-center justify-center">
              <AlertTriangle size={28} className="text-[#FF3B30]" />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">出了点问题</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {this.state.error?.message || '程序遇到了意外错误'}
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white text-sm font-medium rounded-xl hover:bg-[#0066D6] transition-colors shadow-ios-sm"
            >
              <RotateCcw size={14} />
              重新加载
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
