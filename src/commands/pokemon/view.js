const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js'); 
const { getUserData } = require('../../utils/dataHandler'); 
const { createCardSlab } = require('../../utils/canvasGenerator');
const { EMOJIS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view')
        .setDescription('Inspecciona una carta en detalle (Grado TCG).')
        .addStringOption(option =>
            option.setName('carta')
                .setDescription('Nombre (ej: Talonflame) o Número (ej: 663) de la carta.')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply(); 

        const input = interaction.options.getString('carta').trim().toLowerCase();
        const userId = interaction.user.id;

        const userData = getUserData(userId);
        
        let matches = userData.cards.filter(c => 
            c.id.toString() === input || 
            c.name.toLowerCase() === input
        );

        if (matches.length === 0) {
            return interaction.editReply({ 
                content: `${EMOJIS.error} **Carta no encontrada.**\nNo tienes a **"${input}"**. Prueba buscar por nombre exacto o ID de Pokédex.` 
            });
        }

        matches.sort((a, b) => (b.isShiny === true) - (a.isShiny === true));
        const selectedCard = matches[0];

        try {
            const cardForSlab = {
                name: selectedCard.name,
                pokemon_id: selectedCard.id,
                is_shiny: selectedCard.isShiny, 
                types: selectedCard.types,
                obtained_at: selectedCard.obtainedAt,
                uuid: selectedCard.uniqueId
            };

            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${selectedCard.id}`);
            if (!response.ok) throw new Error('API Error');
            const pokeApiData = await response.json();

            const buffer = await createCardSlab(cardForSlab, pokeApiData);
            const attachment = new AttachmentBuilder(buffer, { name: `slab-${selectedCard.id}.png` });

            await interaction.editReply({ 
                content: `🔍 **${selectedCard.name}** \`#${selectedCard.id}\` | 🆔 \`${selectedCard.uniqueId}\``, 
                files: [attachment] 
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: `${EMOJIS.error} Hubo un error generando la imagen.` });
        }
    },
};