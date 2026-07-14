export interface BuiltinExample {
  id: string;
  title: string;
  titlePl: string;
  description: string;
  descriptionPl: string;
  category: string;
  categoryPl: string;
  icon: string;
  accent: string;
  stats: string;
  load: () => Promise<string>;
}

const raw = (module: Promise<{ default: string }>): Promise<string> =>
  module.then(result => result.default);

/** Curated, user-facing examples. Regression-only graphs stay out of the gallery. */
export const BUILTIN_EXAMPLES: BuiltinExample[] = [
  {
    id: 'game-of-life',
    title: 'Game of Life',
    titlePl: 'Gra w życie',
    description: 'Conway simulation built from Frame Buffer, Sample Buffer and an impulse clock.',
    descriptionPl: 'Symulacja Conwaya zbudowana z Frame Buffer, Sample Buffer i zegara impulsowego.',
    category: 'Simulation',
    categoryPl: 'Symulacja',
    icon: '▦',
    accent: '#65d46e',
    stats: '7 nodes · feedback',
    load: () => raw(import('../../Examples/game-of-life.json?raw')),
  },
  {
    id: 'loop-basic',
    title: 'Loop / Iterate Basics',
    titlePl: 'Podstawy Loop / Iterate',
    description: 'A small visual Step custom node folded repeatedly over a scalar state.',
    descriptionPl: 'Mały wizualny custom node Step wielokrotnie przetwarzający stan skalarny.',
    category: 'Learning',
    categoryPl: 'Nauka',
    icon: '↻',
    accent: '#64b5f6',
    stats: '6 nodes · beginner',
    load: () => raw(import('../../Examples/loop-iterate-basic.json?raw')),
  },
  {
    id: 'kula-raymarch',
    title: 'Raymarch Sphere',
    titlePl: 'Kula raymarchingowa',
    description: 'GLKITTY-inspired SDF raymarching with Code Blocks, textures and a 192-step loop.',
    descriptionPl: 'Raymarching SDF inspirowany GLKITTY, z Code Blockami, teksturami i pętlą 192 kroków.',
    category: 'Raymarching',
    categoryPl: 'Raymarching',
    icon: '◉',
    accent: '#20e0c0',
    stats: '5 nodes · advanced',
    load: () => raw(import('../../Examples/kula-loop.json?raw')),
  },
  {
    id: 'beautiful',
    title: 'Beautiful',
    titlePl: 'Beautiful',
    description: 'A larger generative shader demonstrating parameters and reusable custom nodes.',
    descriptionPl: 'Większy shader generatywny pokazujący parametry i wielokrotnego użytku custom nody.',
    category: 'Generative',
    categoryPl: 'Generatywne',
    icon: '✦',
    accent: '#ff4fa3',
    stats: '25 nodes · advanced',
    load: () => raw(import('../../Examples/beautiful.json?raw')),
  },
];

export async function loadBuiltinExample(id: string): Promise<string> {
  const example = BUILTIN_EXAMPLES.find(candidate => candidate.id === id);
  if (!example) throw new Error(`Unknown built-in example: ${id}`);
  return example.load();
}
