const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[ADVERTENCIA] Al comando en ${filePath} le falta "data" o "execute".`);
		}
	}
}

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
	try {

		const data = await rest.put(
			Routes.applicationCommands(process.env.CLIENT_ID, process.env.GUILD_ID), //process.env.GUILD_ID
			{ body: commands },
		);

		console.log(`✅ ¡Éxito! Se han registrado ${data.length} comandos GLOBALMENTE.`);
	} catch (error) {
		console.error('❌ Error fatal durante el despliegue:', error);
	}
})();