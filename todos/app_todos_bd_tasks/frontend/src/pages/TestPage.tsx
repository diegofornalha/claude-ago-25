import { Link } from 'react-router-dom'

export function TestPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <h1 className="text-3xl font-bold mb-4">Página de Teste</h1>
      <p className="mb-4">Esta página funciona sem as dependências do DB.</p>
      <Link to="/" className="text-indigo-400 hover:text-indigo-300">
        Voltar
      </Link>
    </div>
  )
}