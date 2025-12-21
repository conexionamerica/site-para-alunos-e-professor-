# 📋 Nova Funcionalidade: Dias de Aula e Alteração de Horários

## Data: 21 de Dezembro de 2025 - 15:16

---

## ✨ Novas Funcionalidades Implementadas

### 1. **Nova Coluna "Dias de Aula"**

Adicionada uma nova coluna na tabela de alunos que mostra:
- **Dias da semana** em que o aluno tem aula (Dom, Seg, Ter, Qua, Qui, Sex, Sáb)
- **Horário** das aulas (ex: 08:30)
- Exibição visual com badges para cada dia
- Ícone de relógio mostrando o horário

#### Exemplo de Exibição:
```
Seg  Qua  Sex
🕐 08:30
```

### 2. **Ferramenta para Alterar Dias e Horários**

Nova opção no menu de ações (⋮) de cada aluno:
- **"Alterar Dias/Horários"** - Disponível apenas para alunos com aulas agendadas
- Permite modificar os dias da semana e horário de todas as aulas agendadas
- Afeta **SOMENTE** aulas com status "agendada" (scheduled)
- Não afeta aulas completadas, canceladas ou faltadas

---

## 🎯 Como Funciona

### Visualização dos Dias de Aula

O sistema analisa automaticamente todas as aulas agendadas do aluno e extrai:
1. **Dias da semana** únicos em que o aluno tem aula
2. **Horário comum** das aulas
3. **Quantidade** de aulas agendadas

### Alteração de Horários

Quando o professor clica em "Alterar Dias/Horários":

1. **Dialog se abre** mostrando:
   - Quantidade de aulas que serão afetadas
   - Dias da semana atuais (pré-selecionados)
   - Horário atual (pré-selecionado)

2. **Professor pode modificar**:
   - Selecionar/desselecionar dias da semana
   - Escolher novo horário (07:00 a 23:45 em intervalos de 15 min)
   - Ver preview das mudanças

3. **Ao salvar**:
   - Sistema reorganiza todas as aulas agendadas
   - Mantém a estrutura semanal
   - Atualiza os horários para os novos dias/horas selecionados
   - Se houver mais aulas que dias selecionados, as extras são canceladas

---

## 📊 Exemplo Prático

### Situação Inicial:
- Aluno: João Silva
- Aulas agendadas: 12 aulas
- Dias: Segunda, Quarta, Sexta
- Horário: 08:30

### Alteração:
Professor decide mudar para:
- Novos dias: Terça, Quinta
- Novo horário: 14:00

### Resultado:
- As 12 aulas são reorganizadas
- Agora acontecem às Terças e Quintas às 14:00
- Mantém a sequência semanal
- Aulas extras (se houver) são canceladas

---

## 🔧 Detalhes Técnicos

### Arquivo Modificado
- **`AlunosTab.jsx`** → **`AlunosTab_UPDATED.jsx`**

### Novos Componentes

#### 1. `ChangeScheduleDialog`
Dialog para alterar dias e horários:
- Checkboxes para selecionar dias
- Select para escolher horário
- Preview das mudanças
- Confirmação antes de salvar

#### 2. Cálculo de Dias de Aula
```javascript
const weekDays = new Set();
scheduledAppointments.forEach(apt => {
  const aptDate = parseISO(apt.class_datetime);
  const dayOfWeek = getDay(aptDate);
  weekDays.add(dayOfWeek);
});
```

#### 3. Reorganização de Aulas
```javascript
// Agrupa aulas por semana
// Para cada semana, cria novas datas com os novos dias
// Atualiza cada aula individualmente
```

### Lógica de Atualização

1. **Agrupar por semana**: Aulas são agrupadas por semana (yyyy-ww)
2. **Calcular novas datas**: Para cada semana, calcula as novas datas baseadas nos dias selecionados
3. **Atualizar appointments**: Cada aula é atualizada com a nova data/hora
4. **Cancelar extras**: Se houver mais aulas que dias, as extras são canceladas

---

## 🎨 Interface

### Nova Coluna na Tabela

```
| Nome | Idade | Nível | Dias de Aula | Aulas Disponíveis | Estado | ... |
|------|-------|-------|--------------|-------------------|--------|-----|
| João | 25    | Inter | Seg Qua Sex  | 12                | Ativo  | ⋮   |
|      |       |       | 🕐 08:30     |                   |        |     |
```

### Menu de Ações

```
⋮ (Menu)
├── 📅 Alterar Dias/Horários  ← NOVO
├── ─────────────────────
├── ❌ Inativar Aluno
├── ─────────────────────
└── 💬 Enviar Mensagem
```

### Dialog de Alteração

```
┌─────────────────────────────────────┐
│ Alterar Dias e Horários             │
├─────────────────────────────────────┤
│ Aulas agendadas: 12                 │
│                                     │
│ Dias da Semana:                     │
│ ☐ Dom  ☑ Seg  ☑ Ter  ☑ Qua        │
│ ☐ Qui  ☑ Sex  ☐ Sáb                │
│                                     │
│ Horário: [08:30 ▼]                  │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Novo horário:                │    │
│ │ Seg, Ter, Qua, Sex às 08:30  │    │
│ └─────────────────────────────┘    │
│                                     │
│        [Cancelar] [Salvar]          │
└─────────────────────────────────────┘
```

---

## ✅ Checklist de Funcionalidades

- [x] Nova coluna "Dias de Aula" na tabela
- [x] Exibição de badges para cada dia
- [x] Exibição do horário com ícone
- [x] Opção "Alterar Dias/Horários" no menu
- [x] Dialog com seleção de dias (checkboxes)
- [x] Dialog com seleção de horário (select)
- [x] Preview das mudanças
- [x] Confirmação antes de salvar
- [x] Reorganização automática das aulas
- [x] Afeta SOMENTE aulas agendadas
- [x] Mantém estrutura semanal
- [x] Cancela aulas extras se necessário
- [x] Toast de sucesso/erro
- [x] Atualização automática da tabela

---

## 🧪 Como Testar

### 1. Verificar Coluna "Dias de Aula"

1. Ir ao painel do professor
2. Clicar na aba "Alunos"
3. Verificar que a nova coluna aparece
4. Confirmar que mostra os dias corretos
5. Confirmar que mostra o horário correto

### 2. Testar Alteração de Horários

1. Selecionar um aluno com aulas agendadas
2. Clicar no menu (⋮)
3. Clicar em "Alterar Dias/Horários"
4. Modificar dias e horário
5. Clicar em "Salvar"
6. Confirmar a operação
7. Verificar que as aulas foram atualizadas

### 3. Verificar Restrições

1. Tentar alterar horário de aluno sem aulas agendadas
   - Opção não deve aparecer no menu
2. Tentar salvar sem selecionar dias
   - Deve mostrar erro
3. Tentar salvar sem selecionar horário
   - Deve mostrar erro

---

## 🚀 Deploy

### Arquivos Criados

- **`AlunosTab_UPDATED.jsx`** - Nova versão com as funcionalidades

### Para Publicar

```bash
# 1. Fazer backup do arquivo original
copy "src\components\professor-dashboard\AlunosTab.jsx" "src\components\professor-dashboard\AlunosTab_OLD.jsx"

# 2. Reemplazar con la nueva versión
copy "src\components\professor-dashboard\AlunosTab_UPDATED.jsx" "src\components\professor-dashboard\AlunosTab.jsx"

# 3. Commit e push
git add .
git commit -m "feat: Adicionar coluna Dias de Aula e ferramenta para alterar horários"
git push
```

---

## 📝 Notas Importantes

### Comportamento Esperado

1. **Somente aulas agendadas** são afetadas
2. **Estrutura semanal** é mantida
3. **Aulas extras** são canceladas se necessário
4. **Confirmação** é solicitada antes de salvar

### Limitações

1. Não afeta aulas com outros status (completed, cancelled, missed)
2. Não cria novas aulas, apenas reorganiza as existentes
3. Se houver mais aulas que dias selecionados, as extras são canceladas

### Segurança

1. Confirmação obrigatória antes de salvar
2. Preview das mudanças antes de confirmar
3. Toast de sucesso/erro
4. Validação de campos obrigatórios

---

## 🎓 Exemplo de Uso

### Cenário 1: Mudança Simples

**Antes:**
- Dias: Seg, Qua, Sex
- Horário: 08:30
- Aulas: 12

**Ação:**
- Mudar para: Ter, Qui
- Novo horário: 14:00

**Depois:**
- Dias: Ter, Qui
- Horário: 14:00
- Aulas: 12 (reorganizadas)

### Cenário 2: Redução de Dias

**Antes:**
- Dias: Seg, Qua, Sex (3 dias/semana)
- Aulas: 12 (4 semanas × 3 dias)

**Ação:**
- Mudar para: Seg, Qua (2 dias/semana)

**Depois:**
- Dias: Seg, Qua
- Aulas: 8 mantidas, 4 canceladas

---

**Implementado por:** Antigravity AI  
**Data:** 21 de Dezembro de 2025  
**Hora:** 15:16 (UTC-3)
