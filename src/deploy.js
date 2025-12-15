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
			console.log(`Al comando en ${filePath} le falta "data" o "execute".`);
		}
	}
}

const rest = new REST().setToken(process.env.TOKEN);


(async () => {
	try {
		console.log(`Iniciando actualización de ${commands.length} comandos ( Modo Desarrollo / Local ).`);

	
		const data = await rest.put(
			Routes.applicationGuildCommands(process.env.CLIENT_ID),
			{ body: commands },
		);

		console.log(`¡Éxito! Se recargaron ${data.length} comandos LOCALMENTE.`);
	} catch (error) {
		console.error(error);
	}
})();