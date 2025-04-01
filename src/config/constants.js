// Constantes de configuración
const LOCATIONS = ["calpe", "malaga"];
const STARTER_CHANNELS = [
  "1356544572611625101", // calpe
  "1356275684107878421", // malaga
];

const REQUIRED_CHANNELS = {
  STARTER: "tareas",
  TASK_ASSIGNMENT: "asignacion-tareas",
  TASK_REGISTRY: "registro-tareas",
  TASK_VIDEOS: "videos-tareas"
};

const CATEGORY_ROLES = {
  calpe: {
    categoryId: "1356275547084423416",
    roleId: "1356275337679470803",
    adminRoleId: "1356573707308634156", // Rol de administracion de calpe
  },
  malaga: {
    categoryId: "1356275584015143022",
    roleId: "1356275439378891035",
    adminRoleId: "1356573712778006721", // Rol de administracion de malaga
  }
};

module.exports = {
  LOCATIONS,
  STARTER_CHANNELS,
  REQUIRED_CHANNELS,
  CATEGORY_ROLES,
};
