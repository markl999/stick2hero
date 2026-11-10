import { Filter, GlProgram, UniformGroup } from 'pixi.js';

/**
 * BLOOM / POST-FX (Era 5): one GPU pass over the final picture. Bright parts glow,
 * colours split towards the edges (chromatic aberration), the corners darken and there's
 * film grain. All of it deliberately overdone.
 */
export interface PostFx {
  /** Glow strength (0 = none). */
  bloom: number;
  /** Colour split at the edges, in screen pixels. */
  aberration: number;
  /** 0..1 corner darkening. */
  vignette: number;
  /** 0..1 film grain. */
  grain: number;
  /** Seconds, for the grain. */
  time: number;
  /** CRT SCANLINES (a secret): 0..1, a curved old telly with scanlines. */
  crt?: number;
  /** The picture's rows (its internal resolution), so the scanlines sit on its pixels. */
  rows?: number;
}

const VERTEX = `
in vec2 aPosition;
out vec2 vTextureCoord;
// Where we are across the picture (0..1), one input pixel in texture units, and the
// picture's width in pixels. (Passed down so the fragment shader needn't redeclare the
// filter's own uniforms, which can fail to link at a different precision.)
out vec2 vFrame;
out vec2 vPixel;
out float vWidth;
out vec2 vScale;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

void main(void)
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    gl_Position = vec4(position, 0.0, 1.0);
    vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
    vFrame = aPosition;
    vPixel = uInputSize.zw;
    vWidth = uOutputFrame.z;
    vScale = uOutputFrame.zw * uInputSize.zw;
}
`;

const FRAGMENT = `
in vec2 vTextureCoord;
in vec2 vFrame;
in vec2 vPixel;
in float vWidth;
in vec2 vScale;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;

uniform float uBloom;
uniform float uAberration;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
uniform float uCrt;
uniform float uRows;

vec3 sampleAt(vec2 uv) {
    return texture(uTexture, clamp(uv, uInputClamp.xy, uInputClamp.zw)).rgb;
}

vec3 bright(vec2 uv) {
    vec3 c = sampleAt(uv);
    float l = max(c.r, max(c.g, c.b));
    return c * smoothstep(0.45, 0.95, l);
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main(void)
{
    vec2 frame = vFrame;
    // CRT: the picture bulges like the glass of an old telly; outside it is black.
    if (uCrt > 0.0) {
        vec2 c = frame - 0.5;
        c *= 1.0 + uCrt * 0.18 * dot(c, c);
        frame = c + 0.5;
        if (frame.x < 0.0 || frame.x > 1.0 || frame.y < 0.0 || frame.y > 1.0) {
            finalColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }
    }
    vec2 uv = frame * vScale;
    vec2 centered = frame - 0.5;
    float dist = length(centered);
    vec2 px = vPixel;

    // Chromatic aberration: red and blue slide apart, more towards the edges.
    vec2 split = normalize(centered + 1e-5) * uAberration * dist * 2.0 * px;
    vec3 color = vec3(sampleAt(uv + split).r, sampleAt(uv).g, sampleAt(uv - split).b);

    // Bloom: a wide, soft gather of everything bright. Each pixel turns its sample ring by
    // a random angle, so the taps blur into a haze instead of ghosting.
    if (uBloom > 0.0) {
        vec3 glow = vec3(0.0);
        float radius = vWidth * 0.0045;
        float spin = hash(frame * 731.0) * 6.2832;
        float total = 0.0;
        for (int ring = 1; ring <= 4; ring++) {
            float r = radius * (float(ring) * 1.35 + hash(frame * 97.0 + float(ring)));
            float weight = 1.0 / float(ring);
            for (int i = 0; i < 9; i++) {
                float a = float(i) * 0.6981 + spin + float(ring) * 0.35;
                glow += bright(uv + vec2(cos(a), sin(a)) * r * px) * weight;
                total += weight;
            }
        }
        color += glow / total * uBloom * 1.6;
    }

    // CRT: a dark line between the picture's rows, an RGB shadow mask, darker corners.
    if (uCrt > 0.0) {
        float line = 0.5 - 0.5 * cos(frame.y * uRows * 6.2832);
        color *= mix(1.0, 0.62 + 0.5 * line, uCrt);
        float column = mod(floor(frame.x * vWidth), 3.0);
        vec3 mask = column < 1.0 ? vec3(1.0, 0.8, 0.8) : column < 2.0 ? vec3(0.8, 1.0, 0.8) : vec3(0.8, 0.8, 1.0);
        color *= mix(vec3(1.0), mask * 1.12, uCrt * 0.7);
        color *= 1.0 - uCrt * 0.45 * smoothstep(0.32, 0.72, length(frame - 0.5));
    }

    // Vignette and grain.
    color *= 1.0 - uVignette * smoothstep(0.3, 0.85, dist);
    color += (hash(frame * 917.0 + uTime) - 0.5) * uGrain;

    finalColor = vec4(color, 1.0);
}
`;

export class PostFxFilter extends Filter {
  private readonly params: UniformGroup<{
    uBloom: { value: number; type: 'f32' };
    uAberration: { value: number; type: 'f32' };
    uVignette: { value: number; type: 'f32' };
    uGrain: { value: number; type: 'f32' };
    uTime: { value: number; type: 'f32' };
    uCrt: { value: number; type: 'f32' };
    uRows: { value: number; type: 'f32' };
  }>;

  constructor() {
    const params = new UniformGroup({
      uBloom: { value: 0, type: 'f32' },
      uAberration: { value: 0, type: 'f32' },
      uVignette: { value: 0, type: 'f32' },
      uGrain: { value: 0, type: 'f32' },
      uTime: { value: 0, type: 'f32' },
      uCrt: { value: 0, type: 'f32' },
      uRows: { value: 180, type: 'f32' },
    });
    super({
      glProgram: GlProgram.from({ vertex: VERTEX, fragment: FRAGMENT, name: 'post-fx' }),
      resources: { postFx: params },
      resolution: 'inherit',
    });
    this.params = params;
  }

  set(fx: PostFx): void {
    const u = this.params.uniforms;
    u.uBloom = fx.bloom;
    u.uAberration = fx.aberration;
    u.uVignette = fx.vignette;
    u.uGrain = fx.grain;
    u.uTime = fx.time % 100;
    u.uCrt = fx.crt ?? 0;
    u.uRows = fx.rows ?? 180;
  }
}
