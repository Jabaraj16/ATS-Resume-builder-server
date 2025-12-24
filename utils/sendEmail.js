const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create a transporter
    // Use Port 465 (SSL) and FORCE IPv4 (family: 4) to avoid Render/Gmail IPv6 timeout issues
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        },
        tls: {
            // fast fix for some self-signed cert issues (though gmail usually doesn't need this)
            // rejectUnauthorized: false
        },
        family: 4 // Force IPv4. Critical for some cloud environments.
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
