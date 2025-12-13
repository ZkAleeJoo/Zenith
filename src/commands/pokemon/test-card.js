const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
// Usamos tus constantes para mantener el estilo visual
const { TYPE_COLORS, EMOJIS } = require('../../utils/constants'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-card')
        .setDescription('🧪 Prueba de conexión con la API Real de TCG.')
        .addStringOption(option => 
            option.setName('nombre')
                .setDescription('Nombre del Pokémon a buscar (ej: Gengar)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const query = interaction.options.getString('nombre').toLowerCase();

        // URL de la API de TCG
        // Buscamos por nombre, ordenamos por fecha de lanzamiento descendente (cartas nuevas primero)
        const apiUrl = `https://api.pokemontcg.io/v2/cards?q=name:"${query}"&orderBy=-set.releaseDate&pageSize=1`;

        try {
            const response = await fetch(apiUrl, {
                headers: {
                    // Es importante usar la Key para que no te limiten las peticiones
                    'X-Api-Key': process.env.TCG_API_KEY || '' 
                }
            });

            if (!response.ok) throw new Error('Error en la API TCG');
            
            const json = await response.json();
            const cardData = json.data[0]; // Tomamos la primera carta encontrada

            if (!cardData) {
                return interaction.editReply({ 
                    content: `${EMOJIS.error || '❌'} No encontré ninguna carta física para **"${query}"**.` 
                });
            }

            // Mapeo de colores basado en tus constantes
            // La API TCG devuelve tipos en inglés (Fire, Water), tu bot los usa en minúsculas
            const mainType = cardData.types ? cardData.types[0].toLowerCase() : 'normal';
            const embedColor = TYPE_COLORS[mainType] || TYPE_COLORS.base;

            // Construcción del Embed con Arte Real
            const embed = new EmbedBuilder()
                .setTitle(`${cardData.name} - ${cardData.rarity || 'Common'}`)
                .setDescription(`**Set:** ${cardData.set.name} (${cardData.set.series})\n**ID:** \`${cardData.id}\``)
                .setColor(embedColor)
                .setImage(cardData.images.large) // ¡AQUÍ ESTÁ LA MAGIA! La carta completa.
                .setThumbnail(cardData.set.images.symbol) // El símbolo del set
                .addFields(
                    { 
                        name: '💰 Precio Promedio', 
                        value: cardData.tcgplayer?.prices?.holofoil?.market 
                            ? `$${cardData.tcgplayer.prices.holofoil.market} USD` 
                            : 'No disponible',
                        inline: true 
                    },
                    {
                        name: '🎨 Artista',
                        value: cardData.artist || 'Desconocido',
                        inline: true
                    }
                )
                .setFooter({ text: 'Verificado por Pokémon TCG API' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Hubo un error conectando con la base de datos de cartas reales.' });
        }
    },
};