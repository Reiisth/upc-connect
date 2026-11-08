// Curated fictional combinations; no external API or dependency. Order is fixture data.
export const MALE_FIRST_NAMES = Object.freeze([
  'Jose Miguel', 'John Paul', 'Mark Anthony', 'Carlo', 'Joshua Daniel', 'Christian',
  'Francis Xavier', 'Angelo Luis', 'Paolo', 'Rafael Antonio', 'Gabriel', 'Luis Gabriel',
  'Juan Carlos', 'Adrian', 'Emmanuel', 'Vincent Paul', 'Dominic', 'Nicolas',
  'Marco Antonio', 'Nathaniel', 'Jerome', 'Patrick James', 'Roberto', 'Antonio',
  'Enrique', 'Daniel', 'Michael Angelo', 'Lorenzo', 'Ramon', 'Albert Joseph',
  'Benedict', 'Eduardo', 'Felix', 'Leonardo', 'Manuel', 'Ricardo',
  'Samuel', 'Victor', 'Noel', 'Ruel', 'Allan', 'Ernesto', 'Dennis', 'Ryan',
  'Kenneth', 'Julius', 'Oscar', 'Renato',
]);
export const FEMALE_FIRST_NAMES = Object.freeze([
  'Maria Angela', 'Anne Marie', 'Kristine Joy', 'Angelica', 'Hannah Nicole', 'Patricia',
  'Camille Rose', 'Mary Grace', 'Joanna', 'Alyssa Mae', 'Andrea', 'Bianca',
  'Carla', 'Diana', 'Elaine', 'Frances', 'Gabriela', 'Isabel',
  'Jasmine', 'Katrina', 'Lourdes', 'Mariel', 'Natalie', 'Olivia',
  'Pauline', 'Rachelle', 'Sofia', 'Teresa', 'Veronica', 'Ysabel',
  'Angela Marie', 'Catherine', 'Clarissa', 'Denise', 'Erika', 'Florence',
  'Hazel', 'Irene', 'Jessa', 'Lea', 'Maria Luisa', 'Michelle',
  'Nerissa', 'Regina', 'Rosemarie', 'Sheryl', 'Vanessa', 'Yvonne',
]);
export const FILIPINO_SURNAMES = Object.freeze([
  'Reyes', 'Santos', 'Garcia', 'Mendoza', 'Bautista', 'Ramos', 'Castillo', 'Navarro',
  'Aquino', 'Mercado', 'Villanueva', 'Flores', 'Cruz', 'Dela Cruz', 'Del Rosario', 'Evangelista',
  'Santiago', 'Torres', 'Manalo', 'Dimaculangan', 'Marasigan', 'Hernandez', 'Perez', 'Rivera',
  'Lopez', 'Gonzales', 'Soriano', 'De Leon', 'Austria', 'Atienza', 'Macalintal', 'De Castro',
  'Aguila', 'Vergara', 'Ona', 'Ilagan', 'Andal', 'Caringal', 'Balmes', 'Dizon',
  'Lacson', 'Tolentino', 'Panganiban', 'Malabanan', 'Magtibay', 'Alcantara', 'Carandang', 'Lajara',
  'Magsino', 'Cuenca', 'Rosales', 'Salazar', 'Valencia', 'Sarmiento', 'Morales', 'Roxas',
  'Abad', 'Pascual', 'Luna', 'Buenaventura', 'De Jesus', 'Enriquez', 'Castro', 'Solis',
]);
export function demoMemberName(index, gender) {
  if (!Number.isInteger(index) || index < 0 || index >= 180) throw new Error('Expected a deterministic hosted member index (0–179).');
  if (!['male', 'female'].includes(gender)) throw new Error('Unexpected demo gender; refusing to guess or modify demographics.');
  const pool = gender === 'male' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;
  const ordinal = Math.floor(index / 2);
  const middle = (index * 7 + 11) % FILIPINO_SURNAMES.length;
  let last = (index * 13 + 3) % FILIPINO_SURNAMES.length;
  if (middle === last) last = (last + 1) % FILIPINO_SURNAMES.length;
  return { first_name: pool[ordinal % pool.length], middle_name: FILIPINO_SURNAMES[middle], last_name: FILIPINO_SURNAMES[last] };
}
