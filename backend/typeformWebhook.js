const { ChannelType, PermissionsBitField } = require('discord.js');

function processTypeformWebhook(webhookData) {
  const formResponse = {
    formName: webhookData.form_response.definition.title,
    submissionId: webhookData.form_response.token,
    answers: []
  };

  webhookData.form_response.answers.forEach(answer => {
    formResponse.answers.push({
      question: answer.field.title,
      answer: getAnswerValue(answer)
    });
  });

  return formResponse;
}

function getAnswerValue(answer) {
  switch (answer.type) {
    case 'choice':
      return answer.choice.label;
    case 'choices':
      return answer.choices.labels.join(', ');
    case 'date':
      return answer.date;
    case 'email':
      return answer.email;
    case 'url':
      return answer.url;
    case 'number':
      return answer.number;
    case 'boolean':
      return answer.boolean ? 'Yes' : 'No';
    case 'text':
    case 'long_text':
      return answer.text;
    default:
      return 'Unsupported answer type';
  }
}

async function sendTypeformResponseToDiscord(client, formResponse) {
  try {
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) throw new Error('Guild not found');

    const channelName = 'typeform-responses';
    let channel = guild.channels.cache.find(ch => ch.name === channelName);

    if (!channel) {
      channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            id: client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
          },
        ],
      });
    }

    const embed = {
      title: `New Response: ${formResponse.formName}`,
      color: 0x0099ff,
      fields: formResponse.answers.map(answer => ({
        name: answer.question,
        value: answer.answer,
      })),
      footer: {
        text: `Submission ID: ${formResponse.submissionId}`,
      },
      timestamp: new Date(),
    };

    await channel.send({ embeds: [embed] });
    console.log('Typeform response sent to Discord');
  } catch (error) {
    console.error('Error sending Typeform response to Discord:', error);
    throw error;
  }
}

module.exports = {
  processTypeformWebhook,
  sendTypeformResponseToDiscord
};