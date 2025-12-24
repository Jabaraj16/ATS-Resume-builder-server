const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create a transporter
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    // 2. Define email options
    const mailOptions = {
        from: `Resume Builder <${process.env.SMTP_USER}>`,
        to: options.email,
        subject: options.subject,
        text: options.message,
        html: options.html // Optional: if we want to send HTML emails later
    };

    // 3. Send email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
