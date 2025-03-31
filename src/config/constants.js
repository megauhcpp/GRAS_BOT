// Constantes de configuración
const LOCATIONS = ["Calpe", "Granada", "Malaga", "Sevilla", "Cambrils"];
const STARTER_CHANNELS = [
  "1354754019737862307", // Calpe
  "1354757348199239704", // Granada
  "1354757370676248596", // Malaga
  "1355112644952199229", // Sevilla
  "1355160490179035236", // Cambrils
];

const CATEGORY_ROLES = {
  calpe: {
    categoryId: "1354752551136006175",
    roleId: "1354813657544134839",
  },
  granada: {
    categoryId: "1354752582421057630",
    roleId: "1354813856861655230",
  },
  malaga: {
    categoryId: "1354752621088604292",
    roleId: "1354813912335388865",
  },
  sevilla: {
    categoryId: "1355112568850743427",
    roleId: "1355112904076300389",
  },
  cambrils: {
    categoryId: "1355160400856879104",
    roleId: "1355160575058907357",
  },
};

module.exports = {
  LOCATIONS,
  STARTER_CHANNELS,
  CATEGORY_ROLES,
};
