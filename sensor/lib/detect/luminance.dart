// Exposure-corrected scene luminance from one camera frame, after phyphox's
// LuminanceAnalyzer: linearise the pixels, average them, then undo auto-exposure
// with N² / (t · ISO). Relative units, not lux.

import 'dart:math' as math;
import 'dart:typed_data';

/// sRGB-encoded 8-bit luma to linear light.
// shortcut: assumes full-range Y (Android YUV_420_888); iOS streams video range 16–235, map (v-16)/219 there.
final Float64List _linear = Float64List.fromList(List<double>.generate(256, (v) {
  final c = v / 255;
  return c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
}));

/// Mean linear luma of a Y plane, sampling every [step]th byte.
double meanLinearLuma(Uint8List y, {int step = 97}) {
  var sum = 0.0;
  var count = 0;
  for (var i = 0; i < y.length; i += step) {
    sum += _linear[y[i]];
    count++;
  }
  return count == 0 ? 0 : sum / count;
}

/// Null when the camera did not report its exposure; an uncorrected mean is meaningless under auto-exposure.
double? relativeLuminance(
  Uint8List y, {
  required int? exposureNs,
  required double? iso,
  required double? aperture,
}) {
  if (exposureNs == null || exposureNs <= 0 || iso == null || iso <= 0 || aperture == null) {
    return null;
  }
  return meanLinearLuma(y) * aperture * aperture / ((exposureNs / 1e9) * iso);
}
