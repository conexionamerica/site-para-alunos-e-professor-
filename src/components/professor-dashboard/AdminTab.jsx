// Archivo: src/components/professor-dashboard/AdminTab.jsx
// Pestaña de Administração para superusuarios

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Users, Shield } from 'lucide-react';
import PreferenciasTab from './PreferenciasTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

const AdminTab = ({ dashboardData }) => {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState('preferencias');
    const [professorFilter, setProfessorFilter] = useState('all');

    const data = dashboardData?.data || {};
    const professors = data.professors || [];
    const allProfiles = data.allProfiles || [];
    const students = data.students || [];

    // Filtrar preferencias por profesor
    const filteredClassSlots = professorFilter === 'all'
        ? data.classSlots || []
        : (data.classSlots || []).filter(slot => slot.professor_id === professorFilter);

    return (
        <div className="px-4 lg:px-8 space-y-6">
            <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-purple-600" />
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Administração</h2>
                    <p className="text-slate-500">Gérencie usuários, preferências e perfis de acesso</p>
                </div>
            </div>

            <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="preferencias" className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Preferências
                    </TabsTrigger>
                    <TabsTrigger value="usuarios" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Usuários
                    </TabsTrigger>
                    <TabsTrigger value="perfis" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Perfis
                    </TabsTrigger>
                </TabsList>

                {/* Sub-tab: Preferências de todos los profesores */}
                <TabsContent value="preferencias" className="mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Preferências dos Professores</CardTitle>
                                    <CardDescription>Visualize as preferências de horários de todos os professores</CardDescription>
                                </div>
                                <Select value={professorFilter} onValueChange={setProfessorFilter}>
                                    <SelectTrigger className="w-[250px]">
                                        <SelectValue placeholder="Filtrar por professor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos os professores</SelectItem>
                                        {professors.map(prof => (
                                            <SelectItem key={prof.id} value={prof.id}>
                                                {prof.full_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {professorFilter !== 'all' ? (
                                <PreferenciasTab dashboardData={{
                                    ...dashboardData,
                                    data: {
                                        ...data,
                                        classSlots: filteredClassSlots
                                    },
                                    professorId: professorFilter
                                }} />
                            ) : (
                                <div className="text-center py-8 text-slate-500">
                                    <Settings className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                                    <p>Selecione um professor para ver suas preferências</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sub-tab: Gestión de Usuarios */}
                <TabsContent value="usuarios" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Gestão de Usuários</CardTitle>
                            <CardDescription>Crie, edite e gerencie todos os usuários do sistema</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead>Nome</TableHead>
                                            <TableHead>Username</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead>Estado</TableHead>
                                            <TableHead>Criado em</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {allProfiles.map(profile => (
                                            <TableRow key={profile.id}>
                                                <TableCell className="font-medium">{profile.full_name}</TableCell>
                                                <TableCell className="text-slate-500">{profile.username}</TableCell>
                                                <TableCell>
                                                    <Badge variant={
                                                        profile.role === 'superadmin' ? 'destructive' :
                                                            profile.role === 'professor' ? 'default' : 'secondary'
                                                    }>
                                                        {profile.role === 'superadmin' ? 'Admin' :
                                                            profile.role === 'professor' ? 'Professor' : 'Aluno'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {profile.is_active !== false ? (
                                                        <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                                                    ) : (
                                                        <Badge variant="destructive">Inativo</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {profile.created_at ? format(new Date(profile.created_at), 'dd/MM/yyyy') : '-'}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Sub-tab: Perfis de Acesso */}
                <TabsContent value="perfis" className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Perfis de Acesso</CardTitle>
                            <CardDescription>Gerencie os perfis e permissões de acesso ao sistema</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-4">
                                {/* Perfil Aluno */}
                                <div className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-800">Aluno (student)</h4>
                                            <p className="text-sm text-slate-500">Acesso ao portal do aluno com aulas e chat</p>
                                        </div>
                                        <Badge variant="secondary">{students.length} usuários</Badge>
                                    </div>
                                </div>

                                {/* Perfil Professor */}
                                <div className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-slate-800">Professor (professor)</h4>
                                            <p className="text-sm text-slate-500">Acesso completo ao painel do professor</p>
                                        </div>
                                        <Badge variant="default">{professors.length} usuários</Badge>
                                    </div>
                                </div>

                                {/* Perfil Superadmin */}
                                <div className="border rounded-lg p-4 border-purple-200 bg-purple-50">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-semibold text-purple-800">Administrador (superadmin)</h4>
                                            <p className="text-sm text-purple-600">Acesso total a todos os recursos e dados</p>
                                        </div>
                                        <Badge variant="destructive">
                                            {allProfiles.filter(p => p.role === 'superadmin').length} usuários
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                <p className="text-sm text-slate-600">
                                    <strong>Nota:</strong> A gestão avançada de perfis e permissões será implementada em versões futuras.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AdminTab;
