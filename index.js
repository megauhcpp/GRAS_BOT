const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Token del bot (reemplázalo con tu token)
require('dotenv').config();
const TOKEN = process.env.DISCORD_BOT_TOKEN;

// Objeto para almacenar tareas
const tasks = {};

client.on('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    // Ignorar mensajes del propio bot
    if (message.author.bot) return;

    const args = message.content.split(' ');
    const command = args.shift().toLowerCase();

    if (command === '!asignar') {
        const usuario = message.mentions.users.first();
        const tarea = args.slice(1).join(' ');

        if (!usuario || !tarea) {
            return message.reply('Uso correcto: !asignar @usuario tarea');
        }

        if (!tasks[usuario.id]) {
            tasks[usuario.id] = [];
        }

        tasks[usuario.id].push(tarea);
        message.reply(`Tarea asignada a ${usuario.username}: ${tarea}`);
    }

    if (command === '!tareas') {
        const usuario = message.mentions.users.first() || message.author;

        if (!tasks[usuario.id] || tasks[usuario.id].length === 0) {
            return message.reply(`${usuario.username} no tiene tareas asignadas.`);
        }

        const listaTareas = tasks[usuario.id].map((t, index) => `${index + 1}. ${t}`).join('\n');
        message.reply(`Tareas de ${usuario.username}:\n${listaTareas}`);
    }
});

client.login(TOKEN);