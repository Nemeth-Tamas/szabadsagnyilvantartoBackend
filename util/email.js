const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_SERVER,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT == 465,
    auth: {
        user: process.env.SMTP_USERNAME,
        pass: process.env.SMTP_PASSWORD
    }
});

function sendEmail(subject, text) {
    console.log('Sending email');
    if (emailEmabled()) {
        transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL,
            to: process.env.SMTP_SYSADMIN_EMAIL,
            subject: subject,
            text: text
        });
    }

}

function emailEmabled() {
    // Check .env file and see if SMTP_SERVER, SMTP_PORT, SMTP_USE_AUTH, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL are set
    // If they are, return true
    // Otherwise, return false

    const requiredEnvVars = [
        'SMTP_SERVER',
        'SMTP_PORT',
        'SMTP_USERNAME',
        'SMTP_PASSWORD',
        'SMTP_FROM_EMAIL',
        'SMTP_SYSADMIN_EMAIL'
    ];

    return requiredEnvVars.every(envVar => process.env[envVar] !== undefined);
}

module.exports = {
    sendEmail
};