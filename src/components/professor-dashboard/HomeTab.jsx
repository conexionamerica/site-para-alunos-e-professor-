// Arquivo: src/components/professor-dashboard/HomeTab.jsx

// ... (imports)
const HomeTab = ({ dashboardData }) => {
// ... (lógica anterior)

  return (
    // CORREÇÃO: Adiciona padding horizontal (px-4 lg:px-8) à div raiz
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8 px-4 lg:px-8"> 
      <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        {/* ... Resto do conteúdo ... */}
      </div>
      <div className="space-y-4 lg:space-y-8">
        {/* ... Resto do conteúdo ... */}
      </div>
    </div>
  );
};

export default HomeTab;
