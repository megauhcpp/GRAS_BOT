require('dotenv').config();
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder, ChannelType, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const fetch = require('node-fetch');

// Constantes
const VIDEO_CHANNEL_ID = '1354734580589924416';

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

    // Verificar que el nombre del canal siga el formato esperado (username-userid)
    const channelNameParts = message.channel.name.split('-');
    if (channelNameParts.length < 2) return;

    const userId = channelNameParts[channelNameParts.length - 1];
    // Verificar que el ID sea numérico
    if (!/^\d+$/.test(userId)) return;

    try {
        const user = await client.users.fetch(userId);
        if (!user) return;

        const tasks = [message.content.trim()].filter(task => task);
        if (tasks.length > 0) {
            await sendTaskMessages(user, tasks, message.channel);
        }
    } catch (error) {
        console.error(`Error al procesar mensaje en canal ${message.channel.name}:`, error);
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
                        .setCustomId(`upload_video_${task}_${channel.id}`) // Añadimos el ID del canal para referencia
                        .setLabel('📤 Subir video')
                        .setStyle(ButtonStyle.Primary)
                );

            const cleanTask = task.replace(/<[^>]+>/g, '').trim();

            const taskEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Tarea asignada')
                .setDescription(`**Tarea:**\n\`\`\`${cleanTask}\`\`\``)
                .setFooter({ text: 'Sube tu video para completar la tarea.' });

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

    // Manejar botón de subir video
    if (interaction.customId.startsWith('upload_video_')) {
        const [, , task, originalChannelId] = interaction.customId.split('_');
        await interaction.reply({
            content: 'Por favor, sube tu video. Solo se aceptan archivos de video.',
            ephemeral: true
        });

        try {
            const filter = m => m.author.id === interaction.user.id && m.attachments.size > 0;
            const collected = await interaction.channel.awaitMessages({
                filter,
                max: 1,
                time: 300000, // 5 minutos para subir el video
                errors: ['time']
            });

            const message = collected.first();
            const attachment = message.attachments.first();

            if (!attachment.contentType?.startsWith('video/')) {
                await interaction.followUp({
                    content: 'Por favor, sube un archivo de video válido.',
                    ephemeral: true
                });
                return;
            }

            // Actualizar el mensaje original con el botón de completar
            const originalMessage = await interaction.message;
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`task_complete_${task}_${originalChannelId}`)
                        .setLabel('✔ Completado')
                        .setStyle(ButtonStyle.Success)
                );

            await originalMessage.edit({
                embeds: [originalMessage.embeds[0]],
                components: [row]
            });

            // Guardar el video y su información para cuando se complete la tarea
            const videoInfo = {
                attachment: {
                    name: attachment.name,
                    url: attachment.url,
                    contentType: attachment.contentType
                },
                task: task,
                userId: interaction.user.id,
                messageLink: `https://discord.com/channels/${interaction.guild?.id || '@me'}/${originalChannelId}/${interaction.message.id}`,
                timestamp: new Date().toISOString()
            };

            // Almacenar temporalmente la información del video
            if (!client.videoQueue) client.videoQueue = new Map();
            client.videoQueue.set(`${interaction.user.id}_${task}`, videoInfo);

            await interaction.followUp({
                content: 'Video recibido. Ahora puedes marcar la tarea como completada.',
                ephemeral: true
            });

        } catch (error) {
            if (error.message === 'time') {
                await interaction.followUp({
                    content: 'Se agotó el tiempo para subir el video. Inténtalo de nuevo.',
                    ephemeral: true
                });
            } else {
                console.error('Error al procesar el video:', error);
                await interaction.followUp({
                    content: 'Hubo un error al procesar el video. Por favor, inténtalo de nuevo.',
                    ephemeral: true
                });
            }
        }
        return;
    }

    // Si es un botón de confirmación
    if (interaction.customId.startsWith('confirm_') || interaction.customId.startsWith('cancel_')) {
        const originalCustomId = interaction.customId.replace('confirm_', '').replace('cancel_', '');
        const user = interaction.user;
        const [action, status, task, channelId] = originalCustomId.split('_');

        // Si se canceló
        if (interaction.customId.startsWith('cancel_')) {
            await interaction.update({ content: 'Operación cancelada', components: [], ephemeral: true });
            return;
        }

        const cleanTask = task.replace(/<[^>]+>/g, '').trim();
        const color = status === 'complete' ? 0x28A745 : 0xFF0000;
        const statusText = status === 'complete' ? 'Completada' : 'Pendiente';

        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: 'numeric', second: 'numeric'
        });

        // Si hay un video pendiente y la tarea se marca como completada
        if (status === 'complete' && client.videoQueue?.has(`${user.id}_${task}`)) {
            // Primero actualizamos la interacción para que el usuario sepa que estamos procesando
            await interaction.update({ 
                content: 'Enviando video al canal de confirmación...', 
                components: [],
                ephemeral: true 
            });

            const videoInfo = client.videoQueue.get(`${user.id}_${task}`);
            const videoChannel = await client.channels.fetch(VIDEO_CHANNEL_ID);
            
            if (videoChannel) {
                const videoEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle('Video de tarea completada')
                    .setDescription(`**Usuario:** ${user}\n**Tarea:** ${cleanTask}\n**Fecha:** ${formattedDate}\n**Link a la tarea:** ${videoInfo.messageLink}`)
                    .setFooter({ text: 'Video subido y tarea completada' });

                try {
                    // Crear un nuevo AttachmentBuilder directamente desde la URL
                    const attachment = new AttachmentBuilder(videoInfo.attachment.url, {
                        name: videoInfo.attachment.name,
                        description: `Video de tarea de ${user.username}`,
                        contentType: videoInfo.attachment.contentType
                    });

                    await videoChannel.send({
                        files: [attachment],
                        embeds: [videoEmbed]
                    });

                    // Enviar un nuevo mensaje ephemeral para confirmar
                    await interaction.followUp({
                        content: `Tarea ${statusText.toLowerCase()}: ${cleanTask}\nVideo enviado correctamente al canal de confirmación.`,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Error al enviar el video:', error);
                    await interaction.followUp({
                        content: 'Hubo un error al enviar el video al canal de confirmación.',
                        ephemeral: true
                    });
                }
            }

            // Eliminar el video de la cola
            client.videoQueue.delete(`${user.id}_${task}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle('Actualización de tarea')
            .setDescription(`**${user.username}** ha actualizado el estado de la tarea: "${cleanTask}"`)
            .addFields(
                { name: 'Estado', value: `${statusText === 'Completada' ? '✅' : '❌'} ${statusText}` },
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

        // Actualizar el mensaje de confirmación
        await interaction.update({ 
            content: `Tarea ${statusText.toLowerCase()}: ${cleanTask}`, 
            components: [],
            ephemeral: true 
        });
    }

    // Si es un botón original de tarea
    const customId = interaction.customId;
    const isComplete = customId.startsWith('task_complete');
    const [action, status, task, channelId] = customId.split('_');

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
