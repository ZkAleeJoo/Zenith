const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserData, processEvolution } = require('../../utils/dataHandler');
const { EMOJIS, TYPE_COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('evolve')
        .setDescription('Fusiona 3 cartas iguales para obtener su evolución.')
        .addStringOption(option => 
            option.setName('pokemon')
                .setDescription('El nombre del Pokémon a evolucionar (ej: Charmander)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const userId = interaction.user.id;
        const pokemonNameInput = interaction.options.getString('pokemon').toLowerCase();

        const userData = getUserData(userId);
        const candidates = userData.cards.filter(c => c.name.toLowerCase() === pokemonNameInput);

        if (candidates.length < 3) {
            return interaction.editReply({ 
                content: `${EMOJIS.error} **No puedes evolucionar.**\nNecesitas **3** copias de **${pokemonNameInput}** y solo tienes **${candidates.length}**.` 
            });
        }

        const cardsToBurn = candidates.slice(0, 3);
        const baseCard = cardsToBurn[0]; 

        try {
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${baseCard.id}`);
            const speciesData = await speciesRes.json();
            
            const evoChainRes = await fetch(speciesData.evolution_chain.url);
            const evoData = await evoChainRes.json();

            let evolutionName = null;
            
            const findEvolution = (chain) => {
                if (chain.species.name === baseCard.name.toLowerCase()) {
                    if (chain.evolves_to.length > 0) {
                        evolutionName = chain.evolves_to[0].species.name; 
                    }
                    return;
                }
                for (const nextLink of chain.evolves_to) {
                    findEvolution(nextLink);
                }
            };

            findEvolution(evoData.chain);

            if (!evolutionName) {
                return interaction.editReply({ content: `🚫 **${baseCard.name}** no puede evolucionar más (o es una evolución especial no soportada).` });
            }

            const newPokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${evolutionName}`);
            const newPokeData = await newPokeRes.json();

            const isShiny = Math.random() < 0.05;
            const typesFormatted = newPokeData.types.map(t => t.type.name.toUpperCase()).join(' | ');
            const finalName = newPokeData.name.charAt(0).toUpperCase() + newPokeData.name.slice(1);

            const newCardData = {
                id: newPokeData.id,
                name: finalName,
                isShiny: isShiny,
                types: typesFormatted
            };

            const success = processEvolution(userId, cardsToBurn.map(c => c.uniqueId), newCardData);

            if (success) {
                const embed = new EmbedBuilder()
                    .setTitle(`🧬 ¡Evolución Exitosa!`)
                    .setDescription(`Has fusionado **3x ${baseCard.name}**... \n\n✨ **¡Se han convertido en ${finalName}!** ✨`)
                    .setColor(TYPE_COLORS[newPokeData.types[0].type.name] || TYPE_COLORS.base)
                    .setThumbnail(newPokeData.sprites.other['official-artwork'].front_default)
                    .addFields({ name: 'Estado', value: isShiny ? '🌟 ¡Salió SHINY!' : 'Normal', inline: true });

                await interaction.editReply({ embeds: [embed] });
            } else {
                await interaction.editReply({ content: '❌ Hubo un error en la base de datos al procesar la evolución.' });
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Error conectando con la PokéAPI para verificar la evolución.' });
        }
    },
};