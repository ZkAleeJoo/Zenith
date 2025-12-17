const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { getMarketListings, postToMarket, buyFromMarket, removeMarketListing } = require('../../utils/dataHandler');
const { EMOJIS, LEGENDARY_IDS, TYPE_COLORS, CONFIG } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('market')
        .setDescription('Sistema de Mercado Global')
        .addSubcommand(sub => 
            sub.setName('view')
                .setDescription('Ver las cartas en venta.'))
        .addSubcommand(sub => 
            sub.setName('sell')
                .setDescription('Vende una carta de tu colección.')
                .addIntegerOption(opt => opt.setName('pokemon_id').setDescription('El número de Pokédex de la carta (ej: 25)').setRequired(true))
                .addIntegerOption(opt => opt.setName('precio').setDescription('Precio en monedas').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('buy')
                .setDescription('Compra una carta usando su ID de Mercado.')
                .addStringOption(opt => opt.setName('id_mercado').setDescription('El código de la oferta (ej: A1B2C3)').setRequired(true)))
        .addSubcommand(sub => 
            sub.setName('remove')
                .setDescription('Cancela una venta y recupera tu carta.')
                .addStringOption(opt => opt.setName('id_mercado').setDescription('El código de la oferta a cancelar').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'sell') {
            const pokeId = interaction.options.getInteger('pokemon_id');
            const price = interaction.options.getInteger('precio');

            if (price < 1) return interaction.reply({ content: '🚫 El precio debe ser mayor a 0.', flags: 64 });

            const result = postToMarket(interaction.user.id, pokeId, price);

            if (!result.success) {
                return interaction.reply({ content: `${EMOJIS.error} **Error:** ${result.message}`, flags: 64 });
            }

            const embed = new EmbedBuilder()
                .setColor(TYPE_COLORS.market_sell || 0x2ECC71) 
                .setTitle(`${EMOJIS.market} Nueva Oferta Creada`)
                .setDescription(`Has puesto a la venta tu **${result.cardName}**.\n\n${EMOJIS.tag} **Precio:** ${price} ${EMOJIS.money}\n🆔 **ID Mercado:** \`${result.marketId}\``)
                .setFooter({ text: 'Otros jugadores pueden comprarla usando este ID.' });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'buy') {
            const marketId = interaction.options.getString('id_mercado').toUpperCase().trim();
            
            const result = buyFromMarket(interaction.user.id, marketId);

            if (!result.success) {
                return interaction.reply({ content: `${EMOJIS.error} **Error:** ${result.message}`, flags: 64 });
            }

            const embed = new EmbedBuilder()
                .setColor(TYPE_COLORS.market_buy || 0xF1C40F) 
                .setTitle(`🎉 ¡Compra Exitosa!`)
                .setDescription(`Has comprado **${result.card.name}** por **${result.price}** ${EMOJIS.money}.\n¡Ya está en tu colección!`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/10609/10609398.png');

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'remove') {
            const marketId = interaction.options.getString('id_mercado').toUpperCase().trim();

            const result = removeMarketListing(interaction.user.id, marketId);

            if (!result.success) {
                return interaction.reply({ content: `${EMOJIS.error} **Error:** ${result.message}`, flags: 64 });
            }

            const embed = new EmbedBuilder()
                .setColor(TYPE_COLORS.market_remove || 0xE74C3C) 
                .setTitle(`${EMOJIS.tag} Venta Cancelada`)
                .setDescription(`Has retirado tu **${result.cardName}** del mercado.\n\n✅ La carta ha vuelto a tu inventario`)
                .setFooter({ text: 'Zenith Market System' });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'view') {
            const listings = getMarketListings();

            if (listings.length === 0) {
                return interaction.reply({ content: `${EMOJIS.market} El mercado está vacío. ¡Sé el primero en vender algo!`, flags: 64 });
            }

            const ITEMS_PER_PAGE = CONFIG.MARKET_PAGINATION || 5; 
            const totalPages = Math.ceil(listings.length / ITEMS_PER_PAGE);
            let currentPage = 0;

            const generateEmbed = (page) => {
                const start = page * ITEMS_PER_PAGE;
                const end = start + ITEMS_PER_PAGE;
                const currentListings = listings.slice(start, end);

                const desc = currentListings.map(l => {
                    const shiny = l.card.isShiny ? EMOJIS.shiny : '';
                    const legend = LEGENDARY_IDS.includes(l.card.id) ? EMOJIS.legend : '';
                    
                    const sellerText = l.sellerId === interaction.user.id ? '**¡TU VENTA!**' : `Vendedor: <@${l.sellerId}>`;

                    return `🆔 \`${l.marketId}\` | **${l.card.name}** ${shiny}${legend}\n└ 💰 **${l.price}** - ${sellerText}`;
                }).join('\n\n');

                return new EmbedBuilder()
                    .setTitle(`${EMOJIS.market} Mercado Global`)
                    .setDescription(`Usa \`/market buy [ID]\` para comprar.\nUsa \`/market remove [ID]\` para cancelar tus ventas.\n\n${desc}`)
                    .setColor(0x3498DB)
                    .setFooter({ text: `Página ${page + 1} de ${totalPages} • ${listings.length} ofertas activas` });
            };

            const generateButtons = (page) => {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
                        new ButtonBuilder().setCustomId('next').setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1)
                    );
                return row;
            };

            const msg = await interaction.reply({ embeds: [generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
            const response = await interaction.fetchReply();
            
            const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: 'Solo quien abrió el menú puede cambiar de página.', flags: 64 });
                
                if (i.customId === 'prev') currentPage--;
                else currentPage++;

                await i.update({ embeds: [generateEmbed(currentPage)], components: [generateButtons(currentPage)] });
            });
        }
    },
};