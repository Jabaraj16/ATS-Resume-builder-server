require('dotenv').config();
const nodemailer = require('nodemailer');

const sendTestEmail = async () => {
    console.log("Checking environment variables...");
    console.log("SMTP_HOST:", process.env.SMTP_HOST);
    console.log("SMTP_PORT:", process.env.SMTP_PORT);
    console.log("SMTP_USER:", process.env.SMTP_USER);
    // Do not log the password for security, just check if it exists
    console.log("SMTP_PASS exists:", !!process.env.SMTP_PASS);

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error("ERROR: SMTP_USER or SMTP_PASS is missing in .env file.");
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const mailOptions = {
        from: `"Test Sender" <${process.env.SMTP_USER}>`,
        to: process.env.SMTP_USER, // Send to yourself to test
        subject: "Test Email from Resume Builder",
        text: "If you see this, your email configuration is working correctly!",
    };

    console.log("\nAttempting to send email...");
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log("SUCCESS: Email sent!");
        console.log("Message ID:", info.messageId);
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
    } catch (error) {
        console.error("FAILURE: Error sending email.");
        console.error(error);
    }
};

sendTestEmail();
