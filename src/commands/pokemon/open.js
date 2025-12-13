const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addCard, removeCoins, getUserData, addCoins: refundCoins } = require('../../utils/dataHandler');
const { EMOJIS, CONFIG } = require('../../utils/constants');
require('dotenv').config();

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

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
                    content: `⏳ **Cooldown** \`|\` Espera **${timeLeft}s** para abrir otro sobre.`, 
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

        removeCoins(userId, COST);
        cooldowns.set(userId, Date.now());
        setTimeout(() => cooldowns.delete(userId), userCooldown);

        await interaction.reply({ content: `🎒 **Abriendo sobre TCG...** \`[▉▉▉_______]\`` });

        try {
            console.log(`[OPEN] Buscando carta para ${interaction.user.tag}...`);

            const randomPage = Math.floor(Math.random() * 10000) + 1;
            
            const options = {
                method: 'GET',
                headers: {
                    'X-Api-Key': process.env.POKEMON_TCG_API_KEY || ''
                }
            };

            const response = await fetch(`https://api.pokemontcg.io/v2/cards?page=${randomPage}&pageSize=1`, options);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const json = await response.json();
            
            if (!json.data || json.data.length === 0) {
                throw new Error("La API no devolvió cartas (Página vacía).");
            }

            const card = json.data[0];

            addCard(userId, card);

            let color = 0x2B2D31; 
            if (card.types && card.types.length > 0) {
                color = TCG_COLORS[card.types[0]] || 0x2B2D31;
            }

            let rarityIcon = "🔹";
            const rarity = card.rarity ? card.rarity.toLowerCase() : "";
            if (rarity.includes("rare")) rarityIcon = "⭐";
            if (rarity.includes("v") || rarity.includes("ex") || rarity.includes("gx")) rarityIcon = "✨";
            if (rarity.includes("secret") || rarity.includes("rainbow")) rarityIcon = "🌈";

            let priceText = "N/A";
            if (card.tcgplayer && card.tcgplayer.prices) {
                const prices = card.tcgplayer.prices;
                const priceObj = prices.holofoil || prices.normal || prices.reverseHolofoil || prices['1stEditionHolofoil'];
                if (priceObj && priceObj.market) {
                    priceText = `$${priceObj.market}`;
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`${rarityIcon} ¡${card.name.toUpperCase()}!`)
                .setDescription(`*${card.set.series}: ${card.set.name}*`)
                .setColor(color)
                .setImage(card.images.large) 
                .addFields(
                    { name: 'Rareza', value: card.rarity || 'Común', inline: true },
                    { name: 'Tipo', value: card.types ? card.types.join('/') : 'Trainer', inline: true },
                    { name: 'HP', value: card.hp ? card.hp.toString() : '-', inline: true }
                )
                .setFooter({ text: `ID: ${card.id} • Mercado: ${priceText}`, iconURL: 'https://images.pokemontcg.io/logo.png' });

            await wait(1000); 
            await interaction.editReply({ content: `🎒 **Sobre Abierto** \`[▉▉▉▉▉▉▉▉▉]\``, embeds: [embed] });
            console.log(`[OPEN] Éxito: ${card.id}`);

        } catch (error) {
            console.error("[OPEN] Error:", error);
            
            refundCoins(userId, COST); 
            
            await interaction.editReply({ 
                content: `❌ **Error:** No se pudo abrir el sobre.\n> \`${error.message}\`\n💰 Tus monedas han sido devueltas.` 
            });
        }
    },
};