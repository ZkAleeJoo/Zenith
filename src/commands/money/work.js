const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUserData, addCoins, setWork } = require('../../utils/dataHandler');
const { EMOJIS, CONFIG, TYPE_COLORS } = require('../../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Trabaja un poco para ganar algunas Pokémonedas.'),

    async execute(interaction) {

        await interaction.deferReply();

        try{
        const user = interaction.user;
        const userData = getUserData(user.id);
        
        const COOLDOWN = CONFIG.WORK_COOLDOWN || 60000;
        const timeSinceLast = Date.now() - userData.lastWork;

        if (timeSinceLast < COOLDOWN) {
            const remainingTime = Math.ceil((COOLDOWN - timeSinceLast) / 1000);
            return interaction.reply({ 
                content: `${EMOJIS.error} | Debes descansar. Inténtalo de nuevo en **${remainingTime} segundos**.`, 
                flags: 64 
            });
        }

        const min = CONFIG.WORK_REWARD_MIN || 20;
        const max = CONFIG.WORK_REWARD_MAX || 50;
        const reward = Math.floor(Math.random() * (max - min + 1)) + min;

        addCoins(user.id, reward);
        setWork(user.id);

        const newBalance = userData.balance + reward;

        const workMessages = [
            "Ayudaste a la Enfermera Joy en el Centro Pokémon.",
            "Limpiaste el gimnasio de Ciudad Plateada.",
            "Ayudaste al Profesor Oak a organizar sus archivos.",
            "Repartiste correo en una bicicleta plegable."
        ];
        const randomMsg = workMessages[Math.floor(Math.random() * workMessages.length)];

        const embed = new EmbedBuilder()
            .setColor(TYPE_COLORS.base || 0x9B59B6)
            .setTitle(`${EMOJIS.cool} ¡Buen trabajo!`)
            .setDescription(`${randomMsg}\n\n¡Has recibido tu pago por el esfuerzo!`)
            .addFields(
                { 
                    name: 'Ganancia:', 
                    value: `+${reward} ${EMOJIS.money}`, 
                    inline: true 
                },
                { 
                    name: `${EMOJIS.bank || '🏦'} Balance Total`, 
                    value: `${newBalance} ${EMOJIS.money}`, 
                    inline: true 
                }
            )
            .setThumbnail('https://i.pinimg.com/originals/f7/da/1c/f7da1ca5951497098c61af9f26ba6326.gifhttps://i.pinimg.com/originals/f7/da/1c/f7da1ca5951497098c61af9f26ba6326.gif') // Animación de trabajo
            .setFooter({ text: 'Zenith TCG • Sistema de Empleo', iconURL: user.displayAvatarURL() })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        }catch (error) {
        console.error('Error en work:', error);
        await interaction.editReply({ content: 'Hubo un error al procesar tu jornada laboral.' });
    }
    },
};