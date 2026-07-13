export const TYPE_COLORS: Record<string, string> = {
  float: '#a0a0a0', // Szary (Liczba)
  impulse: '#29b6f6', // Błękitny (Zdarzenie / impuls)
  vec2: '#81c784',  // Jasny Zielony (UV / 2D)
  vec3: '#fff176',  // Żółty (Kolor / Pozycja 3D)
  vec4: '#f48fb1',  // Różowy (Kolor z Alfą)
  buffer2d: '#26a69a', // Turkusowy (zasób tekstury / bufora)
  auto: '#9c27b0',  // Fioletowy (Auto-adapting)
  default: '#ffffff'
};

export const TYPE_NAMES: Record<string, string> = {
  float: 'Float (1.0)',
  impulse: 'Impulse (Event)',
  vec2: 'Vector 2 (UV)',
  vec3: 'Vector 3 (RGB)',
  vec4: 'Vector 4 (RGBA)',
  buffer2d: 'Buffer 2D (Resource)',
  auto: 'Auto (Dynamic)',
};
