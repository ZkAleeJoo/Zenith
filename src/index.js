const { Client, Collection, GatewayIntentBits } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.commands = new Collection();

// --- CARGADOR DE COMANDOS ---
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[ADVERTENCIA] El comando en ${filePath} falta "data" o "execute".`);
        }
    }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);

    // --- CARGADOR DE EVENTOS ---
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get('/api/stats', (req, res) => {
    res.json({
        servers: client.guilds.cache.size,
        users: client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
        ping: client.ws.ping
    });
});

app.listen(PORT, '0.0.0.0', () => { 
    console.log(`📡 API del Bot escuchando en el puerto ${PORT}`);
});

client.login(process.env.TOKEN);

// --- SISTEMA ANTI-CRASH---
process.on('unhandledRejection', (reason, p) => {
    console.log(' [Anti-Crash] :: Unhandled Rejection/Catch');
    console.log(reason, p);
});

process.on('uncaughtException', (err, origin) => {
    console.log(' [Anti-Crash] :: Uncaught Exception/Catch');
    console.log(err, origin);
});

process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.log(' [Anti-Crash] :: Uncaught Exception/Catch (MONITOR)');
    console.log(err, origin);
});