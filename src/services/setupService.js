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
    const messages = await channel.messages.fetch({ limit: 10 });
    
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
        .setLabel("Crear Canal Personal")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: "¡Bienvenido al canal de inicio! Para comenzar, crea tu canal personal haciendo clic en el botón de abajo. Una vez creado, podrás recibir y gestionar tus tareas.",
      components: [row],
    });
  } catch (error) {
    console.error(`Error al configurar el canal ${channel.name}:`, error);
  }
}

// Función para configurar el canal de asignación de tareas
async function setupAssignmentChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    
    // Buscar si ya existe un mensaje con el menú
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.components.length > 0 &&
        msg.components[0].components[0]?.data?.custom_id === "select_user_task"
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

    // Obtener el rol de la categoría
    const categoryId = channel.parent.id;
    const categoryRole = Object.entries(CATEGORY_ROLES).find(
      ([_, data]) => data.categoryId === categoryId
    );
    
    if (!categoryRole) {
      console.error("No se encontró el rol para la categoría", categoryId);
      return;
    }

    const roleId = categoryRole[1].roleId;

    // Obtener miembros con el rol de la categoría
    const members = await channel.guild.members.fetch();
    const filteredMembers = members.filter(
      (member) => !member.user.bot && member.roles.cache.has(roleId)
    );

    // Crear el select menu
    const userSelect = new StringSelectMenuBuilder()
      .setCustomId("select_user_task")
      .setPlaceholder("Selecciona un usuario")
      .setMaxValues(1);

    // Si hay usuarios, añadirlos como opciones
    if (filteredMembers.size > 0) {
      userSelect.addOptions(
        Array.from(filteredMembers.values()).map((member) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(member.user.username)
            .setDescription(`ID: ${member.user.id}`)
            .setValue(member.user.id)
        )
      );
    } else {
      // Si no hay usuarios, añadir una opción deshabilitada
      userSelect.addOptions([
        new StringSelectMenuOptionBuilder()
          .setLabel("No hay usuarios disponibles")
          .setDescription("No hay usuarios con el rol necesario en esta categoría")
          .setValue("no_users")
          .setDefault(true),
      ]);
    }

    const row1 = new ActionRowBuilder().addComponents(userSelect);

    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("assign_task")
        .setLabel("Asignar Nueva Tarea")
        .setStyle(ButtonStyle.Success)
        .setDisabled(filteredMembers.size === 0)
    );

    await channel.send({
      content: "Este es el canal de asignación de tareas. Aquí podrás:\n\n" +
               "• Seleccionar un usuario de la lista\n" +
               "• Asignar nuevas tareas al usuario seleccionado\n" +
               "• Hacer seguimiento del progreso\n\n" +
               "Para asignar una tarea:\n" +
               "1. Selecciona un usuario de la lista\n" +
               "2. Haz clic en 'Asignar Nueva Tarea'",
      components: [row1, row2],
    });
  } catch (error) {
    console.error(`Error al configurar el canal de asignación ${channel.name}:`, error);
  }
}

// Función para actualizar el mensaje de asignación existente
async function updateAssignmentMessage(message) {
  if (!message) {
    console.log("No hay mensaje para actualizar");
    return;
  }

  try {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("create_channel")
        .setLabel("Crear Canal")
        .setStyle(ButtonStyle.Primary)
    );

    await message.edit({
      content: "¡Bienvenido! Haz clic en el botón para crear tu canal de tareas.",
      components: [row],
    });
  } catch (error) {
    console.error("Error al actualizar mensaje de asignación:", error);
    throw error;
  }
}

// Función para configurar el canal de registro de tareas
async function setupRegistryChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    
    // Buscar si ya existe un mensaje de bienvenida
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.content.includes("registro de tareas")
    );

    if (existingMessage) {
      return;
    }

    await channel.send({
      content: "Este es el canal de registro de tareas. Aquí encontrarás:\n\n" +
               "• Historial de tareas completadas\n" +
               "• Tiempo dedicado a cada tarea\n" +
               "• Registro de actividades\n\n" +
               "Los registros se actualizarán automáticamente cuando se completen las tareas.",
    });
  } catch (error) {
    console.error(`Error al configurar el canal de registro ${channel.name}:`, error);
  }
}

// Función para configurar el canal de videos de tareas
async function setupVideosChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    
    // Buscar si ya existe un mensaje de bienvenida
    const existingMessage = messages.find(
      (msg) =>
        msg.author.id === channel.client.user.id &&
        msg.content.includes("videos de tareas")
    );

    if (existingMessage) {
      return;
    }

    await channel.send({
      content: "Este es el canal de videos de tareas. Aquí podrás:\n\n" +
               "• Ver el historial de videos subidos\n" +
               "• Acceder a las grabaciones de las tareas\n\n" +
               "Los videos se organizarán automáticamente por fecha y tarea.",
    });
  } catch (error) {
    console.error(`Error al configurar el canal de videos ${channel.name}:`, error);
  }
}

module.exports = {
  setupStarterChannel,
  setupAssignmentChannel,
  setupRegistryChannel,
  setupVideosChannel,
  updateAssignmentMessage,
};
