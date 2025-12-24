const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create a transporter
    const port = process.env.SMTP_PORT || 587;
    const secure = port == 465; // True for 465, false for 587/25/2525

    console.log(`Attempting to connect to SMTP Host: ${process.env.SMTP_HOST}, Port: ${port}, Secure: ${secure}`);

    // Using generic SMTP configuration to support Brevo/SendGrid/Gmail
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            rejectUnauthorized: false // Non-strict SSL to avoid self-signed cert errors on some hosts
        },
        connectionTimeout: 30000, // 30 seconds
        family: 4, // Force IPv4 (Critical for Render)
        logger: true, // Log to console
        debug: true   // Include debug info
    });

    // Verify SMTP connection
    await transporter.verify();
    console.log(`SMTP Connected Successfully to ${process.env.SMTP_HOST}`);

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
