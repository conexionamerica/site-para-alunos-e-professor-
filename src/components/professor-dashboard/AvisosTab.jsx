import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Megaphone, Calendar, User, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AvisosTab = ({ dashboardData }) => {
    const avisos = [
        {
            id: 1,
            title: 'Atualização do Sistema',
            content: 'O sistema passará por uma manutenção no próximo domingo às 02h da manhã.',
            date: new Date(),
            author: 'Administração',
            type: 'Manutenção'
        },
        {
            id: 2,
            title: 'Novos Materiais de Apoio',
            content: 'Foram adicionados novos modelos de PDF para as aulas de conversação avançada.',
            date: new Date(),
            author: 'Equipe Pedagógica',
            type: 'Pedagógico'
        }
    ];

    return (
        <div className="container mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-rose-100 rounded-xl">
                    <Megaphone className="w-8 h-8 text-rose-600" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800">Avisos e Comunicados</h1>
                    <p className="text-slate-500 text-lg">Central de notícias para professores</p>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {avisos.map((aviso) => (
                    <Card key={aviso.id} className="border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <Badge variant="outline" className="mb-2 bg-rose-50 text-rose-700 border-rose-200">
                                        {aviso.type}
                                    </Badge>
                                    <CardTitle className="text-xl font-bold text-slate-800">{aviso.title}</CardTitle>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm text-slate-500 flex items-center gap-1 justify-end">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {format(aviso.date, "d 'de' MMMM, yyyy", { locale: ptBR })}
                                    </span>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-600 leading-relaxed mb-4">
                                {aviso.content}
                            </p>
                            <div className="flex items-center gap-2 pt-4 border-t text-sm text-slate-500">
                                <div className="flex items-center gap-1">
                                    <User className="w-4 h-4" />
                                    <span className="font-medium">{aviso.author}</span>
                                </div>
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>Publicado agora</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {avisos.length === 0 && (
                    <div className="text-center py-20 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Megaphone className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-slate-600">Nenhum aviso no momento</h3>
                        <p className="text-slate-500">Fique atento para futuras atualizações aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AvisosTab;
