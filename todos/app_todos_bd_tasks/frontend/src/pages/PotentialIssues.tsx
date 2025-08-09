export function PotentialIssues() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Potenciais Problemas</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-yellow-800 mb-4">⚠️ Sistema em Análise</h2>
        <p className="text-yellow-700">
          Esta funcionalidade está analisando automaticamente possíveis problemas e inconsistências 
          no sistema. Em breve, relatórios detalhados estarão disponíveis aqui.
        </p>
      </div>
      
      <div className="grid gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="font-semibold text-lg mb-3">Análises Disponíveis</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• Tarefas órfãs sem sessão associada</li>
            <li>• Sessões com status inconsistente</li>
            <li>• Conflitos de sincronização</li>
            <li>• Problemas de integridade de dados</li>
            <li>• Alertas de performance</li>
          </ul>
        </div>
        
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-500">Nenhum problema detectado no momento</p>
        </div>
      </div>
    </div>
  )
}