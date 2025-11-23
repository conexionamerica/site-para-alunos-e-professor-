import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Package, Loader2 } from 'lucide-react';

const AlunosTab = ({ data, loading }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const studentsWithAvailableClasses = useMemo(() => {
    if (!data.students || !data.allBillings || !data.allAppointments) return [];
    
    return data.students.map(student => {
      const studentBillings = data.allBillings.filter(b => b.user_id === student.id);
      const studentAppointments = data.allAppointments.filter(a => a.student_id === student.id);
      const studentLogs = data.assignedLogs.filter(l => l.student_id === student.id);
      
      const totalClasses = studentBillings.reduce((acc, billing) => {
        const isCustom = billing.packages.name === 'Personalizado';
        if (isCustom) {
            const log = studentLogs.find(l => l.package_id === billing.package_id);
            return acc + (log?.assigned_classes || 0);
        }
        return acc + (billing.packages?.number_of_classes || 0);
      }, 0);

      const usedClasses = studentAppointments.filter(a => ['scheduled', 'completed', 'missed'].includes(a.status)).length;
      const rescheduledClasses = studentAppointments.filter(a => a.status === 'rescheduled').length;
      const availableClasses = totalClasses - usedClasses;

      return {
        ...student,
        availableClasses: Math.max(0, availableClasses),
      };
    });
  }, [data.students, data.allBillings, data.allAppointments, data.assignedLogs]);

  const filteredStudents = studentsWithAvailableClasses.filter(s => 
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm">
      <h3 className="font-bold mb-4">Gerenciar Alunos ({data.students.length})</h3>
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