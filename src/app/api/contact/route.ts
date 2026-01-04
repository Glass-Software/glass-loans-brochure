import { google } from "googleapis";
import { NextResponse } from "next/server";
import sgMail from "@sendgrid/mail";

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set in environment variables");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Google Sheets configuration
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY || "",
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Headers for the spreadsheet
const HEADERS = ["Timestamp", "Name", "Email", "Company", "Plan", "Message"];

async function ensureSheetExists() {
  if (!SPREADSHEET_ID) return;

  try {
    // Check if the sheet exists and get its properties
    const response = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const waitlistSheet = response.data.sheets?.find(
      (sheet) => sheet.properties?.title === "Waitlist",
    );

    if (!waitlistSheet) {
      // Create the sheet if it doesn't exist
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: "Waitlist",
                },
              },
            },
          ],
        },
      });
    }

    // Check if headers exist
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "Waitlist!A1:F1",
    });

    if (!headerResponse.data.values?.[0]?.length) {
      // Add headers if they don't exist
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: "Waitlist!A1:F1",
        valueInputOption: "RAW",
        requestBody: {
          values: [HEADERS],
        },
      });

      // Format headers
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: 6,
                  sheetId: waitlistSheet?.properties?.sheetId,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                    },
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat)",
              },
            },
            {
              updateSheetProperties: {
                properties: {
                  sheetId: waitlistSheet?.properties?.sheetId,
                  gridProperties: {
                    frozenRowCount: 1,
                  },
                },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    }
  } catch (error) {
    console.error("Error ensuring sheet exists:", error);
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company, message, plan } = body;
    const timestamp = new Date().toISOString();

    console.log("Processing form submission for:", email);

    // Send email via SendGrid
    const subjectLine = plan
      ? `New ${plan} Plan Inquiry: ${company || name}`
      : `New Contact Form Submission: ${company || "Individual"}`;

    const msg = {
      to: process.env.CONTACT_EMAIL || "info@glassloans.io",
      from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
      subject: subjectLine,
      text: `
Name: ${name}
Email: ${email}
Company: ${company}
${plan ? `Plan: ${plan}` : ''}
Message: ${message}
Timestamp: ${timestamp}
      `,
      html: `
<h2>${plan ? `New ${plan} Plan Inquiry` : 'New Contact Form Submission'}</h2>
<p><strong>Name:</strong> ${name}</p>
<p><strong>Email:</strong> ${email}</p>
<p><strong>Company:</strong> ${company}</p>
${plan ? `<p><strong>Plan:</strong> ${plan}</p>` : ''}
<p><strong>Message:</strong> ${message}</p>
<p><strong>Timestamp:</strong> ${timestamp}</p>
      `,
    };

    try {
      console.log("Sending email via SendGrid...");
      await sgMail.send(msg);
      console.log("Email sent successfully");
    } catch (emailError) {
      console.error(
        "SendGrid error details:",
        emailError.response?.body || emailError,
      );
      throw emailError;
    }

    // Add to Google Sheets
    if (SPREADSHEET_ID) {
      try {
        console.log("Ensuring sheet exists...");
        await ensureSheetExists();
        console.log("Sheet exists, appending data...");

        // Append the new row
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Waitlist!A:F",
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [[timestamp, name, email, company, plan || "", message]],
          },
        });
        console.log("Data appended to sheet successfully");
      } catch (error) {
        console.error(
          "Google Sheets error details:",
          error.response?.data || error,
        );
        // Don't throw the error - we still want to return success if email was sent
      }
    }

    // Send confirmation email to user
    try {
      console.log("Sending confirmation email...");
      if (process.env.SENDGRID_TEMPLATE_ID) {
        // If we have a template ID, use it
        const templateMsg = {
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
          templateId: process.env.SENDGRID_TEMPLATE_ID,
          dynamicTemplateData: {
            name,
            company,
          },
        };
        await sgMail.send(templateMsg);
      } else {
        // Otherwise send a regular email
        const regularMsg = {
          to: email,
          from: process.env.SENDGRID_FROM_EMAIL || "info@glassloans.io",
          subject: "Thank You for Reaching Out to Glass Loans!",
          text: `
Hi ${name},

Thank you for reaching out! We're excited to connect with you.

To schedule a call with Will, please book a time that works for you at: https://calendly.com/willcoleman202/30min

Alternatively, feel free to respond to this email with your phone number and we will reach out to you as soon as we can.

Looking forward to working together!

Best Regards,
The Glass Loans Team
          `,
          html: `
<h2>Thank You for Reaching Out!</h2>
<p>Hi ${name},</p>
<p>Thank you for reaching out! We're excited to connect with you.</p>
<p>To schedule a call with Will, please <a href="https://calendly.com/willcoleman202/30min" style="color: #4A6CF7; text-decoration: underline;">book a time that works for you</a>.</p>
<p>Alternatively, feel free to respond to this email with your phone number and we will reach out to you as soon as we can.</p>
<p><strong>Looking forward to working together!</strong></p>
<p>Best Regards,<br>The Glass Loans Team</p>
          `,
        };
        await sgMail.send(regularMsg);
      }
      console.log("Confirmation email sent successfully");
    } catch (confirmError) {
      console.error(
        "Confirmation email error:",
        confirmError.response?.body || confirmError,
      );
      // Don't throw - we've already processed the main submission
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form error details:", error.response?.body || error);
    return NextResponse.json(
      { error: "Failed to process contact form" },
      { status: 500 },
    );
  }
}
