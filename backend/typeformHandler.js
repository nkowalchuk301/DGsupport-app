const crypto = require('crypto');
const { Client } = require('discord.js');

function verifySignature(req, secret) {
    if (!secret) {
      console.error("Secret key is undefined. Check environment variable TYPEFORM_WEBHOOK_SECRET.");
      return false;
    }
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
    const formResponses = webhookData.form_response.answers;
    const formTitle = webhookData.form_response.definition.title;
    let message = `New Typeform submission for **${formTitle}**:\n`;

    formResponses.forEach(answer => {
        message += `\n**${answer.field.title}**: ${answer[answer.type] || answer.text || answer.choice.label || answer.choices.labels.join(', ')}`;
    });

    try {
        const channelName = 'typeform-results';
        let channel = req.app.locals.discordClient.channels.cache.find(ch => ch.name === channelName && ch.type === 'GUILD_TEXT');

        if (!channel) {
            // Create the channel if it doesn't exist
            const guild = req.app.locals.discordClient.guilds.cache.first(); // Assumes your bot is only in one guild
            channel = await guild.channels.create(channelName, {
                type: 'GUILD_TEXT', // 'text' for v12 of Discord.js
                topic: 'Channel for posting Typeform results'
            });
            console.log("Created new channel:", channelName);
        }

        // Send message to the channel
        await channel.send(message);
        console.log("Message sent to Discord channel:", channel.name);
        res.status(200).send('Webhook received and processed');
    } catch (error) {
        console.error("Failed to handle webhook:", error);
        res.status(500).send('Failed to handle webhook');
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
