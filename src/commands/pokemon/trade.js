const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { processTrade, getUserData } = require('../../utils/dataHandler');
const { EMOJIS, TYPE_COLORS } = require('../../utils/constants');
const { createTradeCard } = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trade')
        .setDescription('Inicia un intercambio profesional (Sistema GTS).')
        .addUserOption(option => 
            option.setName('usuario')
                .setDescription('Entrenador con el que establecer conexión')
                .setRequired(true)),

    async execute(interaction) {
        const userA = interaction.user;
        const userB = interaction.options.getUser('usuario');

        if (userB.id === userA.id) return interaction.reply({ content: `${EMOJIS.error} Error de conexión: Destino inválido.`, flags: 64 });
        if (userB.bot) return interaction.reply({ content: '🤖 Los sistemas automatizados no comercian.', flags: 64 });

        let tradeState = {
            [userA.id]: { cardId: null, cardName: null, confirmed: false },
            [userB.id]: { cardId: null, cardName: null, confirmed: false }
        };

        const inviteEmbed = new EmbedBuilder()
            .setTitle(`📡 SOLICITUD DE CONEXIÓN`)
            .setDescription(`**${userA.username}** quiere establecer un enlace de intercambio contigo.`)
            .setColor(TYPE_COLORS.base || 0x9B59B6)
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/10003/10003923.png') 
            .addFields({ name: 'Estado', value: '```diff\n- Esperando respuesta...\n```' });

        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_trade').setLabel('Establecer Conexión').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('deny_trade').setLabel('Rechazar').setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.reply({ content: `<@${userB.id}>`, embeds: [inviteEmbed], components: [inviteRow] });
        const inviteCollector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        inviteCollector.on('collect', async i => {
            if (i.user.id !== userB.id && i.user.id !== userA.id) {
                return i.reply({ content: '🔒 Acceso denegado.', flags: 64 });
            }

            if (i.customId === 'deny_trade') {
                inviteCollector.stop('cancelled');
                const deniedEmbed = new EmbedBuilder()
                    .setTitle('🔌 CONEXIÓN RECHAZADA')
                    .setColor('#FF0000')
                    .setDescription('El usuario ha declinado la solicitud.');
                await i.update({ content: null, embeds: [deniedEmbed], components: [] });
                return;
            }

            if (i.customId === 'accept_trade') {
                if (i.user.id !== userB.id) return i.reply({ content: 'Esperando al usuario destino...', flags: 64 });
                
                inviteCollector.stop('accepted'); 
                
                const updateTradePanel = () => {
                    const stateA = tradeState[userA.id];
                    const stateB = tradeState[userB.id];

                    const getStatusText = (state) => {
                        if (!state.cardName) return "⚪ Esperando selección...";
                        if (!state.confirmed) return `📦 ${state.cardName} (ID: ${state.cardId})`;
                        return `🔒 ${state.cardName} (LISTO)`;
                    };

                    const getStatusIcon = (state) => {
                        if (state.confirmed) return "🟢"; 
                        if (state.cardName) return "🟡"; 
                        return "🔴";                    
                    };

                    const tradeEmbed = new EmbedBuilder()
                        .setTitle('🔄 MESA DE INTERCAMBIO')
                        .setColor('#2B2D31') 
                        .setDescription('Seleccione un ítem del inventario para proceder.')
                        .addFields(
                            { 
                                name: `${getStatusIcon(stateA)} ${userA.username}`, 
                                value: `\`\`\`${getStatusText(stateA)}\`\`\``, 
                                inline: false 
                            },
                            { 
                                name: `${getStatusIcon(stateB)} ${userB.username}`, 
                                value: `\`\`\`${getStatusText(stateB)}\`\`\``, 
                                inline: false 
                            }
                        )
                        .setFooter({ text: 'Sistema de Intercambio Seguro • Zenith OS' });

                    const btnA = new ButtonBuilder()
                        .setCustomId(`offer_${userA.id}`)
                        .setLabel(stateA.cardName ? 'Cambiar Carta' : 'Seleccionar Carta')
                        .setStyle(ButtonStyle.Secondary); 

                    const btnB = new ButtonBuilder()
                        .setCustomId(`offer_${userB.id}`)
                        .setLabel(stateB.cardName ? 'Cambiar Carta' : 'Seleccionar Carta')
                        .setStyle(ButtonStyle.Secondary);

                    const btnConfirm = new ButtonBuilder()
                        .setCustomId('confirm_trade')
                        .setLabel('CONFIRMAR INTERCAMBIO')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true);

                    if (stateA.cardId && stateB.cardId) {
                        btnConfirm.setDisabled(false);
                        if (stateA.confirmed && stateB.confirmed) {
                            btnConfirm.setLabel('PROCESANDO...').setDisabled(true);
                        } else if (stateA.confirmed || stateB.confirmed) {
                            btnConfirm.setLabel('ESPERANDO CONFIRMACIÓN FINAL...').setStyle(ButtonStyle.Primary);
                        }
                    }

                    return { content: null, embeds: [tradeEmbed], components: [new ActionRowBuilder().addComponents(btnA, btnB, btnConfirm)] };
                };

                await i.update(updateTradePanel());

                const tradeCollector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });

                tradeCollector.on('collect', async btnInt => {
                    if (btnInt.customId.startsWith('offer_')) {
                        const ownerId = btnInt.customId.split('_')[1];
                        if (btnInt.user.id !== ownerId) return btnInt.reply({ content: '🔒 Acceso denegado: Panel ajeno.', flags: 64 });

                        const modal = new ModalBuilder()
                            .setCustomId(`modal_trade_${ownerId}`)
                            .setTitle('ACCESO A INVENTARIO');

                        const idInput = new TextInputBuilder()
                            .setCustomId('card_id_input')
                            .setLabel("ID DE LA CARTA")
                            .setPlaceholder('Ingresa el número identificador')
                            .setStyle(TextInputStyle.Short)
                            .setRequired(true);

                        modal.addComponents(new ActionRowBuilder().addComponents(idInput));
                        await btnInt.showModal(modal);

                        try {
                            const modalSubmit = await btnInt.awaitModalSubmit({ time: 60000, filter: m => m.user.id === ownerId });
                            const inputId = modalSubmit.fields.getTextInputValue('card_id_input');

                            const userData = getUserData(ownerId);
                            const card = userData.cards.find(c => c.id == inputId);

                            if (!card) {
                                await modalSubmit.reply({ content: `${EMOJIS.error} Error: Ítem #${inputId} no encontrado en base de datos.`, flags: 64 });
                                return;
                            }

                            tradeState[ownerId].cardId = card.id;
                            tradeState[ownerId].cardName = card.name + (card.isShiny ? ' ✨' : '');
                            tradeState[ownerId].confirmed = false; 
                            tradeState[userA.id === ownerId ? userB.id : userA.id].confirmed = false; 

                            await modalSubmit.update(updateTradePanel());

                        } catch (e) { }
                    }

                    if (btnInt.customId === 'confirm_trade') {
                        if (btnInt.user.id !== userA.id && btnInt.user.id !== userB.id) return;
                        
                        tradeState[btnInt.user.id].confirmed = true;

                        if (tradeState[userA.id].confirmed && tradeState[userB.id].confirmed) {
                            tradeCollector.stop('completed');
                            
                            const result = processTrade(
                                userA.id, tradeState[userA.id].cardId,
                                userB.id, tradeState[userB.id].cardId
                            );

                            if (result.success) {
                                const buffer = await createTradeCard(userA, result.cardA, userB, result.cardB);
                                const attachment = new AttachmentBuilder(buffer, { name: 'trade-success.png' });

                                const successEmbed = new EmbedBuilder()
                                    .setTitle(`${EMOJIS.check} TRANSFERENCIA COMPLETADA`)
                                    .setColor(0x2ECC71)
                                    .setImage('attachment://trade-success.png') 
                                    .setFooter({ text: 'Registro de transacción guardada.' });
                                
                                await btnInt.update({ embeds: [successEmbed], components: [], files: [attachment] });
                            } else {
                                await btnInt.update({ content: `${EMOJIS.error} Error Crítico: ${result.message}`, components: [] });
                            }
                        } else {
                            await btnInt.update(updateTradePanel());
                        }
                    }
                });
            }
        });
    },
};