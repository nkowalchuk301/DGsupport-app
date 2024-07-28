const crypto = require('crypto');
const { Client } = require('discord.js');

function verifySignature(req, secret) {
  const signature = req.headers['typeform-signature'];
  const payload = JSON.stringify(req.body);
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const hash = `sha256=${hmac.digest('base64')}`;
  return hash === signature;
}

async function handleTypeformWebhook(req, res) {
  const secret = process.env.TYPEFORM_WEBHOOK_SECRET;

  if (!verifySignature(req, secret)) {
    return res.status(403).send('Invalid signature');
  }

  const webhookData = req.body;

  // Extract relevant information from webhook data
  const formResponses = webhookData.form_response.answers;
  const formTitle = webhookData.form_response.definition.title;
  const respondent = webhookData.form_response.hidden ? webhookData.form_response.hidden.email : 'Unknown'; // Assuming you use hidden fields to capture email
  
  // Format message to send to Discord
  let message = `New Typeform submission for **${formTitle}** from ${respondent}:\n`;
  formResponses.forEach(answer => {
    if (answer.type === 'choices') {
      message += `\n**${answer.field.title}**: ${answer.choices.labels.join(', ')}`;
    } else if (answer.type === 'choice') {
      message += `\n**${answer.field.title}**: ${answer.choice.label}`;
    } else {
      message += `\n**${answer.field.title}**: ${answer[answer.type]}`;
    }
  });

  // Send message to Discord channel
  const channel = req.app.locals.discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID); // Replace with your channel ID
  if (channel) {
    await channel.send(message);
  }

  res.status(200).send('Webhook received');
}

module.exports = handleTypeformWebhook;
