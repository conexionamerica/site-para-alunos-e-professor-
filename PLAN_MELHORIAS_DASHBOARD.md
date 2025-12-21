# 📋 Melhorias no Dashboard do Professor - Planejamento

## Data: 21 de Dezembro de 2025 - 16:16

---

## 🎯 Mudanças Solicitadas

### 1. **Aba Início - Próximas 24 Horas**
- ✅ Manter quadro "Próxima Aula"
- ✅ Adicionar novo quadro "Próximas 24 Horas"
- ✅ Mostrar nome do aluno e horário
- ✅ Listar todas as aulas das próximas 24h

### 2. **Centralização de Todas as Abas**
- ✅ HomeTab
- ✅ AgendaTab (já centralizado)
- ✅ ConversasTab
- ✅ AlunosTab
- ✅ AulasTab
- ✅ PreferenciasTab

### 3. **Aba Conversas - Notificação**
- ✅ Nome da aba em azul escuro quando há mensagem nova
- ✅ Voltar à cor normal após ler
- ✅ Sistema de detecção de mensagens não lidas

### 4. **Aba Alunos - Aulas Agendadas**
- ✅ Mudar coluna "Aulas Disponíveis" para "Aulas Agendadas"
- ✅ Mostrar quantidade de aulas agendadas (status: scheduled)
- ✅ Mesma informação do indicador da tela do aluno

---

## 📝 Implementação

### Ordem de Execução:
1. HomeTab - Próximas 24h
2. Centralização de todas as abas
3. AlunosTab - Aulas Agendadas
4. ConversasTab - Notificações

---

## 🔧 Detalhes Técnicos

### 1. HomeTab - Próximas 24 Horas

**Query:**
```javascript
const { data: next24Hours } = await supabase
  .from('appointments')
  .select(`
    id, class_datetime, duration_minutes,
    student:profiles!student_id(full_name)
  `)
  .eq('professor_id', professorId)
  .gte('class_datetime', getBrazilDate().toISOString())
  .lte('class_datetime', add(getBrazilDate(), { hours: 24 }).toISOString())
  .in('status', ['scheduled', 'rescheduled'])
  .order('class_datetime', { ascending: true });
```

**UI:**
```jsx
<div className="bg-white rounded-lg shadow-sm p-6">
  <h3 className="font-bold mb-4">Próximas 24 Horas</h3>
  <div className="space-y-2">
    {next24Hours.map(apt => (
      <div key={apt.id} className="flex justify-between p-3 border rounded">
        <span>{apt.student?.full_name}</span>
        <span>{format(parseISO(apt.class_datetime), 'HH:mm')}</span>
      </div>
    ))}
  </div>
</div>
```

### 2. Centralização

**Wrapper para todas as abas:**
```jsx
<div className="flex justify-center">
  <div className="w-full max-w-[1400px]">
    {/* Conteúdo da aba */}
  </div>
</div>
```

### 3. ConversasTab - Notificações

**Estado:**
```javascript
const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
```

**Query:**
```javascript
const { data: unreadCount } = await supabase
  .from('messages')
  .select('id', { count: 'exact' })
  .eq('recipient_id', professorId)
  .eq('read', false);
```

**Tab com notificação:**
```jsx
<button className={hasUnreadMessages ? 'text-blue-800 font-bold' : ''}>
  Conversas
</button>
```

### 4. AlunosTab - Aulas Agendadas

**Cálculo:**
```javascript
const scheduledClasses = studentAppointments.filter(a => 
  a.status === 'scheduled'
).length;
```

**Coluna:**
```jsx
<TableHead>Aulas Agendadas</TableHead>
<TableCell>{student.scheduledClasses}</TableCell>
```

---

## ✅ Checklist

- [ ] HomeTab - Adicionar quadro Próximas 24h
- [ ] Centralizar HomeTab
- [ ] Centralizar ConversasTab
- [ ] Centralizar AlunosTab
- [ ] Centralizar AulasTab
- [ ] Centralizar PreferenciasTab
- [ ] AlunosTab - Mudar para Aulas Agendadas
- [ ] ConversasTab - Sistema de notificações
- [ ] Testar todas as mudanças
- [ ] Deploy

---

**Início:** 16:16  
**Estimativa:** 30-40 minutos
