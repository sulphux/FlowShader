// Singleton kontekstu WebGL (żeby nie tworzyć tysięcy canvasów)
let glContext: WebGLRenderingContext | null = null;

function getTestContext() {
  if (!glContext) {
    const canvas = document.createElement('canvas');
    glContext = canvas.getContext('webgl');
  }
  return glContext;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const validateGLSL = (fragmentShaderBody: string): ValidationResult => {
  const gl = getTestContext();
  if (!gl) return { valid: true }; // Brak WebGL? Puszczamy na wiarę.

  // Sprawdzamy CZYSTY kod od kompilatora. Nic nie doklejamy.
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!shader) return { valid: false, error: "Cannot create shader" };

  gl.shaderSource(shader, fragmentShaderBody);
  gl.compileShader(shader);

  const status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (!status) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return { 
        valid: false, 
        error: log || "Unknown Error" 
    };
  }

  gl.deleteShader(shader);
  return { valid: true };
};