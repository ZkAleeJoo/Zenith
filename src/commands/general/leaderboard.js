const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getLeaderboard } = require('../../utils/dataHandler');
const { EMOJIS, TYPE_COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Muestra los mejores entrenadores del servidor.')
        .addStringOption(option =>
            option.setName('categoria')
                .setDescription('¿Qué ranking quieres ver?')
                .setRequired(true)
                .addChoices(
                    { name: '💰 Top Millonarios', value: 'money' },
                    { name: '🃏 Top Coleccionistas', value: 'cards' },
                    { name: '✨ Top Shiny Hunters', value: 'shinys' }
                )),

    async execute(interaction) {
        await interaction.deferReply();
        const category = interaction.options.getString('categoria');
        
        const data = getLeaderboard(category);

        if (data.length === 0) {
            return interaction.editReply({ content: `${EMOJIS.error} Aún no hay datos suficientes para generar un ranking` });
        }

        let title = '';
        let description = '';
        let color = '';
        let icon = '';

        if (category === 'money') {
            title = 'TOP MILLONARIOS';
            color = 0xF1C40F; 
            icon = 'https://cdn-icons-png.flaticon.com/512/2454/2454269.png';
        } else if (category === 'cards') {
            title = 'MAESTROS DE COLECCIÓN';
            color = 0x3498DB; 
            icon = 'https://cdn-icons-png.flaticon.com/512/10609/10609398.png';
        } else {
            title = 'CAZADORES DE SHINYS';
            color = 0xE91E63; 
            icon = 'https://cdn-icons-png.flaticon.com/512/1694/1694364.png';
        }

        let leaderboardText = '';
        const medals = ['🥇', '🥈', '🥉'];

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const position = i + 1;
            const medal = i < 3 ? medals[i] : `\`#${position}\``;
            
            let username = `<@${row.id}>`; 
            
            const value = category === 'money' 
                ? `**${row.balance.toLocaleString()}** ${EMOJIS.money}` 
                : `**${row.count}** Cartas`;

            leaderboardText += `${medal} • ${username} \n└ ${value}\n\n`;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setThumbnail(icon)
            .setDescription(leaderboardText)
            .setColor(color)
            .setFooter({ text: 'Zenith TCG • Global Rankings' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};