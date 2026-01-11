// API Route para procesar la cola de emails pendientes
// Este endpoint también es llamado por un cron job

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
    // DEBUG: Ver qué está llegando
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;

    console.log('AUTH HEADER:', authHeader);
    console.log('CRON_SECRET exists:', !!cronSecret);
    console.log('CRON_SECRET length:', cronSecret?.length);

    // Si no hay CRON_SECRET configurado, permitir acceso (para debug)
    if (!cronSecret) {
        console.log('WARNING: CRON_SECRET not configured, allowing access');
    } else if (authHeader !== `Bearer ${cronSecret}`) {
        console.log('EXPECTED:', `Bearer ${cronSecret}`);
        console.log('RECEIVED:', authHeader);
        return res.status(401).json({
            error: 'Unauthorized',
            debug: {
                hasAuthHeader: !!authHeader,
                hasCronSecret: !!cronSecret,
                headerLength: authHeader?.length,
                secretLength: cronSecret?.length
            }
        });
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const resend = new Resend(resendApiKey);

        // Obtener emails pendientes (máximo 10 por ejecución)
        const { data: pendingEmails, error: fetchError } = await supabase
            .from('email_queue')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(10);

        if (fetchError) {
            console.error('Error fetching pending emails:', fetchError);
            return res.status(500).json({ error: 'Error fetching pending emails' });
        }

        console.log(`[Email Queue] Found ${pendingEmails?.length || 0} pending emails`);

        if (!pendingEmails || pendingEmails.length === 0) {
            return res.status(200).json({ message: 'No pending emails' });
        }

        const results = [];

        for (const email of pendingEmails) {
            try {
                let emailHtml = '';

                // Generar HTML según el tipo de email
                if (email.email_type === 'new_student_assigned') {
                    const data = email.data;
                    emailHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head><meta charset="utf-8"></head>
                        <body style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #7c3aed;">🎉 Novo aluno atribuído!</h2>
                            <p>Olá <strong>${data.professor_name}</strong>,</p>
                            <p>Um nuevo aluno foi atribuído a você:</p>
                            <div style="background: #f3e8ff; padding: 20px; border-radius: 10px;">
                                <p><strong>👤 Aluno:</strong> ${data.student_name}</p>
                                <p><strong>📧 Email:</strong> ${data.student_email || 'Não informado'}</p>
                            </div>
                            <p><a href="https://aluno.conexionamerica.com.br/professor-dashboard" style="background: #7c3aed; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Acessar Painel</a></p>
                        </body>
                        </html>
                    `;
                } else if (email.email_type === 'ticket_created') {
                    const data = email.data;
                    emailHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head><meta charset="utf-8"></head>
                        <body style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #0ea5e9;">🎫 Novo Ticket de Suporte</h2>
                            <p>Olá,</p>
                            <p>Um novo ticket foi criado por <strong>${data.requester_name}</strong>:</p>
                            <div style="background: #f0f9ff; padding: 20px; border-radius: 10px;">
                                <p><strong>🔢 Número:</strong> #${data.ticket_number}</p>
                                <p><strong>📝 Assunto:</strong> ${data.subject}</p>
                            </div>
                            <p><a href="https://aluno.conexionamerica.com.br/professor-dashboard" style="background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Ver Ticket</a></p>
                        </body>
                        </html>
                    `;
                } else if (email.email_type === 'ticket_status_updated') {
                    const data = email.data;
                    emailHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head><meta charset="utf-8"></head>
                        <body style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #10b981;">🔔 Status do Ticket Atualizado</h2>
                            <p>Olá <strong>${data.recipient_name}</strong>,</p>
                            <p>O status do seu ticket <strong>#${data.ticket_number}</strong> foi alterado:</p>
                            <div style="background: #ecfdf5; padding: 20px; border-radius: 10px;">
                                <p><strong>📊 Novo Status:</strong> ${data.new_status}</p>
                            </div>
                            <p><a href="https://aluno.conexionamerica.com.br/professor-dashboard" style="background: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Ver Atualização</a></p>
                        </body>
                        </html>
                    `;
                } else if (email.email_type === 'ticket_message') {
                    const data = email.data;
                    emailHtml = `
                        <!DOCTYPE html>
                        <html>
                        <head><meta charset="utf-8"></head>
                        <body style="font-family: sans-serif; padding: 20px;">
                            <h2 style="color: #3b82f6;">💬 Nova Mensagem no Ticket</h2>
                            <p>Olá <strong>${data.recipient_name}</strong>,</p>
                            <p>Você recebeu una nova resposta no ticket <strong>#${data.ticket_number}</strong> de <strong>${data.sender_name}</strong>.</p>
                            <p><a href="https://aluno.conexionamerica.com.br/professor-dashboard" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">Ler Mensagem</a></p>
                        </body>
                        </html>
                    `;
                }

                // Enviar email
                const { data: sendResult, error: sendError } = await resend.emails.send({
                    from: 'Conexión América <noreply@aluno.conexionamerica.com.br>',
                    to: email.recipient_email,
                    subject: email.subject,
                    html: emailHtml
                });

                if (sendError) {
                    // Marcar como fallido
                    await supabase
                        .from('email_queue')
                        .update({
                            status: 'failed',
                            error_message: sendError.message,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', email.id);

                    results.push({ id: email.id, status: 'failed', error: sendError.message });
                } else {
                    // Marcar como enviado
                    await supabase
                        .from('email_queue')
                        .update({
                            status: 'sent',
                            sent_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', email.id);

                    console.log(`[Email Queue] Email sent to ${email.recipient_email}`);
                    results.push({ id: email.id, status: 'sent', to: email.recipient_email });
                }
            } catch (err) {
                console.error(`[Email Queue] Error processing email ${email.id}:`, err);
                results.push({ id: email.id, status: 'error', error: err.message });
            }
        }

        return res.status(200).json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error) {
        console.error('[Email Queue] General error:', error);
        return res.status(500).json({ error: error.message });
    }
}
