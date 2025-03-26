require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');

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

client.once('ready', () => {
    console.log(`Bot conectado como ${client.user.tag}`);
    client.guilds.cache.forEach(guild => {
        guild.commands.create(new SlashCommandBuilder()
            .setName('crear')
            .setDescription('Crear un canal para un usuario.')
            .addUserOption(option => option.setName('usuario').setDescription('El usuario para el canal').setRequired(true))
        );
    });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand() || interaction.commandName !== 'crear') return;

    const user = interaction.options.getUser('usuario');
    const channelName = `${user.username}-${user.id}`;

    const existingChannel = interaction.guild.channels.cache.find(channel => channel.name === channelName);
    if (existingChannel) {
        await interaction.reply({ content: `Ya existe un canal para ${user.username}.`, ephemeral: true });
        return;
    }

    try {
        const channel = await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
                }
            ],
        });
        await interaction.reply({ content: `Canal creado para ${user.username}: ${channel}`, ephemeral: true });
    } catch (error) {
        console.error('Error al crear el canal:', error);
        await interaction.reply({ content: 'No se pudo crear el canal.', ephemeral: true });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || message.channel.type !== ChannelType.GuildText) return;

    const userId = message.channel.name.split('-').pop();
    const user = await client.users.fetch(userId);
    if (!user) return;

    const tasks = [message.content.trim()].filter(task => task);
    if (tasks.length > 0) {
        await sendTaskMessages(user, tasks, message.channel);
    }
});

async function sendTaskMessages(user, tasks, channel) {
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

            const cleanTask = task.replace(/<[^>]+>/g, '').trim();

            const taskEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Tarea asignada')
                .setDescription(`**Tarea:**\n\`\`\`${cleanTask}\`\`\``)
                .setFooter({ text: 'Haz clic en el botón para marcar la tarea como completada o pendiente.' });

            await dmChannel.send({
                embeds: [taskEmbed],
                components: [row]
            });
            console.log(`Mensaje de tarea enviado a ${user.username}: ${cleanTask}`);
        }
    } catch (error) {
        console.error(`No se pudo enviar mensaje a ${user.tag}:`, error);
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    // Si es un botón de confirmación
    if (interaction.customId.startsWith('confirm_') || interaction.customId.startsWith('cancel_')) {
        const originalCustomId = interaction.customId.replace('confirm_', '').replace('cancel_', '');
        const user = interaction.user;
        const task = originalCustomId.split('_').slice(2).join(' ');

        // Si se canceló
        if (interaction.customId.startsWith('cancel_')) {
            await interaction.update({ content: 'Operación cancelada', components: [], ephemeral: true });
            return;
        }

        const cleanTask = task.replace(/<[^>]+>/g, '').trim();
        const color = originalCustomId.startsWith('task_complete') ? 0x28A745 : 0xFF0000;
        const status = originalCustomId.startsWith('task_complete') ? 'Completada' : 'Pendiente';

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
                { name: 'Estado', value: `${status === 'Completada' ? '✅' : '❌'} ${status}` },
                { name: 'Fecha y hora', value: `🕓 ${formattedDate}` }
            )
            .setFooter({ text: '¡Gracias por actualizar las tareas!' });

        try {
            // Obtener el canal de DM del usuario
            const dmChannel = await user.createDM();
            const messages = await dmChannel.messages.fetch();
            const taskMessage = messages.find(msg => 
                msg.embeds.length > 0 && 
                msg.embeds[0].data.description && 
                msg.embeds[0].data.description.includes(cleanTask)
            );

            if (taskMessage) {
                // Actualizar el mensaje original sin botones
                const originalEmbed = taskMessage.embeds[0];
                await taskMessage.edit({ embeds: [originalEmbed], components: [] });
            }
        } catch (error) {
            console.error('Error al actualizar el mensaje original:', error);
        }

        const guildId = process.env.GUILD_ID;
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            const channel = guild.channels.cache.find(channel => channel.name === `${user.username}-${user.id}`);
            if (channel) {
                await channel.send({ embeds: [embed] });
            } else {
                console.log(`Canal no encontrado para el usuario ${user.username}`);
            }
        } else {
            console.log(`Servidor no encontrado con ID ${guildId}`);
        }

        await interaction.update({ content: `Tarea ${status.toLowerCase()}: ${cleanTask}`, components: [] });
        return;
    }

    // Si es un botón original de tarea
    const customId = interaction.customId;
    const isComplete = customId.startsWith('task_complete');
    const task = customId.split('_').slice(2).join(' ');

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_${customId}`)
                .setLabel('✔ Confirmar')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`cancel_${customId}`)
                .setLabel('❌ Cancelar')
                .setStyle(ButtonStyle.Danger)
        );

    await interaction.reply({
        content: `¿Estás seguro de marcar esta tarea como ${isComplete ? 'completada' : 'pendiente'}?`,
        components: [row],
        ephemeral: true
    });
});

client.login(process.env.DISCORD_BOT_TOKEN);
