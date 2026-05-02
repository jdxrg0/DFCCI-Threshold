// We use a Google Apps Script web app proxy to bypass Render's strict firewall
// and send 100% verified emails directly from your Gmail account over Port 443.

const sendEmail = async (to, subject, html, retries = 3, backoff = 1000) => {
  try {
    if (!process.env.APPS_SCRIPT_URL) {
      console.log('--- DEVELOPMENT MODE: EMAIL FAILED TO SEND ---');
      console.log(`No APPS_SCRIPT_URL set. Ensure it is added to your Render Environment.`);
      console.log(`To: ${to}, Subject: ${subject}`);
      console.log('----------------------------------------------');
      return;
    }

    // Google Apps Script doesn't explicitly need headers, just the body
    const response = await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        secret: process.env.EMAIL_APP_PASSWORD || 'dfcci_secret', // Security token
        to: to,
        subject: subject,
        html: html
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Apps Script Error: ${data.error}`);
    }

    console.log('Email sent successfully via Google Apps Script proxy!');
    return data;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Apps Script proxy failed. Retrying in ${backoff}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return sendEmail(to, subject, html, retries - 1, backoff * 2);
    } else {
      console.error('Failed to send email via Apps Script proxy after retries:', error.message);
    }
  }
};

module.exports = sendEmail;
