const Canvas = require('canvas');
const path = require('path');
const fs = require('fs');
const { LEGENDARY_IDS, TYPE_COLORS } = require('./constants'); 

const fontFamily = 'Press Start 2P'; 
const fontPath = path.join(__dirname, '../assets/fonts/PressStart2P-Regular.ttf');

if (fs.existsSync(fontPath)) {
    try {
        Canvas.registerFont(fontPath, { family: fontFamily });
    } catch (e) { }
}

const applyText = (canvas, text, maxWidth, initialSize = 30) => {
    const ctx = canvas.getContext('2d');
    let fontSize = initialSize;
    do {
        ctx.font = `${fontSize -= 2}px '${fontFamily}'`;
    } while (ctx.measureText(text).width > maxWidth && fontSize > 10);
    return ctx.font;
};

function drawGradient(ctx, width, height) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1c2c'); 
    gradient.addColorStop(1, '#4a1c40'); 
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}

module.exports = {
    createProfileCard: async (user, userData, rank) => {
        const canvas = Canvas.createCanvas(700, 250);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const bgPath = path.join(__dirname, '../assets/img/profile-bg.png');
        if (fs.existsSync(bgPath)) {
            try {
                const background = await Canvas.loadImage(bgPath);
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
            } catch (error) { drawGradient(ctx, canvas.width, canvas.height); }
        } else { drawGradient(ctx, canvas.width, canvas.height); }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(20, 20, 660, 210);
        const isPremium = userData.isPremium; 
        ctx.strokeStyle = isPremium ? '#FFD700' : '#FFFFFF'; 
        ctx.lineWidth = isPremium ? 5 : 3;
        ctx.strokeRect(20, 20, 660, 210);

        ctx.fillStyle = '#ffffff';
        ctx.font = applyText(canvas, user.username, 300, 35);
        ctx.fillText(user.username.toUpperCase(), 250, 75);

        ctx.fillStyle = '#F1C40F';
        ctx.font = `14px '${fontFamily}'`; 
        ctx.fillText(`Rango: ${rank}`, 250, 110);

        const cards = userData.cards || [];
        const shinyCount = cards.filter(c => c.isShiny).length;
        const legendCount = cards.filter(c => LEGENDARY_IDS.includes(c.id)).length;

        ctx.fillStyle = '#ffffff';
        ctx.font = `12px '${fontFamily}'`; 
        ctx.fillText(`💰 Dinero: ${userData.balance}`, 250, 150);
        ctx.fillText(`🃏 Cartas: ${cards.length}`, 480, 150);
        
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`✨ Shinys: ${shinyCount}`, 250, 185);
        ctx.fillStyle = '#9B59B6';
        ctx.fillText(`👑 Legends: ${legendCount}`, 480, 185);

        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
        const avatar = await Canvas.loadImage(avatarURL);
        ctx.drawImage(avatar, 45, 45, 160, 160);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(125, 125, 80, 0, Math.PI * 2, true);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#F1C40F';
        ctx.stroke();

        return canvas.toBuffer();
    },

    createCollectionCard: async (user, cardsPage, pageNum, totalPages) => {
        const width = 1000;
        const height = 1200; 
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        drawGradient(ctx, width, height); 

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `40px '${fontFamily}'`;
        ctx.textAlign = 'center';
        ctx.fillText(`COLECCION DE ${user.username.toUpperCase()}`, width / 2, 80);

        ctx.font = `20px '${fontFamily}'`;
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`Pagina ${pageNum} de ${totalPages}`, width / 2, 120);
        ctx.textAlign = 'left'; 

        const cardW = 250;
        const cardH = 300;
        const gapX = 50;
        const gapY = 60;
        const startX = (width - (cardW * 3 + gapX * 2)) / 2; 
        const startY = 160;

        for (let i = 0; i < cardsPage.length; i++) {
            const card = cardsPage[i];
            
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);

            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(x, y, cardW, cardH);

            const mainType = card.types.split(' | ')[0].toLowerCase();
            const typeColorHex = TYPE_COLORS[mainType] || TYPE_COLORS.base;
            const typeColorString = '#' + typeColorHex.toString(16).padStart(6, '0');

            let borderColor = typeColorString; 

            let isLegend = LEGENDARY_IDS.includes(card.id);

            if (isLegend) borderColor = '#9B59B6';
            if (card.isShiny) borderColor = '#FFD700'; 
            if (isLegend && card.isShiny) borderColor = '#E74C3C';

            ctx.strokeStyle = borderColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, cardW, cardH);

            try {
                let imageUrl;
                if (card.isShiny) {
                    imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/${card.id}.png`;
                } else {
                    imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${card.id}.png`;
                }

                const pokemonImage = await Canvas.loadImage(imageUrl);
                ctx.drawImage(pokemonImage, x + 25, y + 25, 200, 200);

            } catch (err) {
                ctx.fillStyle = '#555';
                ctx.font = `80px '${fontFamily}'`;
                ctx.fillText("?", x + 100, y + 180);
            }

            let displayName = card.name;
            if (displayName.length > 12) displayName = displayName.substring(0, 10) + '.';

            ctx.fillStyle = '#FFFFFF';
            ctx.font = `16px '${fontFamily}'`;
            ctx.textAlign = 'center';
            ctx.fillText(displayName, x + cardW / 2, y + 260);

            ctx.fillStyle = borderColor; 
            ctx.font = `12px '${fontFamily}'`;
            ctx.fillText(`#${card.id}`, x + cardW / 2, y + 285);
            ctx.textAlign = 'left'; 

            if (card.isShiny) {
                ctx.fillStyle = '#FFD700';
                ctx.font = `20px Arial`; 
                ctx.fillText("✨", x + 10, y + 30);
            }
            if (isLegend) {
                ctx.fillStyle = '#9B59B6';
                ctx.fillText("👑", x + cardW - 30, y + 30);
            }
        }

        return canvas.toBuffer();
    },


    createTradeCard: async (userA, cardA, userB, cardB) => {
        const width = 800;
        const height = 400;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; 

        const gradA = ctx.createLinearGradient(0, 0, width / 2, height);
        gradA.addColorStop(0, '#1a1c2c');
        gradA.addColorStop(1, '#2c3e50');
        ctx.fillStyle = gradA;
        ctx.fillRect(0, 0, width / 2, height);

        const gradB = ctx.createLinearGradient(width / 2, 0, width, height);
        gradB.addColorStop(0, '#4a1c40');
        gradB.addColorStop(1, '#2c1a2c');
        ctx.fillStyle = gradB;
        ctx.fillRect(width / 2, 0, width / 2, height);

        ctx.beginPath();
        ctx.moveTo(380, 0);
        ctx.lineTo(420, 400);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 5;
        ctx.stroke();

        const drawAvatar = async (user, x, y) => {
            try {
                const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
                const avatar = await Canvas.loadImage(avatarURL);
                ctx.save();
                ctx.globalAlpha = 0.2; 
                ctx.beginPath();
                ctx.arc(x, y, 100, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, x - 100, y - 100, 200, 200);
                ctx.restore();
            } catch (e) {}
        };
        await drawAvatar(userA, 100, 200);
        await drawAvatar(userB, 700, 200);

        const drawCard = async (card, x, y) => {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(x, y, 160, 200);
            
            const mainType = card.types.split(' | ')[0].toLowerCase();
            const typeColorHex = TYPE_COLORS[mainType] || TYPE_COLORS.base;
            const borderColor = '#' + typeColorHex.toString(16).padStart(6, '0');
            
            ctx.strokeStyle = card.is_shiny ? '#FFD700' : borderColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, 160, 200);

            try {
                const url = card.is_shiny 
                    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/shiny/${card.pokemon_id}.png`
                    : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${card.pokemon_id}.png`;
                const img = await Canvas.loadImage(url);
                ctx.drawImage(img, x + 10, y + 10, 140, 140);
            } catch(e) {}

            ctx.fillStyle = '#FFF';
            ctx.font = `14px '${fontFamily}'`;
            ctx.textAlign = 'center';
            let name = card.name;
            if (name.length > 10) name = name.substring(0, 9) + '.';
            ctx.fillText(name, x + 80, y + 180);
        };

        await drawCard(cardA, 220, 100);
        await drawCard(cardB, 420, 100); 

        ctx.fillStyle = '#FFF';
        ctx.font = `40px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('⇄', 400, 215);

        ctx.font = `25px '${fontFamily}'`;
        ctx.fillStyle = '#2ECC71'; 
        ctx.fillText('INTERCAMBIO REALIZADO', 400, 50);

        ctx.font = `16px '${fontFamily}'`;
        ctx.fillStyle = '#AAA';
        ctx.fillText(userA.username, 100, 350);
        ctx.fillText(userB.username, 700, 350);

        return canvas.toBuffer();
    },


    // ... (después de createTradeCard) ...

    // --- FUNCIÓN: INSPECTOR DE CARTA (SLAB STYLE) ---
    createCardSlab: async (cardDB, pokeApiData) => {
        const width = 500;
        const height = 800;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false; // Mantenemos el estilo nítido

        // --- COLORES SEGÚN TIPO/RAREZA ---
        const mainType = cardDB.types.split(' | ')[0].toLowerCase();
        const typeColorHex = TYPE_COLORS[mainType] || TYPE_COLORS.base;
        const typeColorString = '#' + typeColorHex.toString(16).padStart(6, '0');

        let headerColor = typeColorString;
        let labelTextColor = '#FFFFFF';
        let tagText = "ZENITH CERTIFIED";
        
        if (cardDB.is_shiny) {
            headerColor = '#FFD700'; // Dorado
            labelTextColor = '#000000';
            tagText = "✨ SHINY GEM MINT";
        }
        if (LEGENDARY_IDS.includes(cardDB.pokemon_id)) {
            headerColor = '#9B59B6'; // Morado
             tagText = "👑 LEGENDARY TIER";
        }
        if (cardDB.is_shiny && LEGENDARY_IDS.includes(cardDB.pokemon_id)) {
            headerColor = '#E74C3C'; // Rojo Místico
            labelTextColor = '#FFFFFF';
            tagText = "🔥 ULTIMATE GOD TIER 🔥";
        }

        // 1. LA CARCASA DE PLÁSTICO (Fondo)
        // Un degradado gris claro para simular plástico duro
        const slabGrad = ctx.createLinearGradient(0, 0, width, height);
        slabGrad.addColorStop(0, '#E8E8E8');
        slabGrad.addColorStop(1, '#C0C0C0');
        ctx.fillStyle = slabGrad;
        
        // Dibujamos el cuerpo principal con esquinas redondeadas
        roundRect(ctx, 20, 20, width - 40, height - 40, 30, true, false);

        // Borde exterior del plástico
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 5;
        roundRect(ctx, 20, 20, width - 40, height - 40, 30, false, true);


        // 2. LA ETIQUETA SUPERIOR (Header)
        ctx.fillStyle = headerColor;
        roundRect(ctx, 40, 40, width - 80, 130, 15, true, false);
        
        // Borde interno de la etiqueta
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 2;
        roundRect(ctx, 45, 45, width - 90, 120, 10, false, true);

        // --- TEXTO DE LA ETIQUETA ---
        ctx.fillStyle = labelTextColor;
        ctx.textAlign = 'center';

        // Título principal (Nombre)
        ctx.font = `35px '${fontFamily}'`;
        let displayName = cardDB.name.toUpperCase();
        if (displayName.length > 12) displayName = displayName.substring(0, 11) + '.';
        ctx.fillText(displayName, width / 2, 100);

        // Subtítulo (Tag de rareza)
        ctx.font = `14px '${fontFamily}'`;
        ctx.fillText(tagText, width / 2, 130);

        // ID y Fecha pequeño
        ctx.font = `10px sans-serif`;
        const dateObtained = new Date(cardDB.obtained_at).toLocaleDateString();
        ctx.fillText(`ID #${cardDB.pokemon_id} | Capturado: ${dateObtained}`, width / 2, 155);


        // 3. EL HUECO DE LA CARTA (Recess Area)
        // Un fondo oscuro donde se asienta la carta
        ctx.fillStyle = '#2A2A2A';
        const cardWellY = 200;
        const cardWellHeight = height - cardWellY - 60;
        roundRect(ctx, 60, cardWellY, width - 120, cardWellHeight, 10, true, false);

        // 4. LA IMAGEN DEL POKÉMON
        try {
            const url = cardDB.is_shiny 
                ? pokeApiData.sprites.other['home'].front_shiny 
                : pokeApiData.sprites.other['official-artwork'].front_default;
            
            const img = await Canvas.loadImage(url);
            
            // Mantener aspecto de carta (más alta que ancha)
            const imgWidth = width - 140;
            const imgHeight = imgWidth * 1.4; // Relación de aspecto típica de TCG

            // Centrar la imagen en el hueco
            const imgX = 70;
            const imgY = cardWellY + (cardWellHeight - imgHeight) / 2;

            ctx.drawImage(img, imgX, imgY, imgWidth, imgHeight);

            // Marco interno de la carta
            ctx.strokeStyle = headerColor;
            ctx.lineWidth = 4;
            ctx.strokeRect(imgX, imgY, imgWidth, imgHeight);

        } catch(e) {
            ctx.fillStyle = '#FFF';
            ctx.font = `50px sans-serif`;
            ctx.fillText("?", width/2, height/2 + 100);
        }

        // 5. ESTADÍSTICAS EN EL PIE DE LA CARTA
        const statsY = height - 80;
        ctx.fillStyle = '#333';
        ctx.fillRect(70, statsY, width - 140, 40);
        
        ctx.fillStyle = '#FFF';
        ctx.font = `14px '${fontFamily}'`;
        ctx.textAlign = 'left';
        const hp = pokeApiData.stats[0].base_stat;
        const atk = pokeApiData.stats[1].base_stat;
        const def = pokeApiData.stats[2].base_stat;
        ctx.fillText(`HP ${hp} | ATK ${atk} | DEF ${def}`, 85, statsY + 28);

        // Efecto de brillo final sobre el plástico (opcional, le da realismo)
        const glossGrad = ctx.createLinearGradient(0, 0, width, height);
        glossGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        glossGrad.addColorStop(0.5, 'rgba(255,255,255,0.0)');
        glossGrad.addColorStop(1, 'rgba(255,255,255,0.2)');
        ctx.fillStyle = glossGrad;
        roundRect(ctx, 20, 20, width - 40, height - 40, 30, true, false);


        return canvas.toBuffer();
    },

    createBattleVersus: async (user1, user2) => {
        const width = 800;
        const height = 300;
        const canvas = Canvas.createCanvas(width, height);
        const ctx = canvas.getContext('2d');


        const grad1 = ctx.createLinearGradient(0, 0, width/2, height);
        grad1.addColorStop(0, '#8B0000'); 
        grad1.addColorStop(1, '#2c0000');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width/2 + 50, height); 

        const grad2 = ctx.createLinearGradient(width/2, 0, width, height);
        grad2.addColorStop(0, '#00008B'); 
        grad2.addColorStop(1, '#00002c');
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(width/2 - 50, 0); 
        ctx.lineTo(width, 0);
        ctx.lineTo(width, height);
        ctx.lineTo(width/2 + 50, height);
        ctx.closePath();
        ctx.fillStyle = grad2;
        ctx.fill();
        ctx.restore();

        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(width/2 - 50, -10);
        ctx.lineTo(width/2 + 50, height + 10);
        ctx.stroke();

        const drawAvatar = async (user, x, align) => {
            try {
                const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256 });
                const img = await Canvas.loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, 150, 80, 0, Math.PI * 2);
                ctx.lineWidth = 8;
                ctx.strokeStyle = '#FFFFFF';
                ctx.stroke();
                ctx.clip();
                ctx.drawImage(img, x - 80, 70, 160, 160);
                ctx.restore();
            } catch (e) {}
        };

        await drawAvatar(user1, 150);
        await drawAvatar(user2, 650);

        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#FFD700'; 
        ctx.font = `italic 80px sans-serif`;
        try { ctx.font = `80px '${fontFamily}'`; } catch(e){} 
        ctx.textAlign = 'center';
        ctx.fillText('VS', width/2, 175);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `20px '${fontFamily}'`;
        ctx.fillText(user1.username.toUpperCase(), 150, 260);
        ctx.fillText(user2.username.toUpperCase(), 650, 260);

        return canvas.toBuffer();
    }
};

function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
    if (typeof stroke === 'undefined') { stroke = true; }
    if (typeof radius === 'undefined') { radius = 5; }
    if (typeof radius === 'number') {
        radius = {tl: radius, tr: radius, br: radius, bl: radius};
    } else {
        var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
        for (var side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) { ctx.fill(); }
    if (stroke) { ctx.stroke(); }
}