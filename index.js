require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions
    ]
});

const TASKS_CHANNEL_ID = '1354404488559071443'; // Canal privado donde se registran tareas completadas
const TICK_EMOJI = '✔';
const CROSS_EMOJI = '❌';

client.once('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
});

// Detectar cuando se crea un mensaje
client.on('messageCreate', async (message) => {
    // Solo procesar mensajes que contengan tareas separadas por saltos de línea
    if (message.author.bot || !message.content.includes('\n')) return;

    const tasks = message.content.split('\n').map(task => task.trim()).filter(task => task);
    const mentionedUser = message.mentions.users.first();

    // Si se menciona a un usuario y hay tareas, enviamos los mensajes con botones
    if (mentionedUser && tasks.length > 0) {
        await sendTaskMessages(mentionedUser, tasks);
    }
});

// Función para enviar las tareas con botones
async function sendTaskMessages(user, tasks) {
    try {
        const dmChannel = await user.createDM();
        console.log(`Enviando tareas a ${user.username}`);

        for (const task of tasks) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`task_complete_${task}`)
                        .setLabel('✔ Completado')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`task_pending_${task}`)
                        .setLabel('❌ Pendiente')
                        .setStyle(ButtonStyle.Danger)
                );

            // Eliminar las menciones y otros caracteres innecesarios (eliminar TODO lo que está dentro de <>)
            const cleanTask = task.replace(/<[^>]+>/g, '').trim(); // Eliminar todo lo que está entre <> (incluidos los propios signos)

            const taskEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Tarea asignada')
                .setDescription(`**Tarea:**\n\`\`\`${cleanTask}\`\`\``)
                .setFooter({ text: 'Haz clic en el botón para marcar la tarea como completada o pendiente.' });

            const taskMsg = await dmChannel.send({
                embeds: [taskEmbed],
                components: [row]
            });
            console.log(`Mensaje de tarea enviado a ${user.username}: ${cleanTask}`);
        }
    } catch (error) {
        console.error(`No se pudo enviar mensaje a ${user.tag}:`, error);
    }
}

// Procesar la interacción de los botones
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const user = interaction.user;
    const task = interaction.customId.split('_').slice(2).join(' '); // Obtener la tarea del customId

    // Canal privado para las tareas
    const tasksChannel = await client.channels.fetch(TASKS_CHANNEL_ID);

    // Eliminar las menciones y los signos de "<>" al transferir el mensaje
    const cleanTask = task.replace(/<[^>]+>/g, '').trim(); // Eliminar todo lo que está entre <> (incluidos los propios signos)

    // Establecer el color dependiendo del estado de la tarea
    const color = interaction.customId.startsWith('task_complete') ? 0x28A745 : 0xFF0000; // Verde para completada, rojo para pendiente
    const status = interaction.customId.startsWith('task_complete') ? 'Completada' : 'Pendiente';

    // Obtener la fecha y hora actuales
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
    });

    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('Actualización de tarea')
        .setDescription(`**${user.username}** ha actualizado el estado de la tarea: "${cleanTask}"`)
        .addFields(
            { name: 'Estado', value: `✅ ${status}` },
            { name: 'Fecha y hora', value: `🕓 ${formattedDate}` }
        )
        .setFooter({ text: '¡Gracias por actualizar las tareas!' });

    if (interaction.customId.startsWith('task_complete')) {
        await tasksChannel.send({ embeds: [embed] });
        await interaction.update({ content: `Tarea completada: ${cleanTask}`, components: [] });
    } else if (interaction.customId.startsWith('task_pending')) {
        await tasksChannel.send({ embeds: [embed] });
        await interaction.update({ content: `Tarea pendiente: ${cleanTask}`, components: [] });
    }
});

client.login(process.env.DISCORD_BOT_TOKEN);
