const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'zenith.sqlite'), { verbose: null }); 
db.pragma('journal_mode = WAL');

const initDB = () => {
    // 1. USUARIOS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            balance INTEGER DEFAULT 500,
            last_daily INTEGER DEFAULT 0,
            is_premium INTEGER DEFAULT 0, 
            premium_expires INTEGER DEFAULT 0
        )
    `).run();

    // 2. CÓDIGOS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS premium_codes (
            code TEXT PRIMARY KEY,
            days INTEGER,
            created_by TEXT,
            created_at INTEGER
        )
    `).run();

    // 3. CARTAS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS cards (
            uuid TEXT PRIMARY KEY,
            user_id TEXT,
            card_id TEXT, 
            name TEXT,
            supertype TEXT,
            rarity TEXT,
            types TEXT,
            set_name TEXT,
            image_url TEXT,
            obtained_at INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();

    // 4. MERCADO (Adaptado a la nueva estructura de cartas)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS market (
            market_id TEXT PRIMARY KEY,
            seller_id TEXT,
            card_uuid TEXT UNIQUE,
            price INTEGER,
            listed_at INTEGER,
            FOREIGN KEY(seller_id) REFERENCES users(id),
            FOREIGN KEY(card_uuid) REFERENCES cards(uuid) ON DELETE CASCADE
        )
    `).run();

    console.log('✅ Base de datos Zenith TCG conectada y actualizada.');
};

initDB();

module.exports = db;