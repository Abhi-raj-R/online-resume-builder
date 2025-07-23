import nodemailer from 'nodemailer';

// Create Gmail transporter
const createTransporter = async () => {
  // Create Gmail SMTP transporter
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER, // Your Gmail address
      pass: process.env.GMAIL_APP_PASSWORD // Your Gmail App Password
    }
  });
};

// Send verification email
export const sendVerificationEmail = async (email, verificationCode) => {
  try {
    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: '"Resume Builder" <noreply@resumebuilder.com>',
      to: email,
      subject: 'Verify Your Email',
      html: `
        <h2>Welcome to Resume Builder!</h2>
        <p>Please verify your email address by entering the following code:</p>
        <h3 style="background-color: #f4f4f4; padding: 10px; text-align: center; font-size: 24px;">${verificationCode}</h3>
        <p>This code will expire in 1 hour.</p>
        <p>If you didn't create an account, please ignore this email.</p>
      `,
    });

    // For development, log the Ethereal URL to view the email
    if (!process.env.SMTP_HOST) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }

    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};
