// Constantes de configuración
const LOCATIONS = ["Calpe", "Malaga"];
const STARTER_CHANNELS = [
  "1356544572611625101", // Calpe
  "1356275684107878421", // Malaga
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
  },
  malaga: {
    categoryId: "1356275584015143022",
    roleId: "1356275439378891035",
  }
};

module.exports = {
  LOCATIONS,
  STARTER_CHANNELS,
  REQUIRED_CHANNELS,
  CATEGORY_ROLES,
};
