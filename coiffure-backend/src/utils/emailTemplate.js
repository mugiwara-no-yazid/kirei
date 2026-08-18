function renderEmail({ eyebrow = '', title, bodyHtml, accentColor = '#111111', ctaLabel, ctaUrl }) {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ee; padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border:1px solid #e5e0da;">

        <!-- Bandeau "night" -->
        <tr>
          <td style="background-color:#0d0d0d; padding:28px 32px; text-align:center;">
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:10px; letter-spacing:3px; text-transform:uppercase; color:#ffffff99;">
              Ultra Barber
            </p>
          </td>
        </tr>

        <!-- Eyebrow / label -->
        ${eyebrow ? `
        <tr>
          <td style="padding:32px 32px 0 32px;">
            <p style="margin:0; font-family:Arial, Helvetica, sans-serif; font-size:10px; letter-spacing:2.5px; text-transform:uppercase; color:#999999;">
              ${eyebrow}
            </p>
          </td>
        </tr>` : ''}

        <!-- Titre -->
        <tr>
          <td style="padding:12px 32px 0 32px;">
            <h1 style="margin:0; font-family:Georgia, 'Times New Roman', serif; font-size:26px; font-weight:700; line-height:1.25; color:#0d0d0d; text-transform:uppercase; letter-spacing:0.5px;">
              ${title}
            </h1>
            <div style="width:40px; height:2px; background-color:${accentColor}; margin:16px 0 0 0;"></div>
          </td>
        </tr>

        <!-- Corps -->
        <tr>
          <td style="padding:24px 32px 8px 32px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:1.65; color:#3a3a3a;">
            ${bodyHtml}
          </td>
        </tr>

        <!-- CTA style "underline" -->
        ${ctaLabel && ctaUrl ? `
        <tr>
          <td style="padding:16px 32px 32px 32px;">
            <a href="${ctaUrl}" style="font-family:Arial, Helvetica, sans-serif; font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:#0d0d0d; text-decoration:none; border-bottom:1px solid #0d0d0d; padding-bottom:3px;">
              ${ctaLabel} &nbsp;↗
            </a>
          </td>
        </tr>` : ''}

        <!-- Footer -->
        <tr>
          <td style="background-color:#f4f1ee; padding:20px 32px; border-top:1px solid #e5e0da; font-family:Arial, Helvetica, sans-serif; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#a3a3a3; text-align:center;">
            Lun — Sam · 09h00 — 20h00
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
  `;
}

module.exports = { renderEmail };