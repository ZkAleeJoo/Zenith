const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Muestra información profesional y minimalista de un usuario.')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('El usuario a investigar')
                .setRequired(false)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const targetMember = await interaction.guild.members.fetch(targetUser.id);
        
        const userFetched = await interaction.client.users.fetch(targetUser.id, { force: true });

        const joinedDiscord = `<t:${parseInt(targetUser.createdTimestamp / 1000)}:f> (<t:${parseInt(targetUser.createdTimestamp / 1000)}:R>)`;
        const joinedServer = `<t:${parseInt(targetMember.joinedTimestamp / 1000)}:f> (<t:${parseInt(targetMember.joinedTimestamp / 1000)}:R>)`;
        
        const roles = targetMember.roles.cache
            .filter(r => r.name !== '@everyone')
            .sort((a, b) => b.position - a.position)
            .map(r => r)
            .slice(0, 10); 
        
        const rolesDisplay = roles.length > 0 ? roles.join(', ') : 'Sin roles especiales';

        const userColor = targetMember.displayHexColor === '#000000' ? '#ffffff' : targetMember.displayHexColor;

        const embed = new EmbedBuilder()
            .setColor(userColor)
            .setAuthor({ 
                name: `${targetUser.username}`, 
                iconURL: targetUser.displayAvatarURL() 
            })
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: 'Usuario', 
                    value: `**ID:** ${targetUser.id}\n**Nombre:** ${targetUser.username}\n**Color:** ${userColor}`, 
                    inline: false 
                },
                { 
                    name: 'Membresía en Discord', 
                    value: joinedDiscord, 
                    inline: false 
                },
                { 
                    name: 'Membresía en Servidor', 
                    value: joinedServer, 
                    inline: false 
                },
                { 
                    name: `Roles [${roles.length}]`, 
                    value: rolesDisplay, 
                    inline: false 
                }
            )
            .setFooter({ text: `Solicitado por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        const btnAvatar = new ButtonBuilder()
            .setLabel('Ver Avatar')
            .setStyle(ButtonStyle.Link)
            .setURL(targetUser.displayAvatarURL({ dynamic: true, size: 1024 }));

        const row = new ActionRowBuilder().addComponents(btnAvatar);

        if (userFetched.banner) {
            const btnBanner = new ButtonBuilder()
                .setLabel('Ver Banner')
                .setStyle(ButtonStyle.Link)
                .setURL(userFetched.bannerURL({ dynamic: true, size: 1024 }));
            
            row.addComponents(btnBanner);
            embed.setImage(userFetched.bannerURL({ dynamic: true, size: 1024 }));
        }

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};