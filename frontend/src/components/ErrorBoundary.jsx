import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error:', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 20, background: '#07110A', color: '#e0e0e0', fontFamily: 'Inter, sans-serif',
        }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 8px', color: '#ef4444' }}>
              Terjadi Kesalahan
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: 20, lineHeight: 1.5 }}>
              Aplikasi mengalami crash. Silakan muat ulang halaman.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={this.handleReload}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg, #3DDC84, #2a9d5c)',
                  color: '#0b2a1b', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem',
                }}>
                🔄 Muat Ulang
              </button>
              <button onClick={() => { window.location.href = '/'; window.location.reload() }}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: '1px solid #333',
                  background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem',
                }}>
                🏠 Halaman Utama
              </button>
            </div>
            {this.state.error && (
              <details style={{ marginTop: 20, textAlign: 'left', fontSize: '0.72rem', color: '#666' }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>Detail Error</summary>
                <pre style={{ marginTop: 8, padding: 8, background: '#0a0a0a', borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                  {this.state.error.stack || this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}