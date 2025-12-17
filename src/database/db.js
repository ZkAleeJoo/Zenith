// src/database/db.js
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
    // 1. TABLA USUARIOS (¡Esta era la que faltaba!)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            balance INTEGER DEFAULT 500,
            last_daily INTEGER DEFAULT 0
        )
    `).run();

    // 2. TABLA CÓDIGOS PREMIUM (Para los canjes)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS premium_codes (
            code TEXT PRIMARY KEY,
            days INTEGER,
            created_by TEXT,
            created_at INTEGER
        )
    `).run();

    // 3. MIGRACIÓN AUTOMÁTICA
    try {
        const tableInfo = db.pragma('table_info(users)');
        const hasPremium = tableInfo.some(col => col.name === 'is_premium');
        
        if (!hasPremium) {
            console.log('🔄 Actualizando base de datos a versión Premium...');
            db.prepare('ALTER TABLE users ADD COLUMN is_premium INTEGER DEFAULT 0').run();
            db.prepare('ALTER TABLE users ADD COLUMN premium_expires INTEGER DEFAULT 0').run();
            console.log('✅ Columnas Premium agregadas con éxito.');
        }
    } catch (error) {
        console.error("Error en migración:", error);
    }

    // 4. TABLA CARTAS
    db.prepare(`
        CREATE TABLE IF NOT EXISTS cards (
            uuid TEXT PRIMARY KEY,
            user_id TEXT,
            pokemon_id INTEGER,
            name TEXT,
            is_shiny INTEGER,
            types TEXT,
            obtained_at INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `).run();

    // 5. TABLA MERCADO
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

    console.log('✅ Base de datos SQLite conectada y tablas sincronizadas.');
};

initDB();

module.exports = db;