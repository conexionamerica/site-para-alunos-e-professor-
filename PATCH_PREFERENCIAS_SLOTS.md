# 🔧 Patch para PreferenciasTab - Ocupação de Slots

## Mudanças Necessárias

### 1. Adicionar estado para appointments futuros

Adicionar após a linha 270 (após `const [liberatingSlot, setLiberatingSlot] = useState(null);`):

```javascript
const [futureAppointments, setFutureAppointments] = useState([]);
const [slotOccupancy, setSlotOccupancy] = useState({});
```

### 2. Buscar appointments futuros

Adicionar novo useEffect após o useEffect dos slots (após linha 319):

```javascript
// Buscar appointments futuros para marcar slots ocupados
useEffect(() => {
  const fetchFutureAppointments = async () => {
    if (!professorId) return;
    
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id, class_datetime, duration_minutes, status,
        student:profiles!student_id(full_name)
      `)
      .eq('professor_id', professorId)
      .gte('class_datetime', getBrazilDate().toISOString())
      .in('status', ['scheduled', 'pending', 'rescheduled']);
    
    if (error) {
      console.error('Error fetching future appointments:', error);
      return;
    }
    
    setFutureAppointments(data || []);
    
    // Mapear appointments para slots
    const occupancy = {};
    (data || []).forEach(apt => {
      const aptDate = parseISO(apt.class_datetime);
      const dayOfWeek = getDay(aptDate);
      const time = format(aptDate, 'HH:mm:ss');
      const duration = apt.duration_minutes || 30;
      const slotsNeeded = Math.ceil(duration / 15);
      
      // Marcar slot inicial e consecutivos
      for (let i = 0; i < slotsNeeded; i++) {
        const slotTime = add(aptDate, { minutes: i * 15 });
        const slotTimeStr = format(slotTime, 'HH:mm:ss');
        const slotKey = `${dayOfWeek}-${slotTimeStr}`;
        
        occupancy[slotKey] = {
          appointmentId: apt.id,
          studentName: apt.student?.full_name,
          isFirstSlot: i === 0,
          status: apt.status
        };
      }
    });
    
    setSlotOccupancy(occupancy);
  };
  
  fetchFutureAppointments();
}, [professorId, loading]);
```

### 3. Atualizar handleLiberateSlot

Substituir a função handleLiberateSlot (linhas 376-474) por:

```javascript
const handleLiberateSlot = async (slot, occupation) => {
  const slotKey = `${slot.day_of_week}-${slot.start_time}`;
  
  try {
    // Se há occupation (appointment agendado)
    if (occupation?.appointmentId) {
      const studentName = occupation.studentName || 'Aluno desconhecido';
      
      // Confirmar com o usuário
      if (!window.confirm(
        `Este horário está ocupado por: ${studentName}\n\n` +
        `Ao liberar este horário:\n` +
        `• O agendamento será CANCELADO\n` +
        `• O horário ficará DISPONÍVEL\n\n` +
        `Deseja continuar?`
      )) {
        return;
      }
      
      setLiberatingSlot(slotKey);
      
      // Cancelar o appointment
      const { error: cancelError } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', occupation.appointmentId);
      
      if (cancelError) throw cancelError;
      
      toast({
        title: 'Horário liberado!',
        description: `O horário foi liberado. Agendamento de ${studentName} foi cancelado.`
      });
      
    } else {
      // Liberar slot filled (pacote personalizado)
      if (!window.confirm(
        `Deseja liberar este horário?\n\n` +
        `O horário ficará disponível para novos agendamentos.`
      )) {
        return;
      }
      
      setLiberatingSlot(slotKey);
      
      const { error: updateError } = await supabase
        .from('class_slots')
        .update({ status: 'active' })
        .eq('id', slot.id);
      
      if (updateError) throw updateError;
      
      toast({
        title: 'Horário liberado!',
        description: 'O horário foi liberado com sucesso.'
      });
    }
    
    // Recarregar dados
    if (onUpdate) onUpdate();
    
  } catch (error) {
    console.error('Error liberating slot:', error);
    toast({
      variant: 'destructive',
      title: 'Erro ao liberar horário',
      description: error.message
    });
  } finally {
    setLiberatingSlot(null);
  }
};
```

### 4. Atualizar renderização dos slots

Substituir o bloco de renderização dos slots (linhas 1204-1245) por:

```javascript
{daySlots?.map(slot => {
  const slotKey = `${slot.day_of_week}-${slot.start_time}`;
  const occupation = slotOccupancy[slotKey];
  const isFilled = slot.status === 'filled';
  const isOccupied = !!occupation;
  const isActive = slot.status === 'active';
  const isInactive = slot.status === 'inactive';
  
  return (
    <div
      key={slot.start_time}
      className={cn(
        "flex flex-col gap-1 p-2 rounded-md border",
        isOccupied ? "bg-sky-100 border-sky-300" :
        isFilled ? "bg-sky-100 border-sky-300" :
        isInactive ? "bg-slate-200 border-slate-300" :
        "bg-white border-slate-200"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn(
          "text-sm font-medium",
          (isOccupied || isFilled) ? "text-sky-700" :
          isInactive ? "text-slate-500" :
          "text-slate-700"
        )}>
          {slot.start_time.substring(0, 5)}
        </span>
        
        {!isOccupied && !isFilled && (
          <Switch
            checked={isActive}
            onCheckedChange={() => handleSlotToggle(slot.day_of_week, slot.start_time)}
            className="h-4 w-7"
          />
        )}
      </div>
      
      {(isOccupied || isFilled) && (
        <>
          <div className="text-xs text-sky-700 font-medium truncate">
            {occupation?.studentName || "Ocupado"}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs hover:bg-red-100 hover:text-red-700"
            onClick={() => handleLiberateSlot(slot, occupation)}
            disabled={liberatingSlot === slotKey}
            title="Clique para liberar este horário"
          >
            {liberatingSlot === slotKey ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              'Liberar'
            )}
          </Button>
        </>
      )}
    </div>
  );
})}
```

---

## Resumo das Cores

- **Azul claro (`bg-sky-100`)**: Slot ocupado por aluno (mostra nome)
- **Cinza (`bg-slate-200`)**: Slot inativo pelo professor
- **Branco (`bg-white`)**: Slot ativo e disponível

---

## Aplicar o Patch

Execute o comando para aplicar as mudanças:

```bash
# Este é um patch manual - as mudanças precisam ser aplicadas manualmente
# ou através de um script de substituição
```
