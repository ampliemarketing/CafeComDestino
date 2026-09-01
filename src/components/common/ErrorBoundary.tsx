import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Rótulo opcional pra diferenciar a origem do erro nos logs. */
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Fronteira de erro em volta das telas carregadas via lazy/Suspense.
 *
 * Sem isto, um chunk que falha ao baixar (deploy novo enquanto a aba está
 * aberta, queda de rede no meio do import) derruba a árvore inteira e deixa a
 * tela em branco, sem saída. Aqui o usuário vê uma mensagem clara e um botão
 * pra recarregar — que resolve o caso comum (buscar a versão nova do bundle).
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Fica no console pra depuração; se um dia houver Sentry/LogRocket, é aqui.
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ''}]`, error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-2xl font-bold">
          !
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-stone-800">Não foi possível carregar esta tela</h2>
          <p className="text-sm text-stone-500 max-w-sm">
            Pode ter saído uma versão nova do sistema enquanto esta aba estava aberta.
            Recarregue a página para atualizar.
          </p>
        </div>
        <button
          onClick={this.handleReload}
          className="bg-amber-800 hover:bg-amber-900 text-white text-sm font-bold rounded-xl px-5 py-2.5 shadow-lg shadow-amber-900/20"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
