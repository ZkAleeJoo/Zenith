const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserData, addCoins, setDaily } = require('../../utils/dataHandler');
const { EMOJIS, CONFIG, TYPE_COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Recoge tus Pokémonedas diarias.'),

    async execute(interaction) {
        const user = interaction.user;
        const userData = getUserData(user.id);
        
        const COOLDOWN = CONFIG.DAILY_COOLDOWN;
        const isPremium = userData.isPremium;
        let REWARD = CONFIG.DAILY_REWARD;
        if (isPremium) REWARD = REWARD * 2;

        const timeSinceLast = Date.now() - userData.lastDaily;

        if (timeSinceLast < COOLDOWN) {
            const remainingTime = COOLDOWN - timeSinceLast;
            const hours = Math.floor(remainingTime / 3600000);
            const minutes = Math.floor((remainingTime % 3600000) / 60000);
            
            return interaction.reply({ 
                content: `${EMOJIS.calendar || '📅'} \`|\` Vuelve en **${hours}h ${minutes}m** para reclamar más monedas.`, 
                flags: 64 
            });
        }

        addCoins(user.id, REWARD);
        setDaily(user.id);

        const newBalance = userData.balance + REWARD;

        const embed = new EmbedBuilder()
            .setColor(TYPE_COLORS.shiny || 0xFFD700)
            .setTitle(`${EMOJIS.check || '✅'} ¡Asistencia Diaria Confirmada!`)
            .setDescription(`¡Hola <@${user.id}>! Gracias por jugar hoy.\nAquí tienes fondos para tus próximos sobres.`)
            .addFields(
                { 
                    name: '**Has ganado:**', 
                    value: `+${REWARD} ${EMOJIS.money}`, 
                    inline: true 
                },
                { 
                    name: `${EMOJIS.bank || '🏦'} Nuevo Balance`, 
                    value: `${newBalance} ${EMOJIS.money}`, 
                    inline: true 
                },
                {
                    name: `${EMOJIS.rare_legend || '💡'} Tip`,
                    value: 'Usa `/open` para gastar tus monedas en sobres.',
                    inline: false
                }
            )
            .setThumbnail('https://i.pinimg.com/originals/fe/04/b9/fe04b9b175c91e97df91eaa199d2d3dd.gif') 
            .setFooter({ text: 'Zenith TCG • Economía Global', iconURL: user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};