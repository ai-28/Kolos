"use client";

import emailjs from '@emailjs/browser';

/**
 * Format date for display
 */
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';

    try {
        // Handle serial dates
        if (/^\d+$/.test(dateStr)) {
            const serialNumber = parseInt(dateStr);
            const milliseconds = (serialNumber - 25569) * 86400000;
            const date = new Date(milliseconds);
            if (date.getFullYear() >= 1900 && date.getFullYear() <= 2100) {
                return date.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
        }

        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    } catch (e) {
        // If parsing fails, return as is
    }

    return dateStr;
}

/**
 * Build HTML email with signals
 */
export function buildSignalsEmailHTML({ clientName, magicLink, signals }) {
    const signalsCount = signals?.length || 0;

    console.log('📧 Building email HTML:', {
        clientName,
        hasMagicLink: !!magicLink,
        magicLinkPreview: magicLink?.substring(0, 50) + '...',
        signalsCount,
    });

    let signalsHTML = '';

    if (signals && signals.length > 0) {
        signals.forEach((signal, index) => {
            const date = formatDate(signal.date);
            const headline = signal.headline_source || `Signal ${index + 1}`;
            const signalType = signal.signal_type || 'N/A';
            const scores = signal.scores_R_O_A || 'N/A';
            const overall = signal.overall ? `${signal.overall}/5` : 'N/A';
            const nextStep = signal.next_step || '';
            const url = signal.url || '';
            const value = signal.estimated_target_value_USD || 'N/A';

            // Create activate link with signal data encoded
            // After login, this will open the deal modal with this signal
            const signalData = encodeURIComponent(JSON.stringify({
                headline_source: signal.headline_source || '',
                date: signal.date || '',
                signal_type: signal.signal_type || '',
                url: signal.url || '',
                scores_R_O_A: signal.scores_R_O_A || '',
                overall: signal.overall || '',
                next_step: signal.next_step || '',
                estimated_target_value_USD: signal.estimated_target_value_USD || '',
            }));
            // Build activate link - append signal data directly to magic link URL
            // When user clicks, they'll login via magic link, and signal data will be preserved
            // The auth callback will extract it and pass to dashboard
            const activateLink = magicLink ? (
                magicLink.includes('?')
                    ? `${magicLink}&activate_signal=${encodeURIComponent(signalData)}`
                    : `${magicLink}?activate_signal=${encodeURIComponent(signalData)}`
            ) : '';

            console.log('📧 Signal email HTML:', {
                index,
                hasUrl: !!url,
                url: url?.substring(0, 50),
                hasMagicLink: !!magicLink,
                hasActivateLink: !!activateLink,
            });

            signalsHTML += `
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px; background-color: #ffffff; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px; background-color: #f9f9f9;">
              <h2 style="margin: 0; font-family: Arial, sans-serif; font-size: 18px; font-weight: 600; color: #0a3d3d; line-height: 1.4; margin-bottom: 16px;">
                ${headline}
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 4px; padding: 16px;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600;">Date:</td>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">${date}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600;">Type:</td>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #333333; text-transform: capitalize;">${signalType}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600;">Scores (R,O,A):</td>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">${scores}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600;">Overall:</td>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #333333; font-weight: 600;">${overall}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${value !== 'N/A' ? `
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="120" style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600;">Value:</td>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #333333;">${value}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                ${nextStep ? `
                <tr>
                  <td style="padding: 12px 0 8px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600; padding-bottom: 4px;">Next Step:</td>
                      </tr>
                      <tr>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #333333; line-height: 1.5;">${nextStep}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                ${url ? `
                <tr>
                  <td style="padding: 8px 0 0 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-family: Arial, sans-serif; font-size: 13px; color: #666666; font-weight: 600; padding-bottom: 4px;">Source:</td>
                      </tr>
                      <tr>
                        <td style="font-family: Arial, sans-serif; font-size: 13px;">
                          <a href="${url}" style="color: #0a3d3d; text-decoration: underline; word-break: break-all;">${url}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ` : ''}
                ${activateLink ? `
                <tr>
                  <td style="padding: 16px 0 0 0;">
                    <a href="${activateLink}" style="display: inline-block; padding: 12px 24px; background-color: #0a3d3d; color: #ffffff; text-decoration: none; border-radius: 4px; font-family: Arial, sans-serif; font-size: 14px; font-weight: 600;">Activate Kolos →</a>
                  </td>
                </tr>
                ` : ''}
                </table>
              </td>
            </tr>
          </table>
        `;
        });
    }

    const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <tr>
                <td style="padding: 30px 30px 20px 30px; background-color: #0a3d3d; text-align: center;">
                  <h1 style="margin: 0; font-family: Arial, sans-serif; font-size: 24px; font-weight: 600; color: #ffffff;">
                    Welcome to Kolos, ${clientName || 'Valued Client'}!
                  </h1>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <p style="margin: 0 0 20px 0; font-family: Arial, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    We've identified <strong>8-10 signals</strong> that match your profile and could create valuable opportunities for your business. Here are the <strong>top ${signalsCount} signal${signalsCount !== 1 ? 's' : ''}</strong>:
                  </p>
                  <p style="margin: 0 0 30px 0; font-family: Arial, sans-serif; font-size: 16px; color: #333333; line-height: 1.6;">
                    Review the signals below and click the magic link to access your full dashboard.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding: 0 30px 30px 30px;">
                  ${signalsHTML}
                </td>
              </tr>
              <tr>
                <td style="padding: 0 30px 30px 30px; text-align: center;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="padding: 20px; background-color: #f9f9f9; border-radius: 8px;">
                        <p style="margin: 0 0 16px 0; font-family: Arial, sans-serif; font-size: 14px; color: #666666;">
                          Access your full dashboard to see all signals, deals, and opportunities:
                        </p>
                        ${magicLink ? `
                        <a href="${magicLink}" style="display: inline-block; padding: 14px 32px; background-color: #0a3d3d; color: #ffffff; text-decoration: none; border-radius: 6px; font-family: Arial, sans-serif; font-size: 16px; font-weight: 600; margin-bottom: 12px;">
                          Access Dashboard →
                        </a>
                        <p style="margin: 8px 0 0 0; font-family: Arial, sans-serif; font-size: 11px; color: #999999; line-height: 1.4;">
                          Or copy this link: <a href="${magicLink}" style="color: #0a3d3d; word-break: break-all; text-decoration: underline;">${magicLink}</a>
                        </p>
                        ` : `
                        <p style="margin: 0; font-family: Arial, sans-serif; font-size: 13px; color: #666666;">
                          Please check your email for the authentication link.
                        </p>
                        `}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding: 20px 30px; background-color: #f9f9f9; border-top: 1px solid #e0e0e0; text-align: center;">
                  <p style="margin: 0; font-family: Arial, sans-serif; font-size: 12px; color: #999999;">
                    This email was sent by Kolos. If you have any questions, please contact us.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

    return emailHTML;
}

/**
 * Send email via EmailJS (client-side)
 */
export async function sendSignalsEmail({ toEmail, clientName, magicLink, signals }) {
    const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
    const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
    const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

    console.log('📧 EmailJS Config Check:', {
        hasServiceId: !!EMAILJS_SERVICE_ID,
        hasTemplateId: !!EMAILJS_TEMPLATE_ID,
        hasPublicKey: !!EMAILJS_PUBLIC_KEY,
        serviceIdPrefix: EMAILJS_SERVICE_ID?.substring(0, 10),
    });

    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        const missing = [];
        if (!EMAILJS_SERVICE_ID) missing.push('NEXT_PUBLIC_EMAILJS_SERVICE_ID');
        if (!EMAILJS_TEMPLATE_ID) missing.push('NEXT_PUBLIC_EMAILJS_TEMPLATE_ID');
        if (!EMAILJS_PUBLIC_KEY) missing.push('NEXT_PUBLIC_EMAILJS_PUBLIC_KEY');

        throw new Error(`EmailJS environment variables not set: ${missing.join(', ')}. Please add them to .env.local`);
    }

    // Initialize EmailJS
    emailjs.init(EMAILJS_PUBLIC_KEY);

    // Build HTML email
    const emailHTML = buildSignalsEmailHTML({ clientName, magicLink, signals });

    console.log('📧 Email Details:', {
        to: toEmail,
        clientName: clientName,
        signalsCount: signals?.length || 0,
        htmlLength: emailHTML.length,
        magicLink: magicLink,
    });

    // Prepare template parameters
    // Try both approaches: HTML variable (for paid plans) and individual fields (for free tier)
    const templateParams = {
        to_email: toEmail,
        client_name: clientName || 'Valued Client',
        magic_link: magicLink,
        signals_count: signals?.length || 0,
        email_html: emailHTML, // For plans that support HTML variables

        // Individual signal fields (for free tier that doesn't support HTML variables)
        signal1_headline: signals?.[0]?.headline_source || '',
        signal1_date: formatDate(signals?.[0]?.date),
        signal1_type: signals?.[0]?.signal_type || '',
        signal1_scores: signals?.[0]?.scores_R_O_A || '',
        signal1_overall: signals?.[0]?.overall ? `${signals[0].overall}/5` : '',
        signal1_next_step: signals?.[0]?.next_step || '',
        signal1_url: signals?.[0]?.url || '',
        signal1_value: signals?.[0]?.estimated_target_value_USD || '',

        signal2_headline: signals?.[1]?.headline_source || '',
        signal2_date: formatDate(signals?.[1]?.date),
        signal2_type: signals?.[1]?.signal_type || '',
        signal2_scores: signals?.[1]?.scores_R_O_A || '',
        signal2_overall: signals?.[1]?.overall ? `${signals[1].overall}/5` : '',
        signal2_next_step: signals?.[1]?.next_step || '',
        signal2_url: signals?.[1]?.url || '',
        signal2_value: signals?.[1]?.estimated_target_value_USD || '',

        signal3_headline: signals?.[2]?.headline_source || '',
        signal3_date: formatDate(signals?.[2]?.date),
        signal3_type: signals?.[2]?.signal_type || '',
        signal3_scores: signals?.[2]?.scores_R_O_A || '',
        signal3_overall: signals?.[2]?.overall ? `${signals[2].overall}/5` : '',
        signal3_next_step: signals?.[2]?.next_step || '',
        signal3_url: signals?.[2]?.url || '',
        signal3_value: signals?.[2]?.estimated_target_value_USD || '',
    };

    console.log('📧 Template Params:', {
        to_email: templateParams.to_email,
        client_name: templateParams.client_name,
        signals_count: templateParams.signals_count,
        email_html_length: templateParams.email_html.length,
        has_email_html: !!templateParams.email_html,
    });

    try {
        console.log('📧 Sending via EmailJS...');
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
        );

        console.log('✅ EmailJS Response:', {
            status: response.status,
            text: response.text,
            response: response,
        });

        return { success: true, response };
    } catch (error) {
        console.error('❌ EmailJS Error Details:', {
            message: error.message,
            text: error.text,
            status: error.status,
            fullError: error,
        });
        throw new Error(`EmailJS failed: ${error.text || error.message || 'Unknown error'}`);
    }
}

