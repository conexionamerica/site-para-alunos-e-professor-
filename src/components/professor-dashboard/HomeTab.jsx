// Arquivo: src/components/professor-dashboard/HomeTab.jsx

// Dentro da função handleUpdateRequestStatus, na seção: 
// if (newStatus === 'Aceita' && request.is_recurring) { ... }

// A linha que precisa ser ajustada é:
// const { data: allSlots, error: slotsError } = await supabase.from('class_slots').select('id, day_of_week, start_time').eq('professor_id', professorId);

// Deve ser substituída por:
// Filtra apenas slots 'active' ou 'filled' (que é o que está no banco, mas aqui estamos verificando a lógica de agendamento)

const { data: allSlots, error: slotsError } = await supabase.from('class_slots').select('id, day_of_week, start_time, status').eq('professor_id', professorId); // Puxa o status

// E a lógica para verificar se o slot pode ser reservado deve ser mais rigorosa.
// No entanto, o código a seguir está mais correto do que o comentário anterior (a verificação do status é feita implicitamente dentro do loop).
// Vamos nos focar apenas em garantir que a coluna 'status' esteja disponível na query, o que já foi adicionado acima.

// Vamos garantir que a query seja mais clara para evitar conflitos:
const newHandleUpdateRequestStatus = `const handleUpdateRequestStatus = async (solicitudId, newStatus) => {
    setUpdatingRequestId(solicitudId);
    const request = solicitudes.find(req => req.solicitud_id === solicitudId);

    if (!request) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Solicitação não encontrada.' });
      setUpdatingRequestId(null);
      return;
    }
    
    // 1. Atualiza o status da solicitação
    const { error: updateError } = await supabase
      .from('solicitudes_clase')
      .update({ status: newStatus })
      .eq('solicitud_id', solicitudId);

    if (updateError) {
      toast({ variant: 'destructive', title: 'Erro ao atualizar', description: updateError.message });
      setUpdatingRequestId(null);
      return;
    }

    // 2. Cria as aulas recorrentes se a solicitação for aceita
    if (newStatus === 'Aceita' && request.is_recurring) {
      try {
        const proposedSchedule = JSON.parse(request.horarios_propuestos);
        const studentId = request.alumno_id;

        const { data: billingData, error: billingError } = await supabase
          .from('billing').select('end_date, packages(number_of_classes, class_duration_minutes)')
          .eq('user_id', studentId)
          .gte('end_date', new Date().toISOString())
          .order('purchase_date', { ascending: false }).limit(1).single();

        if (billingError || !billingData) throw new Error("Fatura ativa do aluno não encontrada.");

        const endDate = parseISO(billingData.end_date);
        const totalClassesInPackage = billingData.packages.number_of_classes;
        const classDuration = billingData.packages.class_duration_minutes;
        const slotsPerClass = Math.ceil(classDuration / 15);
        
        // CORREÇÃO: Busca todos os slots, mas a lógica de verificação de 'active' ou 'filled'
        // para AGENDAR deve ser feita dentro do loop. Apenas precisamos garantir que
        // os slots buscados estejam disponíveis para uso (active).
        const { data: allSlots, error: slotsError } = await supabase.from('class_slots').select('id, day_of_week, start_time, status').eq('professor_id', professorId);
        if (slotsError) throw slotsError;
        
        const appointmentInserts = [];
        const slotIdsToUpdate = new Set();
        let currentDate = new Date();
        let classesScheduled = 0;

        while (currentDate <= endDate && classesScheduled < totalClassesInPackage) {
          const dayOfWeek = getDay(currentDate);

          if (proposedSchedule.days.includes(dayOfWeek)) {
            const startTime = proposedSchedule.time;
            // CORREÇÃO: Usar a data atual para garantir o fuso horário correto no parse
            const startTimeObj = parse(startTime, 'HH:mm:ss', currentDate); 

            const requiredSlots = [];
            let canBook = true;
            // Verifica todos os slots de 15 minutos necessários para a duração total da aula.
            for (let i = 0; i < slotsPerClass; i++) {
              const slotTime = format(add(startTimeObj, { minutes: i * 15 }), 'HH:mm:ss');
              // CORREÇÃO LÓGICA: Verifica se o slot está 'active' e não 'filled'
              const matchingSlot = allSlots.find(s => 
                s.day_of_week === dayOfWeek 
                && s.start_time === slotTime
                && (s.status === 'active' || s.status === 'filled') // Deve estar ATIVO ou já PREENCHIDO (se for a mesma aula que estamos re-agendando/criando)
              );
              
              if (!matchingSlot || matchingSlot.status === 'filled') {
                 // Permitimos o agendamento apenas se for 'active'
                 if (!matchingSlot || matchingSlot.status === 'filled') {
                    canBook = false; // Bloqueia se já estiver preenchido por outra aula
                    break;
                 }
              }
              requiredSlots.push(matchingSlot);
            }

            if (canBook) {
              const primarySlot = requiredSlots[0];
              const [hour, minute] = startTime.split(':').map(Number);
              // CORREÇÃO: Constrói o classDateTime no fuso horário do servidor/ISO
              const classDateTime = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, minute, 0); 

              appointmentInserts.push({
                student_id: studentId,
                professor_id: professorId,
                class_datetime: classDateTime.toISOString(),
                class_slot_id: primarySlot.id,
                status: 'scheduled',
                duration_minutes: classDuration,
              });

              // Adiciona TODOS os IDs dos slots (de início e subsequentes) para marcar como 'filled'
              requiredSlots.forEach(slot => slotIdsToUpdate.add(slot.id));
              classesScheduled++;
            }
          }
          currentDate = add(currentDate, { days: 1 });
        }

        if (appointmentInserts.length > 0) {
          const { error: insertError } = await supabase.from('appointments').insert(appointmentInserts, { onConflict: 'class_slot_id, class_datetime' });
          if (insertError) throw new Error(\`Falha ao criar aulas: \${insertError.message}\`);

          // Bloqueia TODOS os slots que fazem parte da duração da aula
          if (slotIdsToUpdate.size > 0) {
              const { error: updateSlotsError } = await supabase.from('class_slots').update({ status: 'filled' }).in('id', Array.from(slotIdsToUpdate));
              if (updateSlotsError) throw new Error(\`Falha ao bloquear horários: \${updateSlotsError.message}\`);
          }
          
          toast({ variant: 'default', title: 'Solicitação Aceita!', description: \`\${appointmentInserts.length} aulas agendadas e \${slotIdsToUpdate.size} horários bloqueados.\` });
        } else {
            toast({ variant: 'warning', title: 'Aulas não agendadas', description: 'Nenhum horário correspondente foi encontrado para criar as aulas.' });
        }
      } catch (e) {
        await supabase.from('solicitudes_clase').update({ status: 'Pendiente' }).eq('solicitud_id', solicitudId);
        toast({ variant: 'destructive', title: \`Erro ao processar agendamento\`, description: e.message });
      }
    } else if (newStatus === 'Rejeitada') {
      toast({ variant: 'destructive', title: 'Solicitação Rejeitada' });
    }
    
    // 3. Chama o onUpdate do componente pai para recarregar os dados
    if (onUpdate) onUpdate(solicitudId);
    setUpdatingRequestId(null);
  };`
