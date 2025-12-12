const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, AttachmentBuilder } = require('discord.js');
const { getUserData } = require('../../utils/dataHandler');
const { createCollectionCard } = require('../../utils/canvasGenerator'); 
const { EMOJIS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tcg')
        .setDescription('Muestra tu álbum de cartas visualmente.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Ver el álbum de otro usuario')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = getUserData(targetUser.id);
        const cards = userData.cards; 

        if (!cards || cards.length === 0) {
            return interaction.editReply({ 
                content: `${EMOJIS.error} **${targetUser.username}** aún no tiene cartas. ¡Usa \`/open\` para empezar!`, 
            });
        }

        cards.sort((a, b) => a.id - b.id);

        const ITEMS_PER_PAGE = 9;
        const totalPages = Math.ceil(cards.length / ITEMS_PER_PAGE);
        let currentPage = 0;

        const generateMessagePayload = async (page) => {
            const start = page * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentCards = cards.slice(start, end);

            const buffer = await createCollectionCard(targetUser, currentCards, page + 1, totalPages);
            const attachment = new AttachmentBuilder(buffer, { name: 'album.png' });

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('prev')
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === 0), 
                    new ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Siguiente ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(page === totalPages - 1) 
                );

            return { files: [attachment], components: [row] };
        };

        const initialPayload = await generateMessagePayload(currentPage);
        await interaction.editReply(initialPayload);

        const response = await interaction.fetchReply();
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: '🚫 ¡Este no es tu álbum!', ephemeral: true });
            }

            await i.deferUpdate();

            if (i.customId === 'prev') {
                currentPage--;
            } else if (i.customId === 'next') {
                currentPage++;
            }

            const newPayload = await generateMessagePayload(currentPage);
            await interaction.editReply(newPayload);
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {}); 
        });
    },
};