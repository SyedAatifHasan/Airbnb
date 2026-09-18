const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;

function buildEmailHtml({ heading, message, link, buttonText }) {
  const fullLink = link ? `${APP_URL}${link}` : APP_URL;
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
      <h2 style="color: #ef4444; margin: 0 0 8px 0;">Airbnb Clone</h2>
      <h3 style="color: #1f2937; margin: 0 0 12px 0;">${heading}</h3>
      <p style="color: #4b5563; line-height: 1.5; margin: 0 0 20px 0;">${message}</p>
      ${link ? `
        <a href="${fullLink}"
          style="display: inline-block; background: #ef4444; color: #fff; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          ${buttonText || 'View Details'}
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">
          If the button doesn't work, copy this link into your browser:<br/>
          <a href="${fullLink}" style="color: #6366f1;">${fullLink}</a>
        </p>
      ` : ''}
    </div>
  `;
}

/**
 * @param {string} to - recipient email
 * @param {string} subject - email subject (also used as the heading)
 * @param {string} text - plain-text body / message
 * @param {object} [options]
 * @param {string} [options.link] - relative path in the app, e.g. "/bookings?bookingId=123"
 * @param {string} [options.buttonText] - label for the CTA button, e.g. "View Booking"
 */
exports.sendMail = (to, subject, text, options = {}) => {
  const { link, buttonText } = options;
  const html = buildEmailHtml({ heading: subject, message: text, link, buttonText });

  transporter.sendMail({
    from: `"Airbnb Clone" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text: link ? `${text}\n\nView here: ${APP_URL}${link}` : text,
    html,
  }).catch(err => console.log("Email send failed:", err));
};