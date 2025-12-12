const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, AttachmentBuilder } = require('discord.js');
const { getUserData, addCoins } = require('../../utils/dataHandler');
const { createBattleVersus } = require('../../utils/canvasGenerator');
const { EMOJIS, TYPE_COLORS } = require('../../utils/constants');
const Canvas = require('canvas');
const path = require('path');

try {
    Canvas.registerFont(path.join(__dirname, '../../assets/fonts/PressStart2P-Regular.ttf'), { family: 'PressStart2P' });
} catch (error) {
    console.log('Advertencia: No se pudo cargar la fuente PressStart2P. Usando fuente predeterminada.');
}

const statsCache = new Map();

function drawTextHealthBar(current, max) {
    const totalBars = 10; 
    const percentage = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(percentage * totalBars);
    const empty = totalBars - filled;
    
    const fillChar = percentage > 0.5 ? '🟩' : (percentage > 0.2 ? '🟨' : '🟥');
    const emptyChar = '⬛'; 
    
    return `${fillChar.repeat(filled)}${emptyChar.repeat(empty)}`;
}

async function generateBattleImage(f1, f2) {
    const width = 800;
    const height = 400;
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 400);
    gradient.addColorStop(0, '#2b323c');
    gradient.addColorStop(1, '#1a1d23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#141619';
    ctx.fillRect(0, 300, width, 100);
    ctx.strokeStyle = '#3e4652';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(width, 300);
    ctx.stroke();

    ctx.save();
    ctx.font = '50px "PressStart2P"';
    ctx.fillStyle = '#ff4757';
    ctx.shadowColor = '#ff6b81';
    ctx.shadowBlur = 15;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const text = (f1.stats.hp === 0 || f2.stats.hp === 0) ? 'FINISH' : 'VS';
    ctx.fillText(text, width / 2, height / 2 - 40);
    ctx.restore();

    try {
        const img1 = await Canvas.loadImage(f1.stats.sprite);
        const img2 = await Canvas.loadImage(f2.stats.sprite);

        ctx.drawImage(img1, 100, 180, 200, 200);
        ctx.drawImage(img2, 500, 180, 200, 200);
    } catch (e) {
        console.error('Error cargando sprites:', e);
    }

    const drawBar = (x, y, current, max, name) => {
        const barW = 220;
        const barH = 24;
        const pct = Math.max(0, current / max);

        ctx.fillStyle = '#fff';
        ctx.font = '14px "PressStart2P"';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(name.slice(0, 15), x, y - 10);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#2f3640';
        ctx.fillRect(x, y, barW, barH);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barW, barH);

        let color = '#2ecc71'; 
        if (pct < 0.5) color = '#f1c40f';
        if (pct < 0.2) color = '#e74c3c'; 
        
        ctx.fillStyle = color;
        ctx.fillRect(x + 2, y + 2, (barW - 4) * pct, barH - 4);

        ctx.font = '10px "PressStart2P"';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${current}/${max}`, x + barW - 5, y - 35); 
    };

    drawBar(50, 60, f1.stats.hp, f1.stats.max_hp, f1.stats.name);
    drawBar(530, 340, f2.stats.hp, f2.stats.max_hp, f2.stats.name);

    return canvas.toBuffer();
}

async function getBattleStats(pokemonId, isShiny) {
    if (statsCache.has(pokemonId)) return applyShinyBonus(statsCache.get(pokemonId), isShiny);

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const data = await res.json();

        const stats = {
            name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
            hp: data.stats[0].base_stat * 3, 
            max_hp: data.stats[0].base_stat * 3,
            atk: data.stats[1].base_stat,
            def: data.stats[2].base_stat,
            spd: data.stats[5].base_stat,
            sprite: data.sprites.other['home'].front_default || data.sprites.front_default, 
            shiny_sprite: data.sprites.other['home'].front_shiny || data.sprites.front_shiny
        };

        statsCache.set(pokemonId, stats);
        return applyShinyBonus(stats, isShiny);
    } catch (e) { return null; }
}

function applyShinyBonus(base, isShiny) {
    const s = { ...base };
    if (isShiny) {
        s.hp = Math.floor(s.hp * 1.15); 
        s.max_hp = Math.floor(s.max_hp * 1.15);
        s.atk = Math.floor(s.atk * 1.1); 
        s.sprite = s.shiny_sprite;
        s.isBuffed = true;
    }
    return s;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('⚔️ Sistema de Batalla Profesional (PvP)')
        .addUserOption(option => 
            option.setName('oponente')
                .setDescription('Entrenador a desafiar')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.deferred) await interaction.deferReply();

        const p1 = interaction.user;
        const p2 = interaction.options.getUser('oponente');

        if (p2.id === p1.id) return interaction.editReply('🛑 **Error de matchmaking:** No puedes pelear contigo mismo.');
        if (p2.bot) return interaction.editReply('🤖 **Error:** Los sistemas automatizados no aceptan duelos.');

        const p1Data = getUserData(p1.id);
        const p2Data = getUserData(p2.id);

        if (p1Data.cards.length === 0) return interaction.editReply(`${EMOJIS.error} No tienes cartas. Usa \`/open\`.`);
        if (p2Data.cards.length === 0) return interaction.editReply(`${EMOJIS.error} Tu oponente no tiene mazo.`);

        const vsBuffer = await createBattleVersus(p1, p2);
        const vsAttachment = new AttachmentBuilder(vsBuffer, { name: 'versus.png' });

        const inviteEmbed = new EmbedBuilder()
            .setTitle('🏟️ ARENA DE COMBATE')
            .setDescription(`# ${p1} 🆚 ${p2}\n\n**${p1.username}** ha lanzado un desafío oficial.\n¿Aceptas poner en juego tu honor?`)
            .setColor(0xFF0000)
            .setImage('attachment://versus.png')
            .setFooter({ text: 'Sistema de Batalla Zenith v2.0' });

        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_duel').setLabel('ACEPTAR RETO').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('deny_duel').setLabel('RECHAZAR').setStyle(ButtonStyle.Secondary)
        );

        const msg = await interaction.editReply({ content: `🔔 Llamando a ${p2}...`, embeds: [inviteEmbed], components: [inviteRow], files: [vsAttachment] });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== p2.id) return i.reply({ content: '🚫 No es tu duelo.', flags: 64 });

            if (i.customId === 'deny_duel') {
                collector.stop();
                await i.update({ content: '🏳️ **Batalla cancelada por el oponente.**', embeds: [], components: [], files: [] });
                return;
            }

            collector.stop();
            await i.deferUpdate();
            await startSelectionPhase(interaction, p1, p2, p1Data, p2Data);
        });
    },
};

async function startSelectionPhase(interaction, p1, p2, p1Data, p2Data) {
    let state = {
        [p1.id]: { page: 0, selected: null, cards: p1Data.cards.sort((a,b) => b.isShiny - a.isShiny) },
        [p2.id]: { page: 0, selected: null, cards: p2Data.cards.sort((a,b) => b.isShiny - a.isShiny) }
    };

    const getPayload = () => {
        const rows = [];
        
        if (!state[p1.id].selected) {
            rows.push(createCardMenu(p1, state[p1.id].cards, state[p1.id].page));
            rows.push(createPageButtons(p1, state[p1.id].page, state[p1.id].cards.length));
        }

        if (!state[p2.id].selected) {
            rows.push(createCardMenu(p2, state[p2.id].cards, state[p2.id].page));
            rows.push(createPageButtons(p2, state[p2.id].page, state[p2.id].cards.length));
        }

        const embed = new EmbedBuilder()
            .setTitle('🎴 FASE DE SELECCIÓN TÁCTICA')
            .setColor('#2B2D31')
            .addFields(
                { name: `🔴 ${p1.username}`, value: state[p1.id].selected ? `✅ LISTO: **${state[p1.id].selected.name}**` : '⏳ Eligiendo...', inline: true },
                { name: `🔵 ${p2.username}`, value: state[p2.id].selected ? `✅ LISTO: **${state[p2.id].selected.name}**` : '⏳ Eligiendo...', inline: true }
            )
            .setFooter({ text: 'Usa los botones para ver más cartas de tu inventario.' });

        return { content: null, embeds: [embed], components: rows, files: [] };
    };

    const msg = await interaction.editReply(getPayload());
    const selector = msg.createMessageComponentCollector({ time: 120000 });

    selector.on('collect', async i => {
        const uid = i.user.id;
        if (!state[uid]) return i.reply({ content: 'Espectador.', flags: 64 });

        if (i.customId.includes('prev') || i.customId.includes('next')) {
            const action = i.customId.split('_')[0]; 
            if (action === 'prev') state[uid].page--;
            else state[uid].page++;
            
            await i.update(getPayload());
            return;
        }

        if (i.isStringSelectMenu()) {
            const cardId = i.values[0];
            const card = state[uid].cards.find(c => c.uniqueId === cardId);
            
            await i.deferUpdate(); 
            const stats = await getBattleStats(card.id, card.isShiny);
            
            if (!stats) return i.followUp({ content: 'Error de conexión con PokéAPI.', flags: 64 });

            state[uid].selected = { card, stats, user: i.user };

            if (state[p1.id].selected && state[p2.id].selected) {
                selector.stop();
                await runBattle(interaction, state[p1.id].selected, state[p2.id].selected);
            } else {
                await interaction.editReply(getPayload());
            }
        }
    });
}

function createCardMenu(user, allCards, page) {
    const start = page * 25;
    const end = start + 25;
    const slice = allCards.slice(start, end);

    const options = slice.map(c => {
        let emoji = '🔴'; 
        if (c.isShiny) emoji = '✨'; 

        return new StringSelectMenuOptionBuilder()
            .setLabel(c.name)
            .setDescription(`CP: ${c.id} | ${c.isShiny ? 'SHINY (+Stats)' : 'Normal'}`)
            .setValue(c.uniqueId)
            .setEmoji(emoji);
    });

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`sel_${user.id}`)
            .setPlaceholder(`Selecciona carta (${start+1}-${Math.min(end, allCards.length)})`)
            .addOptions(options)
    );
}

function createPageButtons(user, page, totalCards) {
    const maxPage = Math.ceil(totalCards / 25) - 1;
    
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`prev_${user.id}`)
            .setLabel('⬅️ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`info_${user.id}`) 
            .setLabel(`${page + 1}/${maxPage + 1}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`next_${user.id}`)
            .setLabel('Siguiente ➡️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= maxPage)
    );
}

async function runBattle(interaction, f1, f2) {
    let attacker = f1.stats.spd >= f2.stats.spd ? f1 : f2;
    let defender = f1.stats.spd >= f2.stats.spd ? f2 : f1;

    let log = [];
    let turn = 1;

    while (f1.stats.hp > 0 && f2.stats.hp > 0 && turn <= 15) {
        const variance = (Math.random() * 0.2) + 0.9;
        let damage = Math.floor((attacker.stats.atk * variance) - (defender.stats.def * 0.4));
        if (damage < 10) damage = 10; 

        const isCrit = Math.random() < 0.12;
        if (isCrit) damage = Math.floor(damage * 1.5);

        defender.stats.hp -= damage;
        if (defender.stats.hp < 0) defender.stats.hp = 0;

        const icon = attacker.user.id === f1.user.id ? EMOJIS.ball : '🛡️';
        const critMsg = isCrit ? ' CRÍTICO!' : '';
        log.push(`- ${attacker.stats.name} impacta por ${damage}${critMsg}`);
        [attacker, defender] = [defender, attacker];
        turn++;
    }

    let winner = f1.stats.hp > 0 ? f1 : f2;
    
    addCoins(winner.user.id, 150);

    const resultBuffer = await generateBattleImage(f1, f2);
    const resultAttachment = new AttachmentBuilder(resultBuffer, { name: 'battle-result.png' });

    const embed = new EmbedBuilder()
        .setTitle(`🏆 ¡VICTORIA PARA ${winner.user.username.toUpperCase()}!`)
        .setDescription(`**${winner.stats.name}** se alza con la victoria tras ${turn} rondas de combate intenso.\n\n💰 **Recompensa:** +150 ${EMOJIS.money}`)
        .setColor(TYPE_COLORS.legendary || 0xFFD700)
        .setImage('attachment://battle-result.png') 
        .addFields(
            {
                name: '📜 Resumen de Batalla',
                value: `\`\`\`\n${log.slice(-6).join('\n')}\n\`\`\``, 
                inline: false
            }
        );

    await interaction.editReply({ content: null, embeds: [embed], components: [], files: [resultAttachment] });
}