// Numbers carry units and periods. Civil-service plain English, and nothing is
// abbreviated that a committee would have to ask about.

String two(int v) => v.toString().padLeft(2, '0');

String hhmmss(DateTime t) => '${two(t.hour)}:${two(t.minute)}:${two(t.second)}';

String hhmm(DateTime t) => '${two(t.hour)}:${two(t.minute)}';

/// "3 uploads" / "1 upload" — measurement first, and never "1 uploads".
String plural(int count, String singular, [String? pluralForm]) =>
    '$count ${count == 1 ? singular : (pluralForm ?? '${singular}s')}';

String metresPerSecond(double? v) =>
    v == null ? '— m/s' : '${v.toStringAsFixed(1)} m/s';

String accelerationMps2(double v) => '${v.abs().toStringAsFixed(1)} m/s²';

String accuracyMetres(double? v) => v == null ? '±— m' : '±${v.round()} m';

/// Compass bearing. Wrapped into 0–359 so a heading is never printed as 361°.
String bearingDegrees(double? v) =>
    v == null ? '—°' : '${(v.round() % 360 + 360) % 360}°';

String kilometres(double km) => '${km.toStringAsFixed(1)} km';

String percent(double zeroToOne) => '${(zeroToOne * 100).round()}%';

/// Elapsed time as "4:07" or "1:04:07".
String elapsed(Duration d) {
  final h = d.inHours;
  final m = d.inMinutes % 60;
  final s = two(d.inSeconds % 60);
  return h > 0 ? '$h:${two(m)}:$s' : '$m:$s';
}
