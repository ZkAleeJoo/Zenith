const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ComponentType, AttachmentBuilder } = require('discord.js');
const { getUserData, addCoins } = require('../../utils/dataHandler');
const { createBattleVersus } = require('../../utils/canvasGenerator');
const { EMOJIS, TYPE_COLORS } = require('../../utils/constants');
const Canvas = require('canvas');
const path = require('path');

const fontPath = path.join(__dirname, '../../assets/fonts/PressStart2P-Regular.ttf');
try {
    if (require('fs').existsSync(fontPath)) {
        Canvas.registerFont(fontPath, { family: 'PressStart2P' });
    }
} catch (error) { console.log('Fuente no cargada, usando default sans-serif'); }

const statsCache = new Map();

async function generateBattleImage(f1, f2) {
    const width = 800;
    const height = 500; 
    const canvas = Canvas.createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1a1c2c');
    bgGrad.addColorStop(0.6, '#2b323c');
    bgGrad.addColorStop(1, '#141619');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(width / 2, 420, 380, 60, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#4a1c40';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.save();
    ctx.font = '60px "PressStart2P"';
    ctx.fillStyle = (f1.stats.hp === 0 || f2.stats.hp === 0) ? '#ff4757' : 'rgba(255,255,255,0.1)';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 10;
    const centerText = (f1.stats.hp === 0 || f2.stats.hp === 0) ? 'K.O.' : 'VS';
    ctx.fillText(centerText, width / 2, height / 2);
    ctx.restore();

    try {
        const img1 = await Canvas.loadImage(f1.stats.sprite);
        const img2 = await Canvas.loadImage(f2.stats.sprite);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(200, 430, 80, 20, 0, 0, Math.PI * 2); 
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(600, 430, 80, 20, 0, 0, Math.PI * 2); 
        ctx.fill();

        const size = 250;
        ctx.drawImage(img1, 75, 440 - size, size, size);

        ctx.save();
        ctx.translate(600 + (size/2), 440 - size); 
        ctx.scale(-1, 1); 
        ctx.drawImage(img2, 0, 0, size, size); 
        ctx.restore();

    } catch (e) {
        console.error('Error sprites:', e);
    }

    const drawHUD = (x, y, fighter, alignRight) => {
        const barW = 280;
        const barH = 20;
        const stats = fighter.stats;
        
        const textX = alignRight ? x + barW : x;
        const align = alignRight ? 'right' : 'left';

        ctx.fillStyle = '#fff';
        ctx.font = '20px "PressStart2P"';
        ctx.textAlign = align;
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(stats.name, textX, y - 15);
        
        ctx.fillStyle = '#333';
        roundRect(ctx, x, y, barW, barH, 10, true, false);

        const hpPercent = Math.max(0, stats.hp / stats.max_hp);
        let hpColor = '#2ecc71'; 
        if (hpPercent < 0.5) hpColor = '#f1c40f'; 
        if (hpPercent < 0.2) hpColor = '#e74c3c'; 

        if (hpPercent > 0) {
            const grad = ctx.createLinearGradient(x, 0, x + barW, 0);
            grad.addColorStop(0, hpColor);
            grad.addColorStop(1, shadeColor(hpColor, -40));
            
            ctx.fillStyle = grad;
            if (alignRight) {
                 roundRect(ctx, x + (barW * (1 - hpPercent)), y, barW * hpPercent, barH, 10, true, false);
            } else {
                 roundRect(ctx, x, y, barW * hpPercent, barH, 10, true, false);
            }
        }

        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        roundRect(ctx, x, y, barW, barH, 10, false, true);

        ctx.fillStyle = '#fff';
        ctx.font = '12px "PressStart2P"';
        ctx.fillText(`${stats.hp}/${stats.max_hp} HP`, textX, y + 40);
        
        if (fighter.card.isShiny) {
             ctx.fillStyle = '#FFD700';
             ctx.fillText('✨', alignRight ? x - 25 : x + barW + 10, y);
        }
    };

    drawHUD(40, 60, f1, false);      
    drawHUD(480, 60, f2, true);      

    return canvas.toBuffer();
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

function shadeColor(color, percent) {
    var R = parseInt(color.substring(1,3),16);
    var G = parseInt(color.substring(3,5),16);
    var B = parseInt(color.substring(5,7),16);
    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);
    R = (R<255)?R:255;  
    G = (G<255)?G:255;  
    B = (B<255)?B:255;  
    var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));
    return "#"+RR+GG+BB;
}

async function getBattleStats(pokemonId, isShiny) {
    if (statsCache.has(pokemonId)) return applyShinyBonus(statsCache.get(pokemonId), isShiny);

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonId}`);
        const data = await res.json();

        const sprite = data.sprites.other['official-artwork'].front_default || data.sprites.other['home'].front_default;
        const shinySprite = data.sprites.other['official-artwork'].front_shiny || data.sprites.other['home'].front_shiny;

        const stats = {
            name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
            hp: data.stats[0].base_stat * 4, 
            max_hp: data.stats[0].base_stat * 4,
            atk: data.stats[1].base_stat,
            def: data.stats[2].base_stat,
            spd: data.stats[5].base_stat,
            sprite: sprite, 
            shiny_sprite: shinySprite
        };

        statsCache.set(pokemonId, stats);
        return applyShinyBonus(stats, isShiny);
    } catch (e) { return null; }
}

function applyShinyBonus(base, isShiny) {
    const s = { ...base }; 
    if (isShiny) {
        s.hp = Math.floor(s.hp * 1.2); 
        s.max_hp = Math.floor(s.max_hp * 1.2);
        s.atk = Math.floor(s.atk * 1.1); 
        s.sprite = s.shiny_sprite;
    }
    return s;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('duel')
        .setDescription('Sistema de Batalla Profesional (PvP)')
        .addUserOption(option => 
            option.setName('oponente')
                .setDescription('Entrenador a desafiar')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.deferred) await interaction.deferReply();

        const p1 = interaction.user;
        const p2 = interaction.options.getUser('oponente');

        if (p2.id === p1.id) return interaction.editReply('<a:no:1442565248115806278> **Error:** No puedes pelear contra ti mismo');
        if (p2.bot) return interaction.editReply('<a:no:1442565248115806278> **Error:** Los bots son pacifistas (por ahora)');

        const p1Data = getUserData(p1.id);
        const p2Data = getUserData(p2.id);

        if (p1Data.cards.length === 0) return interaction.editReply(`${EMOJIS.error} No tienes cartas. Usa \`/open\` primero.`);
        if (p2Data.cards.length === 0) return interaction.editReply(`${EMOJIS.error} Tu oponente no tiene mazo de combate.`);

        const vsBuffer = await createBattleVersus(p1, p2);
        const vsAttachment = new AttachmentBuilder(vsBuffer, { name: 'versus.png' });

        const inviteEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setImage('attachment://versus.png')

        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_duel').setLabel('ACEPTAR DUELO').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('deny_duel').setLabel('HUIR').setStyle(ButtonStyle.Danger)
        );

        const msg = await interaction.editReply({ 
            content: `> \`|\` <@${p2.id}> **te desafiarón a una batalla**`, 
            embeds: [inviteEmbed], 
            components: [inviteRow], 
            files: [vsAttachment] 
        });

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== p2.id) {
                return i.reply({ content: '<a:no:1442565248115806278> \`|\` Tú no eres el retador.', flags: 64 });
            }

            if (i.customId === 'deny_duel') {
                collector.stop();
                await i.update({ content: '<a:no:1442565248115806278> \`|\` **El oponente ha rechazado el combate**', embeds: [], components: [], files: [] });
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
        const embed = new EmbedBuilder()
            .setThumbnail("https://www.pokexperto.net/pokemongo/insignias/Badge_13_3_01.png")
            .setDescription("> `|` **Selecciona una carta para el combate:**")
            .setColor('#ff0000')
            .setFooter({ text: 'Los Shinys tienen +20% HP y +10% ATK' });

        if (!state[p1.id].selected) {
            rows.push(createCardMenu(p1, state[p1.id].cards, state[p1.id].page));
            rows.push(createPageButtons(p1, state[p1.id].page, state[p1.id].cards.length));
            embed.addFields({ name: `🔴 ${p1.username}`, value: '⏳ Seleccionando carta...', inline: true });
        } else {
            embed.addFields({ name: `🔴 ${p1.username}`, value: `**${state[p1.id].selected.card.name}**`, inline: true });
        }

        if (!state[p2.id].selected) {
            rows.push(createCardMenu(p2, state[p2.id].cards, state[p2.id].page));
            rows.push(createPageButtons(p2, state[p2.id].page, state[p2.id].cards.length));
            embed.addFields({ name: `🔵 ${p2.username}`, value: '⏳ Seleccionando carta...', inline: true });
        } else {
            embed.addFields({ name: `🔵 ${p2.username}`, value: `**${state[p2.id].selected.card.name}**`, inline: true });
        }

        return { content: `<@${p1.id}> <@${p2.id}>`, embeds: [embed], components: rows, files: [] };
    };

    const msg = await interaction.editReply(getPayload());
    const selector = msg.createMessageComponentCollector({ time: 120000 });

    selector.on('collect', async i => {
        const uid = i.user.id;
        if (!state[uid]) return i.reply({ content: 'Silencio en la grada.', flags: 64 });

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
            
            if (!stats) return i.followUp({ content: 'Error de conexión con la base de datos Pokémon.', flags: 64 });

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
        return new StringSelectMenuOptionBuilder()
            .setLabel(c.name)
            .setDescription(`ID: ${c.id} | ${c.isShiny ? '✨ SHINY BOOST' : 'Normal'}`)
            .setValue(c.uniqueId)
            .setEmoji(c.isShiny ? '✨' : '🔴');
    });

    if (options.length === 0) options.push(new StringSelectMenuOptionBuilder().setLabel('Vacío').setValue('empty'));

    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`sel_${user.id}`)
            .setPlaceholder(`${user.username}: Elige tu carta (Pág ${page+1})`)
            .addOptions(options)
            .setDisabled(options[0].data.value === 'empty')
    );
}

function createPageButtons(user, page, totalCards) {
    const maxPage = Math.ceil(totalCards / 25) - 1;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`prev_${user.id}`).setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId(`next_${user.id}`).setLabel('➡️').setStyle(ButtonStyle.Secondary).setDisabled(page >= maxPage)
    );
}

async function runBattle(interaction, f1, f2) {
    let attacker = f1.stats.spd >= f2.stats.spd ? f1 : f2;
    let defender = f1.stats.spd >= f2.stats.spd ? f2 : f1;

    let turn = 1;
    const maxTurns = 20;

    while (f1.stats.hp > 0 && f2.stats.hp > 0 && turn <= maxTurns) {
        const variance = (Math.random() * 0.4) + 0.8;
        let damage = Math.floor((attacker.stats.atk * variance) - (defender.stats.def * 0.3));
        
        if (damage < 15) damage = 15; 

        const isCrit = Math.random() < 0.15;
        if (isCrit) damage = Math.floor(damage * 1.7);

        defender.stats.hp -= damage;
        if (defender.stats.hp < 0) defender.stats.hp = 0;

        [attacker, defender] = [defender, attacker];
        turn++;
    }

    let winner = f1.stats.hp > 0 ? f1 : f2;
    let loser = f1.stats.hp > 0 ? f2 : f1;
    
    const prize = 150;
    addCoins(winner.user.id, prize);

    const resultBuffer = await generateBattleImage(f1, f2);
    const resultAttachment = new AttachmentBuilder(resultBuffer, { name: 'battle-result.png' });

    const embed = new EmbedBuilder()
        .setTitle(`🏆 ¡VICTORIA PARA ${winner.user.username.toUpperCase()}!`)
        .setDescription(`**${winner.stats.name}** se alza con la victoria tras **${turn-1} rondas** de combate.\n\n` + 
                        `> \`|\` **Ganador:** ${winner.user} (+${prize} ${EMOJIS.money})\n` +
                        `> \`|\` **Perdedor:** ${loser.user}`)
        .setColor(TYPE_COLORS.legendary || 0xFFD700)
        .setImage('attachment://battle-result.png') 
        .setFooter({ text: 'Combate finalizado • Zenith Battle System' });

    await interaction.editReply({ content: null, embeds: [embed], components: [], files: [resultAttachment] });
}