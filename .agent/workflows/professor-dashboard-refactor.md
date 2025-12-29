---
description: Refatoração do Portal do Professor - Nova estrutura de abas
---

# Refatoração do Portal do Professor

## Estrutura de Abas Proposta

### Para Superusuários:
1. **Painel** - Informações de pendências (alunos sem professor, pacotes expirando, etc.)
2. **Início** - Visão geral de todos os professores + filtro de professor
3. **Agenda** - Calendário semanal de todos os professores + filtro
4. **Conversas** - Todas as conversas + filtro de professor
5. **Alunos** - Todos os alunos + filtro de professor
6. **Aulas** - Todas as aulas + filtro de professor
7. **Administração** - Configurações, preferências, usuários e perfis + filtro de professor

### Para Professores:
- Mesmas abas (exceto Painel e Administração completa)
- Todas já filtradas para mostrar apenas os dados do professor logado

## Lógica de Login:
1. Verificar role do usuário (superadmin, professor, student)
2. Verificar permissões de abas em role_settings
3. Se professor: pré-filtrar todos os dados para o professor logado
4. Se superadmin: permitir filtro global por professor

## Arquivos a Modificar:
- `ProfessorDashboardPage.jsx` - Reorganizar abas e adicionar lógica de filtro global
- `HomeTab.jsx` - Separar "Painel" (pendências) de "Início" (métricas do professor)
- Criar novo componente `PainelTab.jsx` para pendências de superusuário
- Adicionar filtro de professor em todas as abas existentes
