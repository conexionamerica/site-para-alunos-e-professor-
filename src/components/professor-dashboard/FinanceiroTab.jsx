// Arquivo: src/components/professor-dashboard/FinanceiroTab.jsx
// Componente placeholder para aba Financeiro (em desenvolvimento)

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

const FinanceiroTab = ({ dashboardData }) => {
    return (
        <div className="px-4 lg:px-8 space-y-6">
            <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-600" />
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Financeiro</h2>
                    <p className="text-slate-500">Gestão de títulos financeiros e pagamentos</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Módulo Financeiro</CardTitle>
                    <CardDescription>
                        Sistema de gerenciamento de recebimentos (alunos) e pagamentos (professores)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <DollarSign className="h-16 w-16 text-slate-300 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">
                            Em Desenvolvimento
                        </h3>
                        <p className="text-slate-500 max-w-md">
                            O módulo financeiro está sendo desenvolvido e será disponibilizado em breve.
                            Incluirá gestão de títulos, recebimentos de alunos e pagamentos a professores.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default FinanceiroTab;
