import 'dart:typed_data';

import 'package:leerie_sensor/detect/luminance.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final grey = Uint8List(10000)..fillRange(0, 10000, 128);

  test('linearises before averaging', () {
    expect(meanLinearLuma(Uint8List.fromList([0, 255]), step: 1), closeTo(0.5, 1e-9));
    expect(meanLinearLuma(grey), closeTo(0.2158, 1e-3)); // sRGB 128 ≈ 21.6% linear
  });

  test('undoes exposure: same scene at half the ISO gives half the linear pixels, same luminance', () {
    final half = Uint8List(10000)..fillRange(0, 10000, 92); // linear ≈ half of sRGB 128
    final a = relativeLuminance(grey, exposureNs: 33333333, iso: 800, aperture: 1.8)!;
    final b = relativeLuminance(half, exposureNs: 33333333, iso: 400, aperture: 1.8)!;
    expect(b / a, closeTo(1, 0.02));
  });

  test('iOS video range maps 16 to black and 235 to white', () {
    expect(meanLinearLuma(Uint8List.fromList([16, 235]), step: 1, videoRange: true), closeTo(0.5, 1e-9));
    expect(meanLinearLuma(Uint8List.fromList([10]), step: 1, videoRange: true), 0); // below 16 clamps
    // A dark street at Y=20 reads brighter if video range is mistaken for full range.
    final dark = Uint8List.fromList([20]);
    expect(meanLinearLuma(dark, step: 1), greaterThan(meanLinearLuma(dark, step: 1, videoRange: true)));
  });

  test('missing exposure gives null, never 0', () {
    expect(relativeLuminance(grey, exposureNs: null, iso: 400, aperture: 1.8), isNull);
  });
}
