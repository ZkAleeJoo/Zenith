const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { getUserData } = require('../../utils/dataHandler');
const { createProfileCard } = require('../../utils/canvasGenerator'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Muestra tu tarjeta de entrenador oficial.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('Ver el perfil de otro usuario')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const userData = getUserData(targetUser.id);
        const cards = userData.cards || [];
        const totalCards = cards.length;

        let rank = "Aprendiz Novato";
        if (totalCards > 10) rank = "Trota Sendas";
        if (totalCards > 30) rank = "Guía de Gimnasio";
        if (totalCards > 50) rank = "Estratega Fiel";
        if (totalCards > 100) rank = "Veterano de Batalla";
        if (totalCards > 200) rank = "Maestro de la Liga";
        if (totalCards > 300) rank = "Élite del Vínculo";
        if (totalCards > 500) rank = "Cazador de Mitos";
        if (totalCards > 800) rank = "Campeón Regional";
        if (totalCards > 1000) rank = "Leyenda Suprema";

        try {
            const buffer = await createProfileCard(targetUser, userData, rank);
            
            const attachment = new AttachmentBuilder(buffer, { name: `profile-${targetUser.username}.png` });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error("Error en profile:", error);
            await interaction.editReply({ content: `${EMOJIS.error} Hubo un error generando la tarjeta de entrenador.` });
        }
    },
};