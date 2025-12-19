const db = require('../database/db');
const { Crypto } = require('crypto'); 

const formatCard = (row) => ({
    uniqueId: row.uuid,
    id: row.pokemon_id,
    name: row.name,
    isShiny: Boolean(row.is_shiny), 
    types: row.types,
    obtainedAt: row.obtained_at
});

module.exports = {

    // --- USUARIOS ---
    getUserData: (userId) => {
        let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

        if (!user) {
            db.prepare('INSERT INTO users (id) VALUES (?)').run(userId);
            user = { id: userId, balance: 500, last_daily: 0, is_premium: 0, premium_expires: 0 };
        }

        const cardsRaw = db.prepare('SELECT * FROM cards WHERE user_id = ?').all(userId);
        
        return {
            userId: user.id,
            balance: user.balance,
            lastDaily: user.last_daily,
            lastWork: user.last_work || 0,
            isPremium: Boolean(user.is_premium), 
            premiumExpires: user.premium_expires,
            cards: cardsRaw.map(formatCard)
        };
    },

    addCoins: (userId, amount) => {
        module.exports.getUserData(userId); 
        const stmt = db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
        stmt.run(amount, userId);
    },

    removeCoins: (userId, amount) => {
        const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
        if (!user || user.balance < amount) return false;

        db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(amount, userId);
        return true;
    },

    setDaily: (userId) => {
        module.exports.getUserData(userId); 
        db.prepare('UPDATE users SET last_daily = ? WHERE id = ?').run(Date.now(), userId);
    },

    // --- SISTEMA PREMIUM---

    givePremium: (userId, days) => {
        module.exports.getUserData(userId); 

        const durationMs = days * 24 * 60 * 60 * 1000;
        const user = db.prepare('SELECT premium_expires FROM users WHERE id = ?').get(userId);
        
        let newExpire;
        const now = Date.now();

        if (user.premium_expires > now) {
            newExpire = user.premium_expires + durationMs;
        } else {
            newExpire = now + durationMs;
        }

        db.prepare('UPDATE users SET is_premium = 1, premium_expires = ? WHERE id = ?')
          .run(newExpire, userId);

        return newExpire;
    },

    removePremium: (userId) => {
        db.prepare('UPDATE users SET is_premium = 0, premium_expires = 0 WHERE id = ?').run(userId);
    },

    // --- CÓDIGOS PREMIUM ---

    createPremiumCode: (adminId, days) => {
        const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const code = `ZENITH-${part1}-${part2}`;

        db.prepare('INSERT INTO premium_codes (code, days, created_by, created_at) VALUES (?, ?, ?, ?)').run(
            code, days, adminId, Date.now()
        );

        return code;
    },

    redeemPremiumCode: (userId, codeInput) => {
        const redeemTransaction = db.transaction(() => {
            const codeData = db.prepare('SELECT * FROM premium_codes WHERE code = ?').get(codeInput);
            if (!codeData) throw new Error("Código inválido o ya usado.");

            module.exports.givePremium(userId, codeData.days);

            db.prepare('DELETE FROM premium_codes WHERE code = ?').run(codeInput);

            return codeData.days;
        });

        try {
            return redeemTransaction();
        } catch (err) {
            console.error(err); 
            return false;
        }
    },

    // --- CARTAS Y MERCADO ---

    addCard: (userId, pokemonData) => {
        module.exports.getUserData(userId);

        const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
        const stmt = db.prepare(`
            INSERT INTO cards (uuid, user_id, pokemon_id, name, is_shiny, types, obtained_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            uniqueId, userId, pokemonData.id, pokemonData.name,
            pokemonData.isShiny ? 1 : 0, pokemonData.types, Date.now()
        );
        return true;
    },

    getMarketListings: () => {
        const listings = db.prepare(`
            SELECT m.market_id, m.seller_id, m.price, m.listed_at,
                   c.uuid, c.pokemon_id, c.name, c.is_shiny, c.types, c.obtained_at
            FROM market m JOIN cards c ON m.card_uuid = c.uuid
        `).all();

        return listings.map(row => ({
            marketId: row.market_id,
            sellerId: row.seller_id,
            price: row.price,
            listedAt: row.listed_at,
            card: {
                uniqueId: row.uuid, id: row.pokemon_id, name: row.name,
                isShiny: Boolean(row.is_shiny), types: row.types, obtainedAt: row.obtained_at
            }
        }));
    },

    postToMarket: (userId, pokemonId, price) => {
        const postTransaction = db.transaction(() => {
            const card = db.prepare('SELECT uuid, name FROM cards WHERE user_id = ? AND pokemon_id = ? LIMIT 1').get(userId, pokemonId);
            if (!card) throw new Error("No tienes ese Pokémon disponible.");

            const marketId = Math.random().toString(36).substring(2, 8).toUpperCase();
            db.prepare('UPDATE cards SET user_id = ? WHERE uuid = ?').run('MARKET_SYSTEM', card.uuid);
            db.prepare('INSERT INTO market (market_id, seller_id, card_uuid, price, listed_at) VALUES (?, ?, ?, ?, ?)').run(
                marketId, userId, card.uuid, parseInt(price), Date.now()
            );
            return { success: true, marketId, cardName: card.name };
        });
        try { return postTransaction(); } catch (err) { return { success: false, message: err.message }; }
    },

    buyFromMarket: (buyerId, marketId) => {
        const buyTransaction = db.transaction(() => {
            const listing = db.prepare(`
                SELECT m.*, c.name as card_name, c.uuid as card_uuid 
                FROM market m JOIN cards c ON m.card_uuid = c.uuid 
                WHERE m.market_id = ?
            `).get(marketId);

            if (!listing) throw new Error("Esa oferta ya no existe.");
            if (listing.seller_id === buyerId) throw new Error("No puedes comprar tu propia carta.");

            const buyer = db.prepare('SELECT balance FROM users WHERE id = ?').get(buyerId);
            if (!buyer || buyer.balance < listing.price) throw new Error("No tienes suficiente dinero.");

            db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(listing.price, buyerId);
            db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(listing.price, listing.seller_id);
            db.prepare('UPDATE cards SET user_id = ? WHERE uuid = ?').run(buyerId, listing.card_uuid);
            db.prepare('DELETE FROM market WHERE market_id = ?').run(marketId);

            const fullCard = db.prepare('SELECT * FROM cards WHERE uuid = ?').get(listing.card_uuid);
            return { success: true, card: formatCard(fullCard), price: listing.price };
        });
        try { return buyTransaction(); } catch (err) { return { success: false, message: err.message }; }
    },

    removeMarketListing: (userId, marketId) => {
        const removeTransaction = db.transaction(() => {
            const listing = db.prepare(`
                SELECT m.*, c.name as card_name 
                FROM market m JOIN cards c ON m.card_uuid = c.uuid 
                WHERE m.market_id = ?
            `).get(marketId);

            if (!listing) throw new Error("Esa oferta no existe.");
            if (listing.seller_id !== userId) throw new Error("No es tu oferta.");

            db.prepare('UPDATE cards SET user_id = ? WHERE uuid = ?').run(userId, listing.card_uuid);
            db.prepare('DELETE FROM market WHERE market_id = ?').run(marketId);
            return { success: true, cardName: listing.card_name };
        });
        try { return removeTransaction(); } catch (err) { return { success: false, message: err.message }; }
    },

    processEvolution: (userId, cardsToBurn, newPokemonData) => {
        const evolutionTransaction = db.transaction(() => {
            for (const uuid of cardsToBurn) {
                const card = db.prepare('SELECT uuid FROM cards WHERE uuid = ? AND user_id = ?').get(uuid, userId);
                if (!card) throw new Error(`La carta ${uuid} ya no existe o no es tuya.`);
            }
            const deleteStmt = db.prepare('DELETE FROM cards WHERE uuid = ?');
            for (const uuid of cardsToBurn) { deleteStmt.run(uuid); }

            const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            db.prepare(`
                INSERT INTO cards (uuid, user_id, pokemon_id, name, is_shiny, types, obtained_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(uniqueId, userId, newPokemonData.id, newPokemonData.name, newPokemonData.isShiny ? 1 : 0, newPokemonData.types, Date.now());
            return true;
        });
        try { return evolutionTransaction(); } catch (error) { return false; }
    },

    processTrade: (userA_id, pokeID_A, userB_id, pokeID_B) => {
        const tradeTransaction = db.transaction(() => {
            const cardA = db.prepare('SELECT uuid, name, is_shiny, pokemon_id, types FROM cards WHERE pokemon_id = ? AND user_id = ? LIMIT 1').get(pokeID_A, userA_id);
            if (!cardA) throw new Error(`El usuario <@${userA_id}> ya no tiene la carta #${pokeID_A}.`);

            const cardB = db.prepare('SELECT uuid, name, is_shiny, pokemon_id, types FROM cards WHERE pokemon_id = ? AND user_id = ? LIMIT 1').get(pokeID_B, userB_id);
            if (!cardB) throw new Error(`El usuario <@${userB_id}> ya no tiene la carta #${pokeID_B}.`);

            db.prepare('UPDATE cards SET user_id = ? WHERE uuid = ?').run(userB_id, cardA.uuid);
            db.prepare('UPDATE cards SET user_id = ? WHERE uuid = ?').run(userA_id, cardB.uuid);
            return { success: true, cardA: cardA, cardB: cardB };
        });
        try { return tradeTransaction(); } catch (err) { return { success: false, message: err.message }; }
    },

    // --- SISTEMA DE RANKING ---
    getLeaderboard: (type) => {
    if (type === 'money') {
        return db.prepare('SELECT id, balance FROM users WHERE id != "MARKET_SYSTEM" ORDER BY balance DESC LIMIT 10').all();
    } else if (type === 'cards') {
        return db.prepare('SELECT user_id as id, COUNT(*) as count FROM cards WHERE user_id != "MARKET_SYSTEM" GROUP BY user_id ORDER BY count DESC LIMIT 10').all();
    } else if (type === 'shinys') {
        return db.prepare('SELECT user_id as id, COUNT(*) as count FROM cards WHERE is_shiny = 1 AND user_id != "MARKET_SYSTEM" GROUP BY user_id ORDER BY count DESC LIMIT 10').all();
    }
    return [];
},


    getCardByUUID: (userId, cardUuid) => {
        const card = db.prepare('SELECT * FROM cards WHERE LOWER(uuid) = LOWER(?) AND user_id = ?').get(cardUuid, userId);
        return card; 
    },

    setWork: (userId) => {
    module.exports.getUserData(userId); 
    db.prepare('UPDATE users SET last_work = ? WHERE id = ?').run(Date.now(), userId);
},
};