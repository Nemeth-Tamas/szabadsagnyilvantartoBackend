import nodemailer from 'nodemailer';

function emailEnabled(): boolean {
  const requiredEnvVars = [
    'SMTP_SERVER',
    'SMTP_PORT',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
    'SMTP_SYSADMIN_EMAIL'
  ];

  return requiredEnvVars.every((envVar) => {
    return process.env[envVar] !== undefined;
  });
}

export const sendMail = async (subject: string, text: string): Promise<void> => {
  if (!emailEnabled()) {
    console.log('Email not enabled');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_SERVER,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: parseInt(process.env.SMTP_PORT || '587', 10) == 465 ? true : false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
    }
  });

  transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: process.env.SMTP_SYSADMIN_EMAIL,
    subject,
    text
  });
};