const FIRST = [
  "Alex",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Morgan",
  "Quinn",
  "Avery",
  "Skyler",
  "Reese",
  "Parker",
  "Drew",
  "Cameron",
  "Jamie",
  "Blake",
  "Rowan",
  "Sage",
  "River",
  "Phoenix",
  "Eden",
] as const;

const LAST = [
  "Ashford",
  "Bennett",
  "Caldwell",
  "Donovan",
  "Ellsworth",
  "Fairchild",
  "Grayson",
  "Hollis",
  "Iverson",
  "Kensington",
  "Langley",
  "Mercer",
  "Northcott",
  "Prescott",
  "Redmond",
  "Stratford",
  "Thorne",
  "Underwood",
  "Vance",
  "Whitmore",
] as const;

function pick<T extends readonly string[]>(arr: T): T[number] {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateRandomPersonName(): string {
  return `${pick(FIRST)} ${pick(LAST)}`;
}
