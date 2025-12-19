const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { redeemPremiumCode } = require('../../utils/dataHandler');
const { EMOJIS } = require('../../utils/constants');

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
                content: `${EMOJIS.error} **Código inválido o ya usado.** Verifica que lo escribiste bien.`, 
                flags: 64 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`${EMOJIS.premium} Suscripción premium activada`)
            .setDescription(`Has canjeado exitosamente **${days} días** de membresía.\n
                \n> **Disfruta de tus beneficios VIP**`)
            .setColor(0xFF00FF) 
            .setFooter({ text: 'Gracias por apoyar el proyecto.' });

        await interaction.reply({ embeds: [embed] });
    },
};