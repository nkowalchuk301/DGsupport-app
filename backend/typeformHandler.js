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
    console.log("Webhook received with data:", req.body);

    if (!verifySignature(req, process.env.TYPEFORM_WEBHOOK_SECRET)) {
        console.warn("Failed signature verification for webhook from IP:", req.ip);
        return res.status(403).send('Invalid signature');
    }

    const webhookData = req.body;
    console.log("Signature verified. Processing data for form:", webhookData.form_response.form_id);

    try {
        const message = formatDiscordMessage(webhookData);
        const channel = req.app.locals.discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID);
        if (channel) {
            await channel.send(message);
            console.log("Message sent to Discord channel");
        } else {
            console.error("Discord channel not found");
        }
        res.status(200).send('Webhook processed');
    } catch (error) {
        console.error("Error processing webhook data:", error);
        res.status(500).send('Internal server error');
    }
}

function formatDiscordMessage(webhookData) {
    const formResponses = webhookData.form_response.answers;
    const formTitle = webhookData.form_response.definition.title;
    const respondent = webhookData.form_response.hidden ? webhookData.form_response.hidden.email : 'Unknown';
    let message = `New Typeform submission for **${formTitle}** from ${respondent}:\n`;
    formResponses.forEach(answer => {
        message += `\n**${answer.field.title}**: ${answer[answer.type] || answer.text || answer.choice.label || answer.choices.labels.join(', ')}`;
    });
    return message;
}


module.exports = handleTypeformWebhook;
