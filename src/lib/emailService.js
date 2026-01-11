// Servicio de envío de emails usando Resend
// Documentación: https://resend.com/docs

import { Resend } from 'resend';

// Inicializar Resend con la API key
const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

// Email del remitente
const FROM_EMAIL = 'Conexión América <suporte@conexionamerica.com.br>';

/**
 * Enviar email de recordatorio de aula (10 min antes)
 * @param {Object} params - Parámetros del email
 * @param {string} params.professorEmail - Email del profesor
 * @param {string} params.professorName - Nombre del profesor
 * @param {string} params.studentName - Nombre del alumno
 * @param {string} params.classTime - Hora de la clase (formato HH:mm)
 * @param {string} params.classDate - Fecha de la clase
 * @param {string} params.meetLink - Link de la reunión
 */
export const sendClassReminderEmail = async ({
    professorEmail,
    professorName,
    studentName,
    classTime,
    classDate,
    meetLink = 'https://meet.google.com/tmi-xwmg-kua'
}) => {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: professorEmail,
            subject: `⏰ Lembrete: Aula em 10 minutos com ${studentName}`,
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
                        .info-row { display: flex; margin: 10px 0; }
                        .info-label { font-weight: bold; color: #64748b; width: 100px; }
                        .info-value { color: #1e293b; }
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
                            <p>Olá <strong>${professorName}</strong>,</p>
                            <p>Este é um lembrete de que sua aula está prestes a começar:</p>
                            
                            <div class="info-box">
                                <div class="info-row">
                                    <span class="info-label">👤 Aluno:</span>
                                    <span class="info-value">${studentName}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">📅 Data:</span>
                                    <span class="info-value">${classDate}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">🕐 Horário:</span>
                                    <span class="info-value">${classTime}</span>
                                </div>
                            </div>
                            
                            <center>
                                <a href="${meetLink}" class="button">🎥 Iniciar Aula no Google Meet</a>
                            </center>
                            
                            <p style="margin-top: 30px; color: #64748b;">
                                Prepare-se para uma ótima aula! Se precisar de ajuda, entre em contato conosco.
                            </p>
                        </div>
                        <div class="footer">
                            <p>© ${new Date().getFullYear()} Conexión América - Escola de Espanhol Online</p>
                            <p>Este email foi enviado automaticamente. Por favor, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Error sending class reminder email:', error);
            return { success: false, error };
        }

        console.log('Class reminder email sent successfully:', data);
        return { success: true, data };
    } catch (error) {
        console.error('Error sending class reminder email:', error);
        return { success: false, error };
    }
};

/**
 * Enviar email de notificación de nuevo alumno asignado
 * @param {Object} params - Parámetros del email
 * @param {string} params.professorEmail - Email del profesor
 * @param {string} params.professorName - Nombre del profesor
 * @param {string} params.studentName - Nombre del alumno
 * @param {string} params.studentEmail - Email del alumno
 * @param {string} params.packageName - Nombre del paquete contratado
 * @param {string} params.schedule - Horario de las clases
 */
export const sendNewStudentEmail = async ({
    professorEmail,
    professorName,
    studentName,
    studentEmail,
    packageName = 'Não especificado',
    schedule = 'A definir'
}) => {
    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to: professorEmail,
            subject: `🎉 Novo aluno atribuído: ${studentName}`,
            html: `
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
                        .info-row { display: flex; margin: 8px 0; }
                        .info-label { font-weight: 600; color: #64748b; width: 120px; }
                        .info-value { color: #1e293b; }
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
                            <p>Olá <strong>${professorName}</strong>,</p>
                            <p>Um novo aluno foi atribuído a você! Confira os detalhes:</p>
                            
                            <div class="student-card">
                                <div class="student-name">👤 ${studentName}</div>
                                <div class="info-row">
                                    <span class="info-label">📧 Email:</span>
                                    <span class="info-value">${studentEmail}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">📦 Pacote:</span>
                                    <span class="info-value">${packageName}</span>
                                </div>
                                <div class="info-row">
                                    <span class="info-label">📅 Horário:</span>
                                    <span class="info-value">${schedule}</span>
                                </div>
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
                            <p>Este email foi enviado automaticamente. Por favor, não responda.</p>
                        </div>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Error sending new student email:', error);
            return { success: false, error };
        }

        console.log('New student email sent successfully:', data);
        return { success: true, data };
    } catch (error) {
        console.error('Error sending new student email:', error);
        return { success: false, error };
    }
};

export default { sendClassReminderEmail, sendNewStudentEmail };
