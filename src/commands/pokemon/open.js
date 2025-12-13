const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCard, removeCoins, getUserData } = require('../../utils/dataHandler');
const { EMOJIS, CONFIG, TYPE_COLORS } = require('../../utils/constants');

const cooldowns = new Map();

const TCG_COLORS = {
    'Colorless': 0xF0F0F0,
    'Darkness': 0x3E2723,
    'Dragon': 0xC4A484,
    'Fairy': 0xF8BBD0,
    'Fighting': 0xD32F2F,
    'Fire': 0xFF5722,
    'Grass': 0x4CAF50,
    'Lightning': 0xFFEB3B,
    'Metal': 0x9E9E9E,
    'Psychic': 0x9C27B0,
    'Water': 0x2196F3
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('open')
        .setDescription(`Abre un sobre de Cartas Oficiales TCG por ${CONFIG.PACK_PRICE} Monedas.`),

    async execute(interaction) {
        const userId = interaction.user.id;
        const userData = getUserData(userId);
        const isPremium = userData.isPremium;
        const userCooldown = isPremium ? 5000 : CONFIG.COOLDOWN_MS; 

        if (cooldowns.has(userId)) {
            const expirationTime = cooldowns.get(userId) + userCooldown;
            if (Date.now() < expirationTime) {
                const timeLeft = Math.ceil((expirationTime - Date.now()) / 1000);
                return interaction.reply({ 
                    content: `⏳ **Espera un poco** \`|\` Tu mazo se está barajando. Vuelve en **${timeLeft}s**.`, 
                    flags: 64 
                });
            }
        }

        const COST = CONFIG.PACK_PRICE;
        if (userData.balance < COST) {
            return interaction.reply({ 
                content: `${EMOJIS.error} **Fondos Insuficientes** \`|\` Necesitas **${COST}** monedas.`,
                flags: 64
            });
        }

        // 3. Cobrar y Poner Cooldown
        removeCoins(userId, COST);
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), userCooldown);

        await interaction.reply({ content: `**Abriendo sobre TCG...** \`[▉▉▉_______]\`` });

        try {
            const randomPage = Math.floor(Math.random() * 15000) + 1;
            
            const response = await fetch(`https://api.pokemontcg.io/v2/cards?page=${randomPage}&pageSize=1`);
            const json = await response.json();
            
            if (!json.data || json.data.length === 0) {
                throw new Error("Carta vacía recibida de la API");
            }

            const card = json.data[0];

            addCard(userId, card);


            let color = 0x2B2D31; 
            if (card.types && card.types.length > 0) {
                color = TCG_COLORS[card.types[0]] || 0x2B2D31;
            }

            let rarityIcon = "🔹";
            if (card.rarity?.includes("Rare")) rarityIcon = "⭐";
            if (card.rarity?.includes("V") || card.rarity?.includes("EX") || card.rarity?.includes("GX")) rarityIcon = "✨";
            if (card.rarity?.includes("Secret") || card.rarity?.includes("Rainbow")) rarityIcon = "🌈";

            const embed = new EmbedBuilder()
                .setTitle(`${rarityIcon} ¡NUEVA CARTA OBTENIDA!`)
                .setDescription(`Has conseguido: **${card.name}**\n*${card.set.series} - ${card.set.name}*`)
                .setColor(color)
                .setImage(card.images.large) 
                .addFields(
                    { name: 'Rareza', value: card.rarity || 'Desconocida', inline: true },
                    { name: 'Tipo', value: card.types ? card.types.join('/') : 'Trainer', inline: true },
                    { name: 'HP', value: card.hp || 'N/A', inline: true }
                )
                .setFooter({ text: `ID: ${card.id} • Precio Mercado (TCGPlayer): $${card.tcgplayer?.prices?.holofoil?.market || 'N/A'}` });

            setTimeout(async () => {
                await interaction.editReply({ content: `**Sobre Abierto** \`[▉▉▉▉▉▉▉▉▉]\` ¡Listo!`, embeds: [embed] });
            }, 1000);

        } catch (error) {
            console.error(error);
            addCoins(userId, COST); 
            await interaction.editReply({ content: `❌ **Error de fábrica:** El sobre estaba vacío. Se te han devuelto las monedas.` });
        }
    },
};