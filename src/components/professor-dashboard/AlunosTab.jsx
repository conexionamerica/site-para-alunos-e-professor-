// Archivo: src/components/professor-dashboard/AlunosTab.jsx

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Package, Loader2, MoreVertical, UserCheck, UserX, MessageSquare, Send } from 'lucide-react';

// CORRECCIÓN: Ahora solo recibe dashboardData
const AlunosTab = ({ dashboardData }) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [messageTitle, setMessageTitle] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [messagePriority, setMessagePriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Extrai de forma segura as propriedades
  const data = dashboardData?.data || {};
  const loading = dashboardData?.loading || false;
  const professorId = dashboardData?.professorId;
  const onUpdate = dashboardData?.onUpdate;

  // Asignaciones seguras
  const students = data.students || [];
  const allBillings = data.allBillings || [];
  const allAppointments = data.appointments || [];
  const assignedLogs = data.assignedLogs || [];

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

      // Clases usadas/agendadas: scheduled, completed, missed
      const usedClasses = studentAppointments.filter(a =>
        ['scheduled', 'completed', 'missed'].includes(a.status)
      ).length;

      const availableClasses = totalClasses - usedClasses;

      return {
        ...student,
        availableClasses: Math.max(0, availableClasses),
      };
    });
  }, [students, allBillings, allAppointments, assignedLogs]);

  const filteredStudents = studentsWithAvailableClasses.filter(s =>
    s.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para activar/inactivar alumno
  const handleToggleActive = async (student) => {
    // Si is_active es undefined o true, el alumno está activo
    // Si is_active es false, el alumno está inactivo
    const isCurrentlyActive = student.is_active !== false;
    const newStatus = !isCurrentlyActive;
    const action = newStatus ? 'ativar' : 'inativar';

    if (!window.confirm(`Tem certeza que deseja ${action} o aluno ${student.full_name}?`)) {
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({ is_active: newStatus })
      .eq('id', student.id);

    if (error) {
      console.error('Error toggling student status:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: `Não foi possível ${action} o aluno: ${error.message}`
      });
      return;
    }

    toast({
      title: 'Sucesso!',
      description: `Aluno ${newStatus ? 'ativado' : 'inativado'} com sucesso.`
    });

    // Reload data
    if (onUpdate) onUpdate();
  };

  // Abrir diálogo de mensaje
  const handleOpenMessageDialog = (student) => {
    setSelectedStudent(student);
    setIsMessageDialogOpen(true);
  };

  // Enviar mensaje al alumno
  const handleSendMessage = async () => {
    if (!messageTitle.trim() || !messageContent.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o título e a mensagem.'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Insertar mensaje
      const { error: messageError } = await supabase
        .from('student_messages')
        .insert({
          professor_id: professorId,
          student_id: selectedStudent.id,
          title: messageTitle,
          message: messageContent,
          priority: messagePriority,
        });

      if (messageError) throw messageError;

      // Enviar notificación también
      await supabase.from('notifications').insert({
        user_id: selectedStudent.id,
        type: 'professor_message',
        content: {
          message: `Nova mensagem do professor: ${messageTitle}`,
          priority: messagePriority
        }
      });

      toast({
        title: 'Mensagem enviada!',
        description: `Mensagem enviada para ${selectedStudent.full_name}.`
      });

      // Reset form
      setIsMessageDialogOpen(false);
      setMessageTitle('');
      setMessageContent('');
      setMessagePriority('normal');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar mensagem',
        description: error.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <TableHead>Nível</TableHead>
              <TableHead>Aulas Disponíveis</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Membro Desde</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan="7" className="text-center"><Loader2 className="mx-auto my-4 h-6 w-6 animate-spin" /></TableCell></TableRow> :
              filteredStudents.length > 0 ? filteredStudents.map(student => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8"><AvatarImage src={student.avatar_url} /><AvatarFallback>{student.full_name?.[0] || 'A'}</AvatarFallback></Avatar>
                      {student.full_name}
                    </div>
                  </TableCell>
                  <TableCell>{student.age || 'N/A'}</TableCell>
                  <TableCell>{student.spanish_level || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-semibold">
                      <Package className="h-4 w-4 text-sky-500" />
                      {student.availableClasses}
                    </div>
                  </TableCell>
                  <TableCell>
                    {student.is_active !== false ? (
                      <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Ativo</Badge>
                    ) : (
                      <Badge variant="destructive">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>{format(new Date(student.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleToggleActive(student)}>
                          {student.is_active !== false ? (
                            <><UserX className="mr-2 h-4 w-4 text-orange-600" /> Inativar Aluno</>
                          ) : (
                            <><UserCheck className="mr-2 h-4 w-4 text-green-600" /> Ativar Aluno</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleOpenMessageDialog(student)}>
                          <MessageSquare className="mr-2 h-4 w-4 text-sky-600" />
                          Enviar Mensagem
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan="7" className="text-center py-8 text-slate-500">Nenhum aluno encontrado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>

      {/* Diálogo de Mensaje */}
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem para {selectedStudent?.full_name}</DialogTitle>
            <DialogDescription>
              A mensagem aparecerá no painel do aluno como um aviso importante.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título da Mensagem</Label>
              <Input
                id="title"
                placeholder="Ex: Tarefa da próxima aula"
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Digite sua mensagem..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select value={messagePriority} onValueChange={setMessagePriority}>
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Importante</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSendMessage}
              disabled={isSubmitting}
              className="bg-sky-500 hover:bg-sky-600"
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Enviar Mensagem</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AlunosTab;
