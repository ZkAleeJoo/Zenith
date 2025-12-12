const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType } = require('discord.js');
const { getUserData, addCoins } = require('../../utils/dataHandler');
const { EMOJIS, TYPE_COLORS } = require('../../utils/constants');

// Cache para no saturar la PokéAPI si pelean muchas veces seguidas con el mismo Pokémon
const statsCache = new Map();

// Función auxiliar para dibujar barra de vida
function drawHealthBar(current, max) {
    const totalBars = 10;
    const percentage = current / max;
    const filledBars = Math.max(0, Math.min(totalBars, Math.round(percentage * totalBars)));
    const emptyBars = totalBars - filledBars;
    
    const fillChar = '🟩';
    const emptyChar = '⬛';
    
    // Si la vida baja del 30%, cambiamos a rojo
    const barColor = percentage < 0.3 ? '🟥' : fillChar;
    
    return barColor.repeat(filledBars) + emptyChar.repeat(emptyBars);
}

async function getBattleStats(pokemonId, isShiny) {
    // Si ya lo buscamos antes, lo sacamos de la memoria
    if (statsCache.has(pokemonId)) {
        const cached = statsCache.get(pokemonId);
        return applyShinyBonus(cached, isShiny);
    }

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const data = await res.json();

        const stats = {
            name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
            hp: data.stats[0].base_stat * 3, // Multiplicamos HP x3 para que duren más los combates
            max_hp: data.stats[0].base_stat * 3,
            atk: data.stats[1].base_stat,
            def: data.stats[2].base_stat,
            spd: data.stats[5].base_stat,
            sprite: isShiny ? data.sprites.other['home'].front_shiny : data.sprites.other['home'].front_default
        };

        statsCache.set(pokemonId, stats); // Guardar en cache
        return applyShinyBonus(stats, isShiny);

    } catch (error) {
        console.error("Error API Stats:", error);
        return null;
    }
}

function applyShinyBonus(baseStats, isShiny) {
    // Copiamos el objeto para no modificar el cache original
    const stats = { ...baseStats }; 
    
    if (isShiny) {
        // ✨ BONUS SHINY: +10% en todo
        stats.hp = Math.floor(stats.hp * 1.1);
        stats.max_hp = Math.floor(stats.max_hp * 1.1);
        stats.atk = Math.floor(stats.atk * 1.1);
        stats.def = Math.floor(stats.def * 1.1);
        stats.isBuffed = true;
    }
    return stats;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Desafía a otro entrenador a una batalla Pokémon.')
        .addUserOption(option => 
            option.setName('oponente')
                .setDescription('El usuario a desafiar')
                .setRequired(true)),

    async execute(interaction) {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('oponente');

        if (opponent.id === challenger.id) return interaction.reply({ content: '🚫 No puedes pelear contra ti mismo.', flags: 64 });
        if (opponent.bot) return interaction.reply({ content: '🤖 Los bots son demasiado fuertes para ti (y no tienen cartas).', flags: 64 });

        const p1Data = getUserData(challenger.id);
        const p2Data = getUserData(opponent.id);

        if (p1Data.cards.length === 0) return interaction.reply({ content: '🚫 No tienes cartas para pelear. Usa `/open`.', flags: 64 });
        if (p2Data.cards.length === 0) return interaction.reply({ content: '🚫 Tu oponente no tiene cartas.', flags: 64 });

        const inviteEmbed = new EmbedBuilder()
            .setTitle('⚔️ DESAFÍO DE BATALLA')
            .setDescription(`${opponent}, **${challenger.username}** te ha desafiado a un duelo 1v1.\n\n¿Aceptas el reto?`)
            .setColor('#FF0000')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/10003/10003923.png');

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_duel').setLabel('¡Acepto!').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('deny_duel').setLabel('Huir').setStyle(ButtonStyle.Secondary)
        );

        const reply = await interaction.reply({ content: `${opponent}`, embeds: [inviteEmbed], components: [buttons] });

        const collector = reply.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 30000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== opponent.id) {
                return i.reply({ content: '🤫 No es tu duelo.', flags: 64 });
            }

            if (i.customId === 'deny_duel') {
                await i.update({ content: '🏳️ **El oponente rechazó la batalla.**', embeds: [], components: [] });
                return;
            }

            await i.deferUpdate(); 
            collector.stop(); 

            
            const createSelect = (userId, cards) => {
                const sortedCards = [...cards].sort((a, b) => b.isShiny - a.isShiny).slice(0, 25);
                
                const options = sortedCards.map(c => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${c.name} (CP: ${c.id})`) 
                        .setDescription(c.isShiny ? '✨ Shiny (+10% Stats)' : 'Normal')
                        .setValue(c.uniqueId)
                        .setEmoji(c.isShiny ? '✨' : '🔴')
                );

                return new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(`select_${userId}`)
                        .setPlaceholder('Elige tu Pokémon luchador')
                        .addOptions(options)
                );
            };

            const rowP1 = createSelect(challenger.id, p1Data.cards);
            const rowP2 = createSelect(opponent.id, p2Data.cards);

            const selectMsg = await interaction.editReply({ 
                content: `🎴 **Fase de Selección**\nAmbos entrenadores deben elegir su carta.\n\n🔸 **${challenger.username}**: Usa el menú 1\n🔹 **${opponent.username}**: Usa el menú 2`,
                embeds: [], 
                components: [rowP1, rowP2] 
            });

            const selectCollector = selectMsg.createMessageComponentCollector({ 
                componentType: ComponentType.StringSelect, 
                time: 60000 
            });

            const fighters = {}; 

            selectCollector.on('collect', async selectInt => {
                const uid = selectInt.user.id;
                
                if (uid !== challenger.id && uid !== opponent.id) {
                    return selectInt.reply({ content: 'Espectador.', flags: 64 });
                }

                if (selectInt.customId !== `select_${uid}`) {
                    return selectInt.reply({ content: '❌ Ese no es tu menú.', flags: 64 });
                }

                const cardUUID = selectInt.values[0];
                const deck = uid === challenger.id ? p1Data.cards : p2Data.cards;
                const card = deck.find(c => c.uniqueId === cardUUID);

                await selectInt.deferReply({ flags: 64 }); 
                const stats = await getBattleStats(card.id, card.isShiny);

                if (!stats) {
                    return selectInt.editReply({ content: '❌ Error obteniendo datos de la API. Intenta otra carta.' });
                }

                fighters[uid] = { user: selectInt.user, card, stats };

                await selectInt.editReply({ content: `✅ Has seleccionado a **${card.name}** ${card.isShiny ? '✨' : ''}!` });

                if (fighters[challenger.id] && fighters[opponent.id]) {
                    selectCollector.stop();
                    await runBattle(interaction, fighters[challenger.id], fighters[opponent.id]);
                }
            });
        });
    },
};

async function runBattle(interaction, f1, f2) {
    
    let log = [];
    let turn = 1;
    
    let attacker = f1.stats.spd >= f2.stats.spd ? f1 : f2;
    let defender = f1.stats.spd >= f2.stats.spd ? f2 : f1;

    while (f1.stats.hp > 0 && f2.stats.hp > 0 && turn <= 15) {
        
        const variance = (Math.random() * 0.2) + 0.9; 
        let damage = Math.floor((attacker.stats.atk * variance) - (defender.stats.def * 0.4));
        
        if (damage < 5) damage = 5;

        const isCrit = Math.random() < 0.15;
        if (isCrit) damage = Math.floor(damage * 1.5);

        defender.stats.hp -= damage;
        if (defender.stats.hp < 0) defender.stats.hp = 0;

        const icon = attacker.user.id === f1.user.id ? '🔴' : '🔵';
        const critText = isCrit ? ' **💥 CRÍTICO!**' : '';
        const skill = isCrit ? 'Usó un ataque potente' : 'Atacó';
        
        log.push(`${icon} **${attacker.stats.name}** ${skill} y causó **${damage}** daño.${critText}`);

        const temp = attacker;
        attacker = defender;
        defender = temp;
        turn++;
    }

    let winner, loser;
    if (f1.stats.hp <= 0) { winner = f2; loser = f1; }
    else if (f2.stats.hp <= 0) { winner = f1; loser = f2; }
    else {
        const p1Pct = f1.stats.hp / f1.stats.max_hp;
        const p2Pct = f2.stats.hp / f2.stats.max_hp;
        winner = p1Pct > p2Pct ? f1 : f2;
        loser = p1Pct > p2Pct ? f2 : f1;
        log.push(`\n⌛ **¡Tiempo agotado!** Gana ${winner.stats.name} por decisión de los jueces.`);
    }

    const prize = 100;
    addCoins(winner.user.id, prize);

    const embed = new EmbedBuilder()
        .setTitle(`🏆 Victoria de ${winner.user.username}`)
        .setColor(TYPE_COLORS.legendary || 0x5D3FD3)
        .setDescription(`**${winner.stats.name}** derrotó a **${loser.stats.name}** en ${turn} turnos.\n\n💰 **Premio:** +${prize} ${EMOJIS.money}\n\n**📜 REGISTRO DE BATALLA:**\n${log.slice(-5).join('\n')}`) // Muestra los últimos 5 turnos
        .setThumbnail(winner.stats.sprite)
        .addFields(
            { 
                name: `🔴 ${f1.user.username} - ${f1.stats.name}`, 
                value: `${drawHealthBar(f1.stats.hp, f1.stats.max_hp)} ${f1.stats.hp}/${f1.stats.max_hp} HP`, 
                inline: false 
            },
            { 
                name: `🔵 ${f2.user.username} - ${f2.stats.name}`, 
                value: `${drawHealthBar(f2.stats.hp, f2.stats.max_hp)} ${f2.stats.hp}/${f2.stats.max_hp} HP`, 
                inline: false 
            }
        );

    await interaction.editReply({ content: null, embeds: [embed], components: [] });
}