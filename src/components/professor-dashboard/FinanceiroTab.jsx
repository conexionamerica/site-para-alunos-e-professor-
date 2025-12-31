// Arquivo: src/components/professor-dashboard/FinanceiroTab.jsx
// Aba placeholder para funcionalidade financeira (será desenvolvida futuramente)

import React from 'react';
import { DollarSign } from 'lucide-react';

const FinanceiroTab = () => {
    return (
        <div className="w-full px-4 lg:px-8">
            <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-6 rounded-full mb-6">
                        <DollarSign className="h-16 w-16 text-green-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-800 mb-3">Financeiro</h2>
                    <p className="text-slate-500 text-center max-w-md">
                        Esta funcionalidade está em desenvolvimento e será disponibilizada em breve.
                    </p>
                    <p className="text-sm text-slate-400 mt-4">
                        Aqui você poderá visualizar relatórios financeiros, pagamentos e histórico.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FinanceiroTab;
