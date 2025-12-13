const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCard, removeCoins, getUserData } = require('../../utils/dataHandler');
const { EMOJIS, LEGENDARY_IDS, TYPE_COLORS, CONFIG } = require('../../utils/constants');

const cooldowns = new Map();

function createProgressBar(value, max = 150) {
    const totalBars = 10;
    const progress = Math.min(Math.round((value / max) * totalBars), totalBars);
    const empty = totalBars - progress;
    return '`' + '■'.repeat(progress) + '□'.repeat(empty) + '`';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('open')
        .setDescription(`Abre una carta misteriosa por ${CONFIG.PACK_PRICE} Monedas.`),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = getUserData(userId);

        const isPremium = userData.isPremium; 
        
        const userCooldown = isPremium ? 30000 : CONFIG.COOLDOWN_MS;

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + userCooldown; 
            if (Date.now() < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - Date.now()) / 1000);
                return interaction.reply({ 
                    content: `⏳ **¡Ey! Vas muy rápido** \`|\` Espera **${timeLeft} segundos** para abrir otro sobre.${isPremium ? ' ⚡ (Cooldown VIP)' : ''}`, 
                    flags: 64 
                });
            }
        }

        const COST = CONFIG.PACK_PRICE;
        
        if (userData.balance < COST) {
            return interaction.reply({ 
                content: `${EMOJIS.error} Saldo insuficiente \`|\` Necesitas más monedas para abrir un sobre **-** usa \`/daily\` para conseguir más`,
                flags: 64
            });
        }

        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), userCooldown); 
        removeCoins(userId, COST);

        const loadingMsg = isPremium 
            ? `${EMOJIS.card} \`|\` **Invocando carta...** *-${COST}* ${EMOJIS.money}`
            : `${EMOJIS.card} \`|\` **Invocando carta...** *-${COST}* ${EMOJIS.money}`;

        await interaction.reply({ content: loadingMsg });

        try {
            const legendChance = isPremium ? 0.02 : 0.01;
            const shinyChance = isPremium ? 0.01 : 0.005;

            let isLegendary = Math.random() < legendChance; 
            const isShiny = Math.random() < shinyChance;

            let pokemonId;
            if (isLegendary) {
                pokemonId = LEGENDARY_IDS[Math.floor(Math.random() * LEGENDARY_IDS.length)];
            } else {
                pokemonId = Math.floor(Math.random() * 1024) + 1;
            }
            if (LEGENDARY_IDS.includes(pokemonId)) isLegendary = true;

            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
            const data = await response.json();

            const pokeName = data.name.charAt(0).toUpperCase() + data.name.slice(1);
            const typeMain = data.types[0].type.name; 
            const typesFormatted = data.types.map(t => t.type.name.toUpperCase()).join(' | ');

            const image = isShiny 
                ? data.sprites.other['home'].front_shiny 
                : data.sprites.other['official-artwork'].front_default;

            let embedColor = TYPE_COLORS[typeMain] || TYPE_COLORS.base;
            if (isLegendary) embedColor = TYPE_COLORS.legendary; 
            if (isShiny) embedColor = TYPE_COLORS.shiny;     

            const hp = data.stats[0].base_stat;
            const atk = data.stats[1].base_stat;
            const def = data.stats[2].base_stat;
            const spd = data.stats[5].base_stat;

            const newCardData = {
                id: data.id,
                name: pokeName,
                isShiny: isShiny,
                types: typesFormatted
            };

            const isNew = addCard(userId, newCardData);

            const titleIcon = isLegendary ? EMOJIS.rare_legend : (isShiny ? EMOJIS.cool : EMOJIS.classic);
            
            const embed = new EmbedBuilder()
                .setTitle(`${titleIcon} ${isLegendary ? '¡POKÉMON RARO INVOCADO!' : ''} ${pokeName} #${data.id}`)
                .setColor(embedColor)
                .setImage(image) 
                .addFields(
                    { name: `${EMOJIS.ball} Tipo`, value: `**${typesFormatted}**`, inline: true },
                    { name: `${EMOJIS.measure} Peso/Altura`, value: `${data.weight / 10}kg | ${data.height / 10}m`, inline: true },
                    { name: `${EMOJIS.stats} Estadísticas Base`, value: `**HP:** ${createProgressBar(hp)} **${hp}**\n**ATK:** ${createProgressBar(atk)} **${atk}**\n**DEF:** ${createProgressBar(def)} **${def}**\n**VEL:** ${createProgressBar(spd)} **${spd}**`, inline: false }
                );

            let rarityText = 'Rareza: Común';
            if (isLegendary) rarityText = 'Rareza: 👑 RARA';
            if (isShiny) rarityText += ' | ✨ SHINY';

            const collectionStatus = isNew ? "✅ NUEVA (Guardada)" : "⚠️ REPETIDA (Descartada)";
            
            let footerText = `Zenith TCG • ${rarityText} • ${collectionStatus}`;
            if (isPremium) footerText += " • 👑 Zenith Vip";

            embed.setFooter({ 
                text: footerText, 
                iconURL: 'https://img.pokemondb.net/sprites/scarlet-violet/normal/gengar.png' 
            });

            if (isLegendary && isShiny) {
                embed.setAuthor({ name: `¡¡INCREIBLE!! POKÉMON RARO VARIOCOLOR`, iconURL: 'https://cdn-icons-png.flaticon.com/512/1694/1694364.png' });
                embed.setDescription(`**¡Has roto el juego! Un pokémon raro shiny ha aparecido.**\n${EMOJIS.cool}${EMOJIS.cool}${EMOJIS.cool}`);
            } else if (isLegendary) {
                embed.setAuthor({ name: `¡FELICIDADES! ENERGÍA MASIVA DETECTADA`, iconURL: 'https://cdn-icons-png.flaticon.com/512/1694/1694364.png' });
            } else if (isShiny) {
                embed.setAuthor({ name: `¡QUÉ SUERTE! VARIOCOLOR`, iconURL: 'https://cdn-icons-png.flaticon.com/512/1694/1694364.png' });
            }

            setTimeout(async () => {
                await interaction.editReply({ content: null, embeds: [embed] });
            }, 1500);

        } catch (error) {
            console.error(error);
            addCoins(userId, COST);
            cooldowns.delete(userId); 
            await interaction.editReply({ content: `${EMOJIS.error} **¡El Pokémon escapó!** Hubo un error de conexión y te hemos devuelto tus monedas.` });
        }
    },
};