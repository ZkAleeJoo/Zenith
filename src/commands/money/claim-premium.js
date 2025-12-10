const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { redeemPremiumCode } = require('../../utils/dataHandler');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('claim-premium')
        .setDescription('Canjea un código de membresía Zenith Premium.')
        .addStringOption(option => 
            option.setName('code')
                .setDescription('El código que recibiste (ej: ZENITH-XXXX-XXXX)')
                .setRequired(true)),

    async execute(interaction) {
        const codeInput = interaction.options.getString('code').trim();

        const days = redeemPremiumCode(interaction.user.id, codeInput);

        if (!days) {
            return interaction.reply({ 
                content: '❌ **Código inválido o ya usado.** Verifica que lo escribiste bien.', 
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('💎 ¡Zenith Prime Activado!')
            .setDescription(`Has canjeado exitosamente **${days} días** de membresía.\n\n✨ Disfruta de tus beneficios VIP.`)
            .setColor(0xFF00FF) 
            .setImage('https://media1.tenor.com/m/f28w3bZ9iB0AAAAC/pokemon-card.gif') 
            .setFooter({ text: 'Gracias por apoyar el proyecto.' });

        await interaction.reply({ embeds: [embed] });
    },
};