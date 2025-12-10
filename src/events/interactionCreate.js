const { Events, EmbedBuilder } = require('discord.js');
const { createPremiumCode } = require('../utils/dataHandler');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: Events.InteractionCreate,
    once: false,
    async execute(interaction) {

        // --- MANEJO DE COMANDOS DE CHAT ---
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Hubo un error ejecutando este comando', ephemeral: true });
                }
            }
        }

        // --- MANEJO DE BOTONES DE PAGO ---
        else if (interaction.isButton()) {
            if (interaction.customId.startsWith('approve_pay_')) {
                const parts = interaction.customId.split('_');
                const days = parseInt(parts[2]);
                const targetUserId = parts[3];

                const code = createPremiumCode(interaction.user.id, days);

                try {
                    const targetUser = await interaction.client.users.fetch(targetUserId);
                    
                    const dmEmbed = new EmbedBuilder()
                        .setTitle('PAGO APROBADO')
                        .setDescription(`Tu compra ha sido verificada. Aquí tienes tu código de activación:
                            \n\n# \`${code}\`\n\n
                            Cópialo y usa el comando:\n
                            **/claim-premium code: ${code}**`)
                        .setColor(0x2ECC71); 

                    await targetUser.send({ embeds: [dmEmbed] });

                    await interaction.update({ 
                        content: `✅ **Aprobado por ${interaction.user.username}**. Código enviado: \`${code}\``, 
                        components: [] 
                    });

                } catch (error) {
                    await interaction.reply({ content: '❌ Error: No pude enviar DM al usuario (bloqueado). Pásale el código manual: ' + code, ephemeral: true });
                }
            }

            if (interaction.customId.startsWith('reject_pay_')) {
                const targetUserId = interaction.customId.split('_')[2];

                try {
                    const targetUser = await interaction.client.users.fetch(targetUserId);
                    await targetUser.send('❌ **Pago Rechazado.**\nUn administrador ha revisado tu comprobante y no ha sido aprobado. Si crees que es un error, abre un ticket de soporte.');
                } catch (e) {}

                await interaction.update({ 
                    content: `⛔ **Rechazado por ${interaction.user.username}**.`, 
                    components: [] 
                });
            }
        }

    },
};