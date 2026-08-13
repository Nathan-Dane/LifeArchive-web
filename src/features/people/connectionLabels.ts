/** Canonical browser presentation labels; durable values remain open strings. */
export const STANDARD_CONNECTION_LABELS = [
  { value: 'Friend', message: 'people.connections.friend' },
  { value: 'Family', message: 'people.connections.family' },
  { value: 'Colleague', message: 'people.connections.colleague' },
  { value: 'Partner', message: 'people.connections.partner' },
  { value: 'Former classmate', message: 'people.connections.formerClassmate' },
  { value: 'Family friend', message: 'people.connections.familyFriend' },
  { value: 'Doctor', message: 'people.connections.doctor' },
  { value: 'Public figure', message: 'people.connections.publicFigure' },
  {
    value: 'Never met personally',
    message: 'people.connections.neverMetPersonally',
  },
] as const
