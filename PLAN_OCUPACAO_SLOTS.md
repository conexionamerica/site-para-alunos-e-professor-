# 🔒 Sistema de Ocupação de Slots - Implementação

## Data: 21 de Dezembro de 2025 - 15:38

---

## 📋 Objetivo

Implementar um sistema onde:
1. **Todos os agendamentos ocupam slots na agenda**
2. **Slots ocupados são sinalizados na aba Preferências**
3. **Slots só disponíveis para reagendamento se livres E ativos**
4. **Manter função de liberar horários**
5. **Sinalizações observam data das aulas agendadas**

---

## 🎯 Mudanças Necessárias

### 1. **Nova Lógica de Status de Slots**

#### Status Atuais:
- `active` - Ativo e disponível
- `inactive` - Inativo (professor desabilitou)
- `filled` - Ocupado permanentemente (pacote personalizado)

#### Novo Status Proposto:
- `active` - Ativo e disponível
- `inactive` - Inativo (professor desabilitou)
- `filled` - Ocupado permanentemente (pacote personalizado)
- `occupied` - Ocupado temporariamente (aula agendada)

**OU** manter os status atuais e adicionar campo `occupied_by_appointment_id`

---

## 🔧 Abordagem Recomendada

### Opção 1: Adicionar Campo `occupied_by_appointment_id`

**Vantagens:**
- Não quebra lógica existente
- Fácil rastrear qual appointment ocupa o slot
- Fácil liberar quando appointment é cancelado

**Estrutura:**
```javascript
class_slots {
  id,
  professor_id,
  day_of_week,
  start_time,
  status, // 'active', 'inactive', 'filled'
  occupied_by_appointment_id // NULL ou ID do appointment
}
```

### Opção 2: Usar Status Dinâmico

**Vantagens:**
- Mais simples visualmente
- Menos campos na tabela

**Desvantagens:**
- Precisa calcular em tempo real
- Mais queries ao banco

---

## 💡 Solução Proposta: Híbrida

Usar **cálculo em tempo real** baseado em appointments:

1. **Buscar todos os appointments futuros** do professor
2. **Para cada slot**, verificar se há appointment naquele dia/hora
3. **Marcar visualmente** como ocupado
4. **Mostrar informação** do aluno
5. **Permitir liberar** (cancela o appointment)

### Vantagens:
- Não precisa modificar schema do banco
- Sempre atualizado em tempo real
- Não precisa sincronizar status

---

## 🎨 Interface Proposta

### Slot Livre (Active)
```
┌─────────┐
│ 08:00   │ ← Fundo azul claro
│   ⚪    │ ← Switch ativo
└─────────┘
```

### Slot Ocupado (Appointment Agendado)
```
┌──────────────┐
│ 08:00        │ ← Fundo amarelo/laranja
│ 👤 João Silva│ ← Nome do aluno
│ [Liberar]    │ ← Botão para liberar
└──────────────┘
```

### Slot Preenchido (Pacote Personalizado)
```
┌──────────────┐
│ 08:00        │ ← Fundo cinza
│ 🔒 Maria     │ ← Nome do aluno
│ [Liberar]    │ ← Botão para liberar
└──────────────┘
```

### Slot Inativo
```
┌─────────┐
│ 08:00   │ ← Fundo cinza claro
│   ⚫    │ ← Switch inativo
└─────────┘
```

---

## 📊 Lógica de Implementação

### 1. Buscar Appointments Futuros

```javascript
const { data: futureAppointments } = await supabase
  .from('appointments')
  .select(`
    id, class_datetime, duration_minutes, status,
    student:profiles!student_id(full_name)
  `)
  .eq('professor_id', professorId)
  .gte('class_datetime', getBrazilDate().toISOString())
  .in('status', ['scheduled', 'pending', 'rescheduled']);
```

### 2. Mapear Appointments para Slots

```javascript
const slotOccupancy = {};

futureAppointments.forEach(apt => {
  const aptDate = parseISO(apt.class_datetime);
  const dayOfWeek = getDay(aptDate);
  const time = format(aptDate, 'HH:mm:ss');
  const duration = apt.duration_minutes || 30;
  const slotsNeeded = Math.ceil(duration / 15);
  
  // Marcar slot inicial e consecutivos
  for (let i = 0; i < slotsNeeded; i++) {
    const slotTime = addMinutes(aptDate, i * 15);
    const slotKey = `${dayOfWeek}-${format(slotTime, 'HH:mm:ss')}`;
    
    slotOccupancy[slotKey] = {
      appointmentId: apt.id,
      studentName: apt.student?.full_name,
      isFirstSlot: i === 0
    };
  }
});
```

### 3. Renderizar Slots com Informação

```javascript
{daySlots?.map(slot => {
  const slotKey = `${slot.day_of_week}-${slot.start_time}`;
  const occupation = slotOccupancy[slotKey];
  const isFilled = slot.status === 'filled';
  const isOccupied = !!occupation;
  const isActive = slot.status === 'active';
  
  return (
    <div className={cn(
      "p-2 rounded-md border",
      isFilled ? "bg-slate-200" :
      isOccupied ? "bg-orange-100" :
      isActive ? "bg-sky-50" : "bg-slate-50"
    )}>
      <span>{slot.start_time.substring(0, 5)}</span>
      
      {(isFilled || isOccupied) && (
        <>
          <div className="text-xs text-slate-600">
            {occupation?.studentName || "Ocupado"}
          </div>
          <Button onClick={() => handleLiberateSlot(slot, occupation)}>
            Liberar
          </Button>
        </>
      )}
      
      {!isFilled && !isOccupied && (
        <Switch
          checked={isActive}
          onCheckedChange={() => handleToggleSlot(slot)}
        />
      )}
    </div>
  );
})}
```

### 4. Função de Liberar

```javascript
const handleLiberateSlot = async (slot, occupation) => {
  if (occupation?.appointmentId) {
    // Liberar appointment agendado
    await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', occupation.appointmentId);
  } else {
    // Liberar slot filled (pacote personalizado)
    await supabase
      .from('class_slots')
      .update({ status: 'active' })
      .eq('id', slot.id);
  }
  
  // Atualizar dados
  onUpdate();
};
```

---

## 🔍 Validação para Reagendamento

### AulasTab - RescheduleDialog

```javascript
const fetchAvailableSlots = async (date) => {
  // 1. Buscar slots de preferência ATIVOS
  const { data: preferredSlots } = await supabase
    .from('class_slots')
    .select('start_time')
    .eq('professor_id', professorId)
    .eq('day_of_week', dayOfWeek)
    .eq('status', 'active'); // ← Só slots ativos
  
  // 2. Buscar appointments agendados para o dia
  const { data: appointmentsForDay } = await supabase
    .from('appointments')
    .select('class_datetime, duration_minutes, id')
    .eq('professor_id', professorId)
    .in('status', ['scheduled', 'rescheduled', 'pending'])
    .gte('class_datetime', `${dayString}T00:00:00-03:00`)
    .lte('class_datetime', `${dayString}T23:59:59-03:00`);
  
  // 3. Marcar slots ocupados
  const bookedSlots = new Set();
  appointmentsForDay.forEach(apt => {
    if (apt.id === currentAppointmentId) return; // Ignora a própria aula
    
    const startTime = parseISO(apt.class_datetime);
    const duration = apt.duration_minutes || 30;
    const slotsNeeded = Math.ceil(duration / 15);
    
    for (let i = 0; i < slotsNeeded; i++) {
      const occupiedTime = format(addMinutes(startTime, i * 15), 'HH:mm');
      bookedSlots.add(occupiedTime);
    }
  });
  
  // 4. Filtrar apenas slots ativos E livres
  const availableTimes = ALL_TIMES.filter(time => {
    // Verifica se está nas preferências (ativo)
    if (!preferredTimes.has(time)) return false;
    
    // Verifica se não está ocupado
    if (bookedSlots.has(time)) return false;
    
    // Verifica se há slots consecutivos livres para a duração
    for (let i = 0; i < slotsPerClass; i++) {
      const requiredSlotTime = format(addMinutes(parse(time, 'HH:mm', date), i * 15), 'HH:mm');
      if (bookedSlots.has(requiredSlotTime)) return false;
    }
    
    return true;
  });
  
  setAvailableTimes(availableTimes);
};
```

---

## ✅ Checklist de Implementação

- [ ] Modificar PreferenciasTab para buscar appointments futuros
- [ ] Criar mapeamento de slots ocupados
- [ ] Atualizar renderização de slots com cores diferentes
- [ ] Mostrar nome do aluno em slots ocupados
- [ ] Atualizar função de liberar para appointments
- [ ] Modificar AulasTab RescheduleDialog para validar slots
- [ ] Modificar HomePage para validar slots ao agendar
- [ ] Testar liberação de slots
- [ ] Testar reagendamento com validação
- [ ] Documentar mudanças

---

## 🎨 Cores Propostas

| Status | Cor de Fundo | Texto | Ícone |
|--------|--------------|-------|-------|
| Ativo (Livre) | `bg-sky-50` | `text-slate-700` | ⚪ Switch |
| Ocupado (Appointment) | `bg-orange-100` | `text-orange-800` | 👤 + Nome |
| Preenchido (Personalizado) | `bg-slate-200` | `text-slate-600` | 🔒 + Nome |
| Inativo | `bg-slate-50` | `text-slate-400` | ⚫ Switch |

---

## 📝 Observações Importantes

1. **Performance**: Buscar appointments futuros pode ser custoso. Considerar cache ou pagination.

2. **Tempo Real**: Usar Supabase Realtime para atualizar quando appointments mudam.

3. **Duração**: Considerar que aulas podem ter durações diferentes (30, 45, 60 min).

4. **Timezone**: Sempre usar UTC-3 nas comparações.

5. **Validação**: Sempre validar no backend também, não só no frontend.

---

**Próximo Passo:** Implementar as mudanças no código?

Você aprova esta abordagem ou prefere alguma modificação?
