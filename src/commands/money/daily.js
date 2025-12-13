const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserData, addCoins, setDaily } = require('../../utils/dataHandler');
const { EMOJIS, CONFIG, TYPE_COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('¡Recibe tu suministro diario de Pokémonedas!'),

    async execute(interaction) {
        const user = interaction.user;
        const userData = getUserData(user.id);
        const isPremium = userData.isPremium;

        const COOLDOWN = CONFIG.DAILY_COOLDOWN; 
        
        const timeSinceLast = Date.now() - userData.lastDaily;

        if (timeSinceLast < COOLDOWN) {
            const remainingTime = COOLDOWN - timeSinceLast;
            const hours = Math.floor(remainingTime / 3600000);
            const minutes = Math.floor((remainingTime % 3600000) / 60000);
            
            return interaction.reply({ 
                content: `⏳ **¡Ya reclamaste hoy!** \`|\` Vuelve en **${hours}h ${minutes}m** para más suministros.`, 
                flags: 64 
            });
        }

        let baseReward = 500; 
        const luckBonus = Math.floor(Math.random() * 301);
        
        let totalReward = baseReward + luckBonus;
        
        if (isPremium) totalReward *= 2;

        addCoins(user.id, totalReward);
        setDaily(user.id);

        const newBalance = userData.balance + totalReward;

        const embed = new EmbedBuilder()
            .setColor(TYPE_COLORS.market_buy || 0xF1C40F)
            .setTitle(`${EMOJIS.money} SUMINISTRO DIARIO RECIBIDO`)
            .setDescription(`¡Hola **${user.username}**! Has retirado fondos del Banco Pokémon.`)
            .addFields(
                { 
                    name: 'Ingresos', 
                    value: `**+${totalReward}** ${EMOJIS.money}`, 
                    inline: true 
                },
                { 
                    name: 'Nuevo Balance', 
                    value: `**${newBalance}** ${EMOJIS.money}`, 
                    inline: true 
                },
                {
                    name: 'Desglose',
                    value: `Base: ${baseReward} | Suerte: +${luckBonus}${isPremium ? ' | **👑 Bonus VIP x2**' : ''}`,
                    inline: false
                }
            )
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2933/2933116.png')
            .setFooter({ text: '¡Úsalos sabiamente en /open!', iconURL: user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};