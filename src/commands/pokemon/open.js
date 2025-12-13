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

let cachedSets = [];
let lastSetFetch = 0;

async function getRandomCard(apiKey) {
    if (cachedSets.length === 0 || Date.now() - lastSetFetch > 3600000) {
        console.log('[API] Actualizando lista de Sets...');
        const setsRes = await fetch('https://api.pokemontcg.io/v2/sets', {
            headers: { 'X-Api-Key': apiKey }
        });
        const setsJson = await setsRes.json();
        cachedSets = setsJson.data;
        lastSetFetch = Date.now();
    }

    if (!cachedSets || cachedSets.length === 0) throw new Error("No se pudieron cargar los Sets.");
    const randomSet = cachedSets[Math.floor(Math.random() * cachedSets.length)];

    const randomPage = Math.floor(Math.random() * randomSet.total) + 1;

    console.log(`[API] Buscando en Set: ${randomSet.name} (Total: ${randomSet.total}) -> Pág: ${randomPage}`);

    const cardRes = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.id:${randomSet.id}&page=${randomPage}&pageSize=1`, {
        headers: { 'X-Api-Key': apiKey }
    });

    if (!cardRes.ok) throw new Error(`API Error: ${cardRes.status}`);
    
    const cardJson = await cardRes.json();
    if (!cardJson.data || cardJson.data.length === 0) {
        console.log('[API] Set vacío, reintentando...');
        return getRandomCard(apiKey);
    }

    return cardJson.data[0];
}

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

        await interaction.reply({ content: `**Abriendo sobre TCG...** \`[▉▉▉_______]\`` });

        try {
            const apiKey = process.env.POKEMON_TCG_API_KEY || '';
            const card = await getRandomCard(apiKey);

            addCard(userId, card);

            let color = 0x2B2D31; 
            if (card.types && card.types.length > 0) {
                color = TCG_COLORS[card.types[0]] || 0x2B2D31;
            }

            let rarityIcon = "🔹";
            const rarity = card.rarity ? card.rarity.toLowerCase() : "";
            if (rarity.includes("rare")) rarityIcon = "⭐";
            if (rarity.includes("v") || rarity.includes("ex") || rarity.includes("gx")) rarityIcon = "✨";
            if (rarity.includes("secret") || rarity.includes("rainbow") || rarity.includes("illustration")) rarityIcon = "🌈";

            let priceText = "N/A";
            if (card.tcgplayer && card.tcgplayer.prices) {
                const prices = card.tcgplayer.prices;
                const priceObj = prices.holofoil || prices.normal || prices.reverseHolofoil || prices['1stEditionHolofoil'];
                if (priceObj && priceObj.market) {
                    priceText = `$${priceObj.market} USD`;
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
                .setFooter({ text: `ID: ${card.id} • Precio: ${priceText}`, iconURL: card.set.images.symbol });

            await wait(1500); 
            await interaction.editReply({ content: `**Sobre Abierto** \`[▉▉▉▉▉▉▉▉▉]\``, embeds: [embed] });
            console.log(`[OPEN] Éxito: ${card.name} (${card.id})`);

        } catch (error) {
            console.error("[OPEN] Error:", error);
            refundCoins(userId, COST); 
            await interaction.editReply({ 
                content: `❌ **Error:** No se pudo abrir el sobre.\n> \`${error.message}\`\n💰 Tus monedas han sido devueltas.` 
            });
        }
    },
};