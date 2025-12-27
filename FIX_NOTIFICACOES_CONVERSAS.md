# Correção do Sistema de Notificações - Conversas

## Problema
A query atual busca na tabela `student_messages` que não existe. A tabela correta é `mensajes`.

## Solução

Substituir as linhas 250-262 em `ProfessorDashboardPage.jsx`:

```javascript
// ANTES (ERRADO):
const checkUnreadMessages = async () => {
    if (!user?.id) return;
    
    const { count, error } = await supabase
        .from('student_messages')  // ❌ Tabela errada
        .select('id', { count: 'exact', head: true })
        .eq('professor_id', user.id)
        .eq('read', false);
    
    if (!error) {
        setHasUnreadMessages(count > 0);
    }
};

// DEPOIS (CORRETO):
const checkUnreadMessages = async () => {
    if (!user?.id) return;
    
    // Buscar chats do professor
    const { data: chats, error: chatsError } = await supabase
        .from('chats')
        .select('chat_id')
        .eq('profesor_id', user.id);
    
    if (chatsError || !chats || chats.length === 0) {
        setHasUnreadMessages(false);
        return;
    }
    
    const chatIds = chats.map(c => c.chat_id);
    
    // Buscar mensagens não lidas (do aluno para o professor)
    // Conta mensagens que NÃO são do professor (ou seja, são do aluno)
    const { count, error } = await supabase
        .from('mensajes')  // ✅ Tabela correta
        .select('mensaje_id', { count: 'exact', head: true })
        .in('chat_id', chatIds)
        .neq('remitente_id', user.id);  // Mensagens que não são do professor
    
    if (!error) {
        setHasUnreadMessages(count > 0);
    }
};
```

## Também atualizar linha 272:
```javascript
// ANTES:
table: 'student_messages',  // ❌ Tabela errada

// DEPOIS:
table: 'mensajes',  // ✅ Tabela correta (JÁ CORRIGIDO)
```

## Como funciona

1. Busca todos os chats do professor
2. Pega os IDs desses chats
3. Conta quantas mensagens existem nesses chats que NÃO foram enviadas pelo professor
4. Se houver pelo menos 1 mensagem, mostra notificação

## Resultado

- ✅ Nome da aba "Conversas" fica em **azul escuro** quando há mensagens novas
- ✅ Badge "Nova" aparece ao lado
- ✅ Atualiza em tempo real quando nova mensagem chega
- ✅ Volta ao normal quando o professor abre a aba

