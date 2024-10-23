import { Client } from 'node-appwrite';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_SERVER,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_PORT == 465,
  auth: {
      user: process.env.SMTP_USERNAME,
      pass: process.env.SMTP_PASSWORD
  }
});

function emailEnabled() {
  const requiredEnvVars = [
    'SMTP_SERVER',
    'SMTP_PORT',
    'SMTP_USERNAME',
    'SMTP_PASSWORD',
    'SMTP_FROM_EMAIL',
    'SMTP_SYSADMIN_EMAIL'
  ];

  return requiredEnvVars.every(env => process.env[env] !== undefined);
}

export default async ({ req, res, log, error }) => {
  let subject;
  let text;
  try {
    const body = JSON.parse(req.body);
    
    // Check if userId exists in the request body
    if (!body || !body.subject || !body.text) {
      throw new Error("subject|text is missing in the request body.");
    }
    subject = body.subject;
    text = body.text;

  } catch (parseError) {
    error(`Failed to parse request body or missing subject or text: ${parseError.message}`);
    return res.json({ status: "fail", error: "Invalid request body or missing subject or text" });
  }

  if (emailEnabled()) {
    transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL,
      to: process.env.SMTP_SYSADMIN_EMAIL,
      subject: subject,
      text: text
    });

    return res.json({ status: "success" });
  }
  else {
    error("Email is not enabled. Please set the SMTP_* environment variables.");
    return res.json({ status: "fail", error: "Email is not enabled" });
  }
};
