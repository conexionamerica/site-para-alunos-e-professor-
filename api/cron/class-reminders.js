// API Route para enviar recordatorios de aula
// Este endpoint es llamado por un cron job cada minuto
// Vercel Cron: https://vercel.com/docs/cron-jobs

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// Configuración
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
    // Verificar que es una solicitud autorizada (cron job de Vercel)
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Solo permitir GET (cron jobs usan GET)
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Inicializar clientes
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const resend = new Resend(resendApiKey);

        // Obtener la hora actual en Brasil (GMT-3)
        const now = new Date();
        const brazilOffset = -3 * 60; // -3 horas en minutos
        const brazilTime = new Date(now.getTime() + (brazilOffset - now.getTimezoneOffset()) * 60000);

        // Calcular el rango de tiempo: clases que empiezan en 9-11 minutos
        const reminderMinutes = 10;
        const targetTime = new Date(brazilTime.getTime() + reminderMinutes * 60000);

        // Formato de fecha para la consulta
        const targetDateStr = targetTime.toISOString().split('T')[0];
        const targetHour = targetTime.getHours().toString().padStart(2, '0');
        const targetMinute = targetTime.getMinutes().toString().padStart(2, '0');
        const targetTimeStr = `${targetHour}:${targetMinute}`;

        console.log(`[Cron] Buscando aulas para ${targetDateStr} ${targetTimeStr}`);

        // Buscar aulas agendadas para los próximos 10 minutos
        const startRange = new Date(targetTime.getTime() - 1 * 60000).toISOString(); // -1 min
        const endRange = new Date(targetTime.getTime() + 1 * 60000).toISOString(); // +1 min

        const { data: appointments, error: appointmentsError } = await supabase
            .from('appointments')
            .select(`
                id,
                class_datetime,
                status,
                student_id,
                professor_id,
                reminder_sent
            `)
            .eq('status', 'scheduled')
            .gte('class_datetime', startRange)
            .lte('class_datetime', endRange)
            .is('reminder_sent', null);

        if (appointmentsError) {
            console.error('Error fetching appointments:', appointmentsError);
            return res.status(500).json({ error: 'Error fetching appointments' });
        }

        console.log(`[Cron] Encontradas ${appointments?.length || 0} aulas para notificar`);

        if (!appointments || appointments.length === 0) {
            return res.status(200).json({
                message: 'No classes to notify',
                checked_time: targetTimeStr,
                checked_date: targetDateStr
            });
        }

        // Procesar cada aula
        const results = [];
        for (const appointment of appointments) {
            try {
                // Obtener datos del profesor
                const { data: professor } = await supabase
                    .from('profiles')
                    .select('full_name, real_email')
                    .eq('id', appointment.professor_id)
                    .single();

                // Obtener datos del alumno
                const { data: student } = await supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', appointment.student_id)
                    .single();

                if (!professor?.real_email) {
                    console.log(`[Cron] Profesor sin email para appointment ${appointment.id}`);
                    continue;
                }

                // Formatear hora de la clase
                const classDate = new Date(appointment.class_datetime);
                const classTimeFormatted = classDate.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo'
                });
                const classDateFormatted = classDate.toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'America/Sao_Paulo'
                });

                // Enviar email
                const { data: emailResult, error: emailError } = await resend.emails.send({
                    from: 'Conexión América <suporte@conexionamerica.com.br>',
                    to: professor.real_email,
                    subject: `⏰ Lembrete: Aula em 10 minutos com ${student?.full_name || 'Aluno'}`,
                    html: `
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
                                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                                .header { background: linear-gradient(135deg, #0ea5e9, #3b82f6); color: white; padding: 30px; text-align: center; }
                                .header h1 { margin: 0; font-size: 24px; }
                                .content { padding: 30px; }
                                .info-box { background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 20px; margin: 20px 0; border-radius: 8px; }
                                .button { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
                                .footer { background: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>⏰ Sua aula começa em 10 minutos!</h1>
                                </div>
                                <div class="content">
                                    <p>Olá <strong>${professor.full_name}</strong>,</p>
                                    <p>Este é um lembrete de que sua aula está prestes a começar:</p>
                                    
                                    <div class="info-box">
                                        <p><strong>👤 Aluno:</strong> ${student?.full_name || 'Não identificado'}</p>
                                        <p><strong>📅 Data:</strong> ${classDateFormatted}</p>
                                        <p><strong>🕐 Horário:</strong> ${classTimeFormatted}</p>
                                    </div>
                                    
                                    <center>
                                        <a href="https://meet.google.com/tmi-xwmg-kua" class="button">🎥 Iniciar Aula no Google Meet</a>
                                    </center>
                                    
                                    <p style="margin-top: 30px; color: #64748b;">
                                        Prepare-se para uma ótima aula!
                                    </p>
                                </div>
                                <div class="footer">
                                    <p>© ${new Date().getFullYear()} Conexión América - Escola de Espanhol Online</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `
                });

                if (emailError) {
                    console.error(`[Cron] Error sending email for appointment ${appointment.id}:`, emailError);
                    results.push({ id: appointment.id, status: 'error', error: emailError.message });
                } else {
                    // Marcar como enviado
                    await supabase
                        .from('appointments')
                        .update({ reminder_sent: new Date().toISOString() })
                        .eq('id', appointment.id);

                    console.log(`[Cron] Email enviado para ${professor.real_email}`);
                    results.push({ id: appointment.id, status: 'sent', email: professor.real_email });
                }
            } catch (err) {
                console.error(`[Cron] Error processing appointment ${appointment.id}:`, err);
                results.push({ id: appointment.id, status: 'error', error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('[Cron] General error:', error);
        return res.status(500).json({ error: error.message });
    }
}
