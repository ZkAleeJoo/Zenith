const { Events, ActivityType } = require('discord.js');

module.exports = {
    name: Events.ClientReady,
    once: true, 
    execute(client) {
        console.log(`Listo para liga pokemon - ${client.user.tag} va en camino!`);

        const activities = [
            { name: '💎 /help - zenith.com', type: ActivityType.Playing },
            { name: 'Abre cartas con /open', type: ActivityType.Playing },
            { name: 'Jugando a Cobblemon', type: ActivityType.Playing }
        ];

        let i = 0;

        const updateStatus = () => {
            if (i >= activities.length) i = 0;
            
            client.user.setActivity({
                name: activities[i].name,
                type: activities[i].type
            });

            i++;
        };

        updateStatus();

        setInterval(updateStatus, 60000); 
    },
};