const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Responde con Pong! y la latencia.'),
    
    async execute(interaction) {
        await interaction.reply(`¡Pong! 🏓 Latencia: ${Date.now() - interaction.createdTimestamp}ms`);
    },
};