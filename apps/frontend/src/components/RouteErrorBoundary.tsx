import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { children: ReactNode; resetKey: string }
type State = { failed: boolean; attempt: number }

/**
 * Contém erros de renderização de uma tela dentro da área de conteúdo.
 * Sem ele, o React desmonta a aplicação inteira (tela branca) e, como os tokens ficam só em memória,
 * o usuário perde a sessão ao recarregar. Aqui o menu e a sessão continuam ativos.
 *
 * Error Boundaries ainda exigem componente de classe: não há hook equivalente no React.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Fica no console do navegador para diagnóstico; a tela mostra apenas uma mensagem amigável.
    console.error('Erro ao renderizar a tela', error, info.componentStack)
  }

  componentDidUpdate(previous: Props) {
    // Ao navegar para outra rota, a nova tela começa sem o erro da anterior.
    if (previous.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false })
  }

  private retry = () => this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }))

  render() {
    if (this.state.failed) {
      return <main className="app-shell"><section className="route-error" role="alert">
        <h1>Não foi possível exibir esta tela.</h1>
        <p className="muted">Os seus dados estão salvos. Tente carregar a tela de novo ou volte ao início.</p>
        <div className="form-actions">
          <Link className="link-button" to="/">Ir para o início</Link>
          <button type="button" className="secondary" onClick={this.retry}>Tentar de novo</button>
        </div>
      </section></main>
    }
    // A key muda a cada tentativa: a tela é montada do zero, refazendo as requisições.
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>
  }
}
