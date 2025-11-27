// Archivo: src/components/professor-dashboard/AlunosTab.jsx

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Package, Loader2 } from 'lucide-react';

// CORRECCIÓN: Ahora solo recibe dashboardData
const AlunosTab = ({ dashboardData }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Extrai de forma segura as propriedades
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  
  // Asignaciones seguras, asumiendo que el componente padre proporciona estas colecciones:
  const students = data.students || [];
  const allBillings = data.allBillings || [];
  const allAppointments = data.appointments || []; // CORREÇÃO: Usa 'appointments' do objeto data
  const assignedLogs = data.assignedLogs || []; // Logs de atribuição de pacotes

  const studentsWithAvailableClasses = useMemo(() => {
    if (!students || !allBillings || !allAppointments || !assignedLogs) return [];
    
    return students.map(student => {
      const studentAppointments = allAppointments.filter(a => a.student_id === student.id);
      
      // Filtra logs ativos (não cancelados) e pertencentes ao aluno
      const studentLogs = assignedLogs.filter(l => 
        l.student_id === student.id && l.status !== 'Cancelado'
      );
      
      // Cálculo de classes totais: sumar classes atribuídas e ativas dos logs
      const totalClasses = studentLogs.reduce((acc, log) => {
          return acc + (log.assigned_classes || 0);
      }, 0);
      
      // Clases usadas/agendadas: scheduled (agendada), completed (realizada), missed (falta).
      const usedClasses = studentAppointments.filter(a => 
        ['scheduled', 'completed', 'missed'].includes(a.status)
      ).length;
      
      const availableClasses = totalClasses - usedClasses;

      return {
        ...student,
        availableClasses: Math.max(0, availableClasses),
      };
    });
  }, [students, allBillings, allAppointments, assignedLogs]); // Dependências corrigidas

  const filteredStudents = studentsWithAvailableClasses.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="font-bold mb-4">Gerenciar Alunos ({students.length})</h3>
      <div className="flex justify-between items-center mb-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Nível de Espanhol</TableHead>
              <TableHead>Aulas Disponíveis</TableHead>
              <TableHead>Membro Desde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan="5" className="text-center"><Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" /></TableCell></TableRow> :
            filteredStudents.length > 0 ? filteredStudents.map(student => (
              <TableRow key={student.id}>
                <TableCell className="font-medium flex items-center gap-3">
                  <Avatar className="h-8 w-8"><AvatarImage src={student.avatar_url} /><AvatarFallback>{student.full_name?.[0] || 'A'}</AvatarFallback></Avatar>
                  {student.full_name}
                </TableCell>
                <TableCell>{student.age || 'N/A'}</TableCell>
                <TableCell>{student.spanish_level || 'N/A'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 font-semibold">
                    <Package className="h-4 w-4 text-sky-600" />
                    {student.availableClasses}
                  </div>
                </TableCell>
                <TableCell>{format(new Date(student.created_at), 'dd/MM/yyyy')}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan="5" className="text-center py-8 text-slate-500">Nenhum aluno encontrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AlunosTab;
