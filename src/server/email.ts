import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT) || 1025,
  secure: false,
  auth: process.env.SMTP_USER
    ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      }
    : undefined,
});

export async function sendPasswordResetEmail(
  email: string,
  login: string,
  tokenOrPassword?: string,
  isNewCredentials = false
) {
  let subject = 'Восстановление пароля';
  let html = '';

  if (isNewCredentials) {
    subject = 'Новые учётные данные';
    html = `<p>Ваши новые данные для входа:</p>
            <p><strong>Логин:</strong> ${login}</p>
            <p><strong>Пароль:</strong> ${tokenOrPassword}</p>`;
  } else {
    const resetLink = `http://localhost:3000/reset-password?token=${tokenOrPassword}`;
    html = `<p>Для сброса пароля перейдите по ссылке:</p>
            <a href="${resetLink}">${resetLink}</a>
            <p>Ссылка действительна 30 минут.</p>`;
  }

  try {
    console.log("Attempting to send email to", email, "via", process.env.SMTP_HOST, process.env.SMTP_PORT);
    await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Расписание" <noreply@university.ru>',
      to: email,
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error('Email sending failed:', e);
    return false;
  }
}