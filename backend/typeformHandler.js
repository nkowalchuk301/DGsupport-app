// typeformHandler.js
const { Client } = require('discord.js');

async function handleTypeformWebhook(req, res) {
  const webhookData = req.body;
  
  // Extract relevant information from webhook data
  const formResponses = webhookData.form_response.answers;
  const formTitle = webhookData.form_response.definition.title;
  const respondent = webhookData.form_response.hidden.email; // Assuming you use hidden fields to capture email
  
  // Format message to send to Discord
  let message = `New Typeform submission for **${formTitle}** from ${respondent}:\n`;
  formResponses.forEach(answer => {
    message += `\n**${answer.field.title}**: ${answer.text || answer.choice.label}`;
  });
  
  // Send message to Discord channel
  const channel = req.app.locals.discordClient.channels.cache.get(process.env.DISCORD_CHANNEL_ID); // Replace with your channel ID
  if (channel) {
    await channel.send(message);
  }
  
  res.status(200).send('Webhook received');
}

module.exports = handleTypeformWebhook;
