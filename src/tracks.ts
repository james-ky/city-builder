/** Background music. All tracks verified on their OpenGameArt pages (Oct 28, 2026); see CREDITS.md. */
export type Track = { file: string; title: string; artist: string; license: string; url: string; attribution: boolean };
export const TRACKS: Track[] = [
  { file: 'taken-lightly.mp3', title: 'Taken Lightly', artist: 'Pro Sensory (Alex McCulloch)', license: 'CC0', url: 'https://opengameart.org/content/taken-lightly', attribution: false },
  { file: 'mocha-frapp.mp3', title: 'Mocha Frapp', artist: 'Pro Sensory (Alex McCulloch)', license: 'CC0', url: 'https://opengameart.org/content/mocha-frapp', attribution: false },
  { file: 'chill-jazz.mp3', title: 'Chill Jazz', artist: 'Pro Sensory (Alex McCulloch)', license: 'CC0', url: 'https://opengameart.org/content/chill-jazz', attribution: false },
  { file: 'coffee-house-bump.mp3', title: 'Coffee House Bump', artist: 'OatCog', license: 'CC0', url: 'https://opengameart.org/content/coffee-house-bump', attribution: false },
  { file: 'midnight-cruiser.mp3', title: 'Midnight Cruiser', artist: 'Zane Little Music', license: 'CC0', url: 'https://opengameart.org/content/midnight-cruiser', attribution: false },
  { file: 'jazzy-vibes-36.mp3', title: 'Jazzy Vibes #36 - Loop - Smooth Jazz', artist: 'Tri-Tachyon', license: 'CC BY 4.0', url: 'https://opengameart.org/content/jazzy-vibes-36-loop-smooth-jazz', attribution: true },
];
