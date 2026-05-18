const EmailLog = require('../models/EmailLog');

// Central layout wrapper to unify and style all outgoing emails beautifully and responsively
const wrapInPremiumLayout = (subject, contentHtml) => {
  // If the HTML already contains our custom full layout table structure, return it as-is
  if (contentHtml.includes('table-layout:fixed') || contentHtml.includes('Your Dues Statement') || contentHtml.includes('Keep Your Streak Burning')) {
    return contentHtml;
  }

  // Otherwise, wrap in the premium, responsive, unified table-based email container
  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f8fafc;padding:30px 0;font-family:sans-serif;">
      <tr>
        <td align="center">
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #f0f0f0;border-radius:20px;padding:35px;box-shadow:0 10px 30px rgba(0,0,0,0.07);">
            <tr>
              <td align="center" style="padding-bottom:25px;border-bottom:1px solid #f1f5f9;">
                <h2 style="color:#0f172a;margin:0;font-size:20px;font-weight:800;font-family:sans-serif;letter-spacing:-0.5px;">DFCCI Threshold</h2>
              </td>
            </tr>
            <tr>
              <td align="left" style="color:#334155;font-size:15px;line-height:1.6;padding-top:25px;padding-bottom:25px;font-family:sans-serif;">
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td align="center" style="color:#94a3b8;font-size:11px;border-top:1px solid #f1f5f9;padding-top:20px;font-family:sans-serif;">
                This is an official system notification from <strong>DFCCI Threshold</strong>.<br/>
                Please do not reply directly to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
};

// We use a Google Apps Script web app proxy to bypass Render's strict firewall
// and send 100% verified emails directly from your Gmail account over Port 443.

const sendEmail = async (to, subject, html, retries = 3, backoff = 1000) => {
  const finalHtml = wrapInPremiumLayout(subject, html);

  try {
    if (!process.env.APPS_SCRIPT_URL) {
      console.log('--- DEVELOPMENT MODE: EMAIL FAILED TO SEND ---');
      console.log(`No APPS_SCRIPT_URL set. Ensure it is added to your Render Environment.`);
      console.log(`To: ${to}, Subject: ${subject}`);
      console.log('----------------------------------------------');
      
      // Log as successfully "sent" mock email in development for testing
      try {
        await EmailLog.create({
          to,
          subject,
          html: finalHtml,
          status: 'sent',
        });
      } catch (logError) {
        console.error('Failed to create mock email log in development:', logError.message);
      }
      return;
    }

    // Google Apps Script doesn't explicitly need headers, just the body
    const response = await fetch(process.env.APPS_SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        secret: process.env.EMAIL_APP_PASSWORD || 'dfcci_secret', // Security token
        to: to,
        subject: subject,
        html: finalHtml
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Apps Script Error: ${data.error}`);
    }

    console.log('Email sent successfully via Google Apps Script proxy!');

    // Log successfully sent email
    try {
      await EmailLog.create({
        to,
        subject,
        html: finalHtml,
        status: 'sent',
      });
    } catch (logError) {
      console.error('Failed to create email success log:', logError.message);
    }

    return data;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Apps Script proxy failed. Retrying in ${backoff}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return sendEmail(to, subject, html, retries - 1, backoff * 2);
    } else {
      console.error('Failed to send email via Apps Script proxy after retries:', error.message);
      
      // Log failed email attempt
      try {
        await EmailLog.create({
          to,
          subject,
          html: finalHtml,
          status: 'failed',
          error: error.message,
        });
      } catch (logError) {
        console.error('Failed to create email failure log:', logError.message);
      }
    }
  }
};

module.exports = sendEmail;

