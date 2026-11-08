// Exposure-corrected scene luminance from one camera frame, after phyphox's
// LuminanceAnalyzer: linearise the pixels, average them, then undo auto-exposure
// with N² / (t · ISO). Relative units, not lux.

import 'dart:math' as math;
import 'dart:typed_data';

double _toLinear(double c) =>
    c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();

/// sRGB-encoded 8-bit luma to linear light. Android's YUV_420_888 is full range (0–255).
final Float64List _linearFull =
    Float64List.fromList(List<double>.generate(256, (v) => _toLinear(v / 255)));

/// iOS streams video range (16–235); without this the darkest streets read too bright.
final Float64List _linearVideo = Float64List.fromList(
    List<double>.generate(256, (v) => _toLinear(((v - 16) / 219).clamp(0.0, 1.0))));

/// Mean linear luma of a Y plane, sampling every [step]th byte.
// shortcut: samples row padding too, harmless while bytesPerRow == width; the first frame logs both.
double meanLinearLuma(Uint8List y, {int step = 97, bool videoRange = false}) {
  final linear = videoRange ? _linearVideo : _linearFull;
  var sum = 0.0;
  var count = 0;
  for (var i = 0; i < y.length; i += step) {
    sum += linear[y[i]];
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
  bool videoRange = false,
}) {
  if (exposureNs == null || exposureNs <= 0 || iso == null || iso <= 0 || aperture == null) {
    return null;
  }
  return meanLinearLuma(y, videoRange: videoRange) * aperture * aperture / ((exposureNs / 1e9) * iso);
}
