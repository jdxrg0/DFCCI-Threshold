const nodemailer = require('nodemailer');

const sendEmail = async (to, subject, html, retries = 3, backoff = 1000) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.log('No EMAIL_USER or EMAIL_APP_PASSWORD set. Mocking email send:');
      console.log(`To: ${to}, Subject: ${subject}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `DFCCI Threshold <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Email sending failed. Retrying in ${backoff}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return sendEmail(to, subject, html, retries - 1, backoff * 2);
    } else {
      console.error('Failed to send email via Nodemailer after retries:', error);
      console.log('\n--- DEVELOPMENT MODE: EMAIL FAILED TO SEND ---');
      console.log(`To: ${to}, Subject: ${subject}`);
      console.log('----------------------------------------------\n');
    }
  }
};

module.exports = sendEmail;
