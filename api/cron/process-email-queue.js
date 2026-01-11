// API Route para procesar la cola de emails pendientes
// Este endpoint también es llamado por un cron job

import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;

export default async function handler(req, res) {
    // Verificar autorización
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).json({ error: 'Unauthorized' });
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
                        <head>
                            <meta charset="utf-8">
                            <style>
                                body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px; }
                                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
                                .header { background: linear-gradient(135deg, #8b5cf6, #a855f7); color: white; padding: 30px; text-align: center; }
                                .header h1 { margin: 0; font-size: 24px; }
                                .content { padding: 30px; }
                                .student-card { background: linear-gradient(135deg, #faf5ff, #f3e8ff); border: 1px solid #e9d5ff; padding: 25px; margin: 20px 0; border-radius: 12px; }
                                .student-name { font-size: 22px; font-weight: bold; color: #7c3aed; margin-bottom: 15px; }
                                .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
                                .tips { background: #fefce8; border-left: 4px solid #eab308; padding: 15px; margin: 20px 0; border-radius: 8px; }
                                .footer { background: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="header">
                                    <h1>🎉 Parabéns! Você tem um novo aluno!</h1>
                                </div>
                                <div class="content">
                                    <p>Olá <strong>${data.professor_name}</strong>,</p>
                                    <p>Um novo aluno foi atribuído a você! Confira os detalhes:</p>
                                    
                                    <div class="student-card">
                                        <div class="student-name">👤 ${data.student_name}</div>
                                        <p><strong>📧 Email:</strong> ${data.student_email || 'Não informado'}</p>
                                    </div>
                                    
                                    <div class="tips">
                                        <strong>💡 Dica:</strong> Acesse o painel do professor para ver mais informações sobre o aluno e agendar a primeira aula.
                                    </div>
                                    
                                    <center>
                                        <a href="https://aluno.conexionamerica.com.br/professor-dashboard" class="button">
                                            📚 Acessar Painel do Professor
                                        </a>
                                    </center>
                                    
                                    <p style="margin-top: 30px; color: #64748b;">
                                        Boa sorte com seu novo aluno! Qualquer dúvida, estamos à disposição.
                                    </p>
                                </div>
                                <div class="footer">
                                    <p>© ${new Date().getFullYear()} Conexión América - Escola de Espanhol Online</p>
                                </div>
                            </div>
                        </body>
                        </html>
                    `;
                }

                // Enviar email
                const { data: sendResult, error: sendError } = await resend.emails.send({
                    from: 'Conexión América <suporte@conexionamerica.com.br>',
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
