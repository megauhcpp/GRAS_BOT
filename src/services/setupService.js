const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");
const { CATEGORY_ROLES } = require("../config/constants");

// Función para configurar un canal inicial
async function setupStarterChannel(channel) {
  try {
    // Obtener los últimos 100 mensajes del canal
    const messages = await channel.messages.fetch({ limit: 100 });

    // Buscar si ya existe un mensaje con el botón
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "create_channel"
    );

    if (existingMessage) {
      // Si ya existe el mensaje, no hacer nada
      // Eliminar otros mensajes del bot si existen
      const otherBotMessages = messages.filter(
        (msg) =>
          msg.author.id === channel.client.user.id &&
          msg.id !== existingMessage.id
      );
      if (otherBotMessages.size > 0) {
        await channel.bulkDelete(otherBotMessages);
      }
      return;
    }

    // Si no existe el mensaje, eliminar todos los mensajes antiguos y crear uno nuevo
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_channel")
        .setLabel("Crear Canal")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: "Haz clic para crear un canal de asignación de tareas",
      components: [row],
    });
  } catch (error) {
    console.error(`Error al configurar el canal ${channel.name}:`, error);
  }
}

// Función para configurar el canal de asignación de tareas
async function setupAssignmentChannel(channel) {
  try {
    console.log("Iniciando configuración del canal de asignación...");
    const messages = await channel.messages.fetch();
    console.log(`Encontrados ${messages.size} mensajes en el canal`);

    // Buscar si ya existe un mensaje con el menú
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
    );

    console.log("¿Existe mensaje con menú?", existingMessage ? "Sí" : "No");

    // Usar updateAssignmentMessage para manejar la actualización o creación del mensaje
    await updateAssignmentMessage(channel);
  } catch (error) {
    console.error(
      `Error al configurar el canal de asignación ${channel.name}:`,
      error
    );
  }
}

// Función para actualizar el mensaje de asignación existente
async function updateAssignmentMessage(channel, selectedUserId = null) {
  try {
    // Buscar el mensaje existente
    const messages = await channel.messages.fetch();
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
    );

    if (!selectedUserId && existingMessage) {
      const currentSelect = existingMessage.components[0].components[0];
      selectedUserId = currentSelect.options.find((opt) => opt.default)?.value;
    }

    // Obtener el rol correspondiente a esta categoría
    const categoryId = channel.parent.id;
    const categoryRole = Object.entries(CATEGORY_ROLES).find(
      ([location, data]) => data.categoryId === categoryId
    );
    const roleId = categoryRole?.[1]?.roleId;

    // Obtener miembros con el rol de la categoría
    const members = await channel.guild.members.fetch();
    const filteredMembers = members.filter(
      (member) => !member.user.bot && member.roles.cache.has(roleId)
    );
    console.log(
      `Obtenidos ${filteredMembers.size} miembros con el rol ${roleId}`
    );

    // Crear el select menu
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("select_user_task")
      .setPlaceholder("Selecciona un usuario")
      .setMaxValues(1);

    // Si hay usuarios, añadirlos como opciones
    if (filteredMembers.size > 0) {
      userSelect.addOptions(
        filteredMembers.map((member) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(member.user.username)
            .setDescription(`ID: ${member.user.id}`)
            .setValue(member.user.id)
            .setDefault(member.user.id === selectedUserId)
        )
      );
    } else {
      // Si no hay usuarios, añadir una opción deshabilitada
      userSelect.addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel("No hay usuarios disponibles")
          .setDescription(
            "No hay usuarios con el rol necesario en esta categoría"
          )
          .setValue("no_users")
          .setDefault(true),
      ]);
    }

    const row1 = new ActionRowBuilder().addComponents(userSelect);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`assign_task_${selectedUserId}`)
        .setLabel("Asignar Tareas")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(
          filteredMembers.size === 0 ||
            !selectedUserId ||
            selectedUserId === "no_users"
        )
    );

    const messageContent = {
      content: "Selecciona un usuario para asignarle tareas:",
      components: [row1, row2],
    };

    // Si existe un mensaje, actualizarlo
    if (existingMessage) {
      console.log("Actualizando mensaje existente");
      await existingMessage.edit(messageContent);
    } else {
      console.log("Creando nuevo mensaje");
      await channel.send(messageContent);
    }
  } catch (error) {
    console.error(`Error al actualizar mensaje de asignación:`, error);
  }
}

module.exports = {
  setupStarterChannel,
  setupAssignmentChannel,
  updateAssignmentMessage,
};
