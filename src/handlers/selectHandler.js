const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { CATEGORY_ROLES } = require("../config/constants");

async function handleUserSelect(interaction) {
  const selectedUserId = interaction.values[0];

  // Obtener miembros con el rol de la categoría
  const categoryId = interaction.channel.parent.id;
  const categoryRole = Object.entries(CATEGORY_ROLES).find(
    ([location, data]) => data.categoryId === categoryId
  );
  const roleId = categoryRole?.[1]?.roleId;

  const members = await interaction.guild.members.fetch();
  const filteredMembers = members.filter(
    (member) => !member.user.bot && member.roles.cache.has(roleId)
  );

  // Crear el select menu con el usuario seleccionado
  const userSelect = new StringSelectMenuBuilder()
    .setCustomId("select_user_task")
    .setPlaceholder("Selecciona un usuario")
    .setMaxValues(1)
    .addOptions(
      filteredMembers.map((member) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(member.user.username)
          .setDescription(`ID: ${member.user.id}`)
          .setValue(member.user.id)
          .setDefault(member.user.id === selectedUserId)
      )
    );

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

  // Actualizar el mensaje directamente
  await interaction.update({
    content: "Selecciona un usuario para asignarle tareas:",
    components: [row1, row2],
  });
}

module.exports = {
  handleUserSelect,
};
