// Bloom needs renderable half-float buffers. The low profile avoids that GPU path.
export function canUsePostProcessing({ quality, requested, webgl2, hasExtension }) {
  if (quality === 'low' || !requested) return false;
  if (webgl2) return hasExtension('EXT_color_buffer_float');
  return hasExtension('OES_texture_half_float') &&
    hasExtension('OES_texture_half_float_linear') &&
    hasExtension('EXT_color_buffer_half_float');
}
