import 'dart:io';
import 'dart:ui' as ui;

import 'package:leerie_sensor/session/session_controller.dart';
import 'package:leerie_sensor/session/settings.dart';
import 'package:leerie_sensor/theme/theme.dart';
import 'package:leerie_sensor/ui/console_screen.dart';
import 'package:leerie_sensor/ui/widgets/console_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pump(WidgetTester tester, SessionController controller) async {
  tester.view.physicalSize = const Size(1170, 2532); // iPhone 13/14, 390x844 pt
  tester.view.devicePixelRatio = 3;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(
    theme: buildLeerieTheme(),
    home: RepaintBoundary(child: ConsoleScreen(controller: controller)),
  ));
  await tester.pump(const Duration(seconds: 1));
}

Future<void> _loadFonts() async {
  for (final weight in <String>['Regular', 'Medium', 'SemiBold', 'Bold']) {
    final bytes = File('assets/fonts/Inter-$weight.ttf').readAsBytesSync();
    final loader = FontLoader('Inter')..addFont(Future.value(ByteData.sublistView(bytes)));
    await loader.load();
  }
  final icons = File('${Platform.environment['FLUTTER_ROOT']}'
      '/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf');
  if (icons.existsSync()) {
    final bytes = icons.readAsBytesSync();
    await (FontLoader('MaterialIcons')..addFont(Future.value(ByteData.sublistView(bytes)))).load();
  }
}

void main() {
  test('stops are log2 of luminance over the reference, and the bar clamps', () {
    expect(luminanceStops(kMeterReferenceLuminance), closeTo(0, 1e-9));
    expect(luminanceStops(kMeterReferenceLuminance * 8), closeTo(3, 1e-9));
    expect(meterFraction(0), closeTo(0.5, 1e-9));
    expect(meterFraction(luminanceStops(0)), 0); // covered lens pins left, never NaN
    expect(meterFraction(100), 1);
  });

  testWidgets('not recording: reports disabled with a hint, meter says why it is empty',
      (tester) async {
    final controller = SessionController(SensorSettings());
    await _pump(tester, controller);

    expect(find.text('Leerie'), findsOneWidget);
    expect(find.text('Not recording'), findsOneWidget);
    expect(find.text('Camera not running'), findsOneWidget);
    expect(find.text('Start recording to report how a street feels.'), findsOneWidget);
    final comfortable = tester.widget<ButtonStyleButton>(
        find.ancestor(of: find.text('Comfortable'), matching: find.bySubtype<ButtonStyleButton>()));
    expect(comfortable.onPressed, isNull);
  });

  testWidgets('recording: live reading in stops, reports enabled', (tester) async {
    final controller = SessionController(SensorSettings())
      ..luminance = kMeterReferenceLuminance * 4
      ..recording = RecordingState.recording
      ..startedAt = DateTime.now().subtract(const Duration(minutes: 4, seconds: 7))
      ..readingsRecorded = 312
      ..distanceM = 812;
    final screenshot = Platform.environment['LEERIE_SCREENSHOT'];
    if (screenshot != null) await tester.runAsync(_loadFonts);
    await _pump(tester, controller);

    expect(find.text('+2.0'), findsOneWidget);
    expect(find.text('relative, not lux'), findsOneWidget);
    expect(find.text('Stop recording'), findsOneWidget);
    expect(find.text('Start recording to report how a street feels.'), findsNothing);

    if (screenshot == null) return;
    final boundary = tester.renderObject<RenderRepaintBoundary>(find.byType(RepaintBoundary).first);
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 3);
      final png = await image.toByteData(format: ui.ImageByteFormat.png);
      File(screenshot).writeAsBytesSync(png!.buffer.asUint8List());
    });
  });
}
