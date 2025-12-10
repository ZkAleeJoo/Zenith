const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { CONFIG, TYPE_COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('confirmar-pago')
        .setDescription('Sube tu comprobante de pago para recibir Premium.')
        .addAttachmentOption(option => 
            option.setName('comprobante')
                .setDescription('Imagen del voucher o recibo')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('plan')
                .setDescription('¿Qué plan compraste?')
                .setRequired(true)
                .addChoices(
                    { name: 'Zenith Premium (30 días)', value: 'premium_30' },
                    { name: 'Entrenador Maestro (70 días)', value: 'master_70' } 
                )),

    async execute(interaction) {
        const attachment = interaction.options.getAttachment('comprobante');
        const plan = interaction.options.getString('plan');
        
        if (!attachment.contentType.startsWith('image/')) {
            return interaction.reply({ content: '❌ Por favor sube una imagen válida.', ephemeral: true });
        }

        try {
            await interaction.user.send(`> \`|\` ⏳ **PAGO EN PROCESO:**\n
                > Hemos recibido tu comprobante para el plan **${plan}**.\n
                > Un administrador lo revisará pronto. Si es aprobado, recibirás un código por aquí.`);

            await interaction.reply({ content: '✅ **Comprobante enviado.** Revisa tus Mensajes Directos (DM), el bot te mantendrá informado.', ephemeral: true });
        } catch (e) {
            return interaction.reply({ content: '❌ No pude enviarte DM. Por favor abre tus mensajes privados para recibir el código.', ephemeral: true });
        }

        const adminChannel = interaction.client.channels.cache.get(CONFIG.ADMIN_LOGS_CHANNEL);
        if (!adminChannel) return console.error("Canal de logs no configurado.");

        const days = plan === 'premium_30' ? 30 : 70;

        const adminEmbed = new EmbedBuilder()
            .setTitle('NUEVO PAGO GENERADO')
            .setDescription(
                `**Usuario:** ${interaction.user} (\`${interaction.user.id}\`)\n
                **Plan:** ${plan}\n
                **Días a dar:** ${days}`)
            .setImage(attachment.url)
            .setColor(TYPE_COLORS.market_buy || 0xF1C40F)
            .setFooter({ text: 'Revisa la imagen antes de aprobar.' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`approve_pay_${days}_${interaction.user.id}`)
                .setLabel('✅ Aprobar y Enviar Código')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`reject_pay_${interaction.user.id}`)
                .setLabel('⛔ Rechazar')
                .setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [row] });
    },
};