// Leerie design tokens, from dashboard/src/app/globals.css, inverted for
// night use: the scanner is read at 3am, so the ground is near-black and the ink is
// off-white (never pure white). Spec: docs/design/DESIGN.md. Never hard-code a
// colour, size, radius, shadow or duration in a widget; take it from here.
//
// Ink steps are written as explicit ARGB constants rather than computed with
// withOpacity/withValues so they are const and stable across Flutter versions.

import 'package:flutter/widgets.dart';

/// Colour. Dusk-to-night Edinburgh with one sodium street lamp: the lamp amber is
/// the accent, ember means "recording" or "uncomfortable", teal means
/// "comfortable". Scales run from the ground (100) to the ink (900), so on this
/// dark theme 100 is the darkest step.
abstract final class BchColor {
  static const bg = Color(0xFF0B0D1A);

  /// Top of the dusk gradient behind the console.
  static const bgTop = Color(0xFF1A1B3A);
  static const surface = Color(0xFF15172E);
  static const raised = Color(0xFF1E1F3D);
  static const text = Color(0xFFECE8F4);
  static const dim = Color(0xFF9A98B5);
  static const accent = Color(0xFFF5B54A);

  /// The lamp at full strength.
  static const hot = Color(0xFFFFD27A);

  /// Recording, and the "uncomfortable" report. Always paired with the word.
  static const live = Color(0xFFE8743B);
  static const live24 = Color(0x3DE8743B);
  static const live12 = Color(0x1FE8743B);

  /// The "comfortable" report.
  static const comfort = Color(0xFF7CC6A4);
  static const comfort12 = Color(0x1F7CC6A4);

  static const accent100 = Color(0xFF2E2414);
  static const accent200 = Color(0xFF4A3718);
  static const accent300 = Color(0xFF7A5A22);
  static const accent400 = Color(0xFFB0822F);
  static const accent500 = Color(0xFFD99E3E);
  static const accent600 = Color(0xFFF5B54A);
  static const accent700 = Color(0xFFFFC766);
  static const accent800 = Color(0xFFFFE0A3);
  static const accent900 = Color(0xFFFFF1D6);

  static const neutral100 = Color(0xFF15172E);
  static const neutral200 = Color(0xFF1E1F3D);
  static const neutral300 = Color(0xFF2A2B4D);
  static const neutral400 = Color(0xFF3D3E63);
  static const neutral500 = Color(0xFF6E6C8C);
  static const neutral600 = Color(0xFF9A98B5);
  static const neutral700 = Color(0xFFB9B7CF);
  static const neutral800 = Color(0xFFD5D2E3);
  static const neutral900 = Color(0xFFECE8F4);

  /// Ink (the `text` colour) at fixed opacities.
  static const ink72 = Color(0xB8ECE8F4);
  static const ink58 = Color(0x94ECE8F4);
  static const ink55 = Color(0x8CECE8F4);
  static const ink45 = Color(0x73ECE8F4);
  static const ink38 = Color(0x61ECE8F4);
  static const ink12 = Color(0x1FECE8F4);
  static const ink7 = Color(0x12ECE8F4);
  static const ink5 = Color(0x0DECE8F4);
  static const ink3 = Color(0x08ECE8F4);

  /// Hairlines and card outlines.
  static const divider = Color(0x1AECE8F4); // ink 10%

  /// Lamp amber at partial strength: guides, washes and the meter track.
  static const accent40 = Color(0x66F5B54A);
  static const accent24 = Color(0x3DF5B54A);
  static const accent10 = Color(0x1AF5B54A);

  /// Marks drawn over the camera image, where the ground is a photograph.
  static const scrim = Color(0x8C0B0D1A);
  static const white = Color(0xFFFFFFFF);
  static const white10 = Color(0x1AFFFFFF);
  static const white24 = Color(0x3DFFFFFF);
  static const white55 = Color(0x8CFFFFFF);
  static const white70 = Color(0xB3FFFFFF);
}

/// Space. The Industry scale, 3.4px × n. No other values are allowed.
abstract final class BchSpace {
  static const s1 = 3.4;
  static const s2 = 6.8;
  static const s3 = 10.2;
  static const s4 = 13.6;
  static const s6 = 20.4;
  static const s8 = 27.2;
}

/// Radius. The mockup's override of the Industry base (which is 0).
abstract final class BchRadius {
  static const sm = Radius.circular(5);
  static const md = Radius.circular(10);
  static const lg = Radius.circular(16);
  static const xl = Radius.circular(22);

  static const smAll = BorderRadius.all(sm);
  static const mdAll = BorderRadius.all(md);
  static const lgAll = BorderRadius.all(lg);
  static const xlAll = BorderRadius.all(xl);
}

/// Elevation. Only for things that overlap the map — here, the camera image.
abstract final class BchShadow {
  static const sm = <BoxShadow>[
    BoxShadow(color: Color(0x242B2B2D), blurRadius: 2, offset: Offset(0, 1)),
  ];
  static const md = <BoxShadow>[
    BoxShadow(color: Color(0x292B2B2D), blurRadius: 10, offset: Offset(0, 3)),
  ];
}

/// Motion exists to preserve continuity, not to entertain. Nothing else animates.
abstract final class BchMotion {
  static const ease = Cubic(0.2, 0.6, 0.2, 1);

  /// Hover and selection tints.
  static const tint = Duration(milliseconds: 120);

  /// A status change — a candidate becoming a detection.
  static const state = Duration(milliseconds: 240);

  /// Position interpolation. A jumping marker reads as a bug.
  static const track = Duration(milliseconds: 1200);
}

/// The console frame, from DESIGN.md §0.
abstract final class BchFrame {
  static const headerH = 62.0;
  static const rowH = 58.0;
  static const rowHCompact = 46.0;
  static const footerH = 68.0;
  static const meterBarH = 8.0;

  /// Thumb-sized at arm's length, gloved, at night.
  static const actionH = 64.0;
  static const inspectorMinH = 132.0;

  /// The graticule that makes a surface read as survey rather than photograph.
  static const graticuleStep = 64.0;
}

/// Type. Inter for the UI, a system serif for the wordmark; headings at 600. Identifiers, coordinates and
/// timestamps are tabular so numbers align down a column.
abstract final class BchType {
  static const family = 'Inter';

  /// The "Leerie" wordmark: the system serif (Georgia on iOS, Noto Serif on
  /// Android), since no serif is bundled.
  static const wordmark = TextStyle(
    fontFamily: 'Georgia',
    fontFamilyFallback: <String>['serif', 'Times New Roman'],
    fontSize: 30,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.2,
    height: 1.05,
    color: BchColor.text,
  );

  static const consoleTitle = TextStyle(
    fontFamily: family,
    fontSize: 16,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.64,
    height: 1.25,
    color: BchColor.text,
  );

  /// 10–11px uppercase. Every panel gets one, top-left.
  static const panelLabel = TextStyle(
    fontFamily: family,
    fontSize: 11,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.88,
    height: 1.2,
    color: BchColor.ink55,
  );

  static const metric = TextStyle(
    fontFamily: family,
    fontSize: 22,
    fontWeight: FontWeight.w600,
    height: 1,
    letterSpacing: -0.3,
    color: BchColor.text,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  /// The live light reading: the number the stage demo is watched by.
  static const hero = TextStyle(
    fontFamily: family,
    fontSize: 58,
    fontWeight: FontWeight.w600,
    height: 1,
    letterSpacing: -1,
    color: BchColor.text,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const metricLabel = TextStyle(
    fontFamily: family,
    fontSize: 11,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.6,
    height: 1.3,
    color: BchColor.dim,
  );

  static const rowPrimary = TextStyle(
    fontFamily: family,
    fontSize: 15,
    fontWeight: FontWeight.w500,
    height: 1.25,
    color: BchColor.text,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const rowRef = TextStyle(
    fontFamily: family,
    fontSize: 11,
    fontWeight: FontWeight.w400,
    height: 1.3,
    letterSpacing: 0.44,
    color: BchColor.ink45,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const rowSecondary = TextStyle(
    fontFamily: family,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.3,
    color: BchColor.ink58,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const rowNumeral = TextStyle(
    fontFamily: family,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.1,
    color: BchColor.ink72,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const inspectorTitle = TextStyle(
    fontFamily: family,
    fontSize: 20,
    fontWeight: FontWeight.w600,
    height: 1.15,
    letterSpacing: -0.3,
    color: BchColor.text,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const body = TextStyle(
    fontFamily: family,
    fontSize: 13,
    fontWeight: FontWeight.w400,
    height: 1.4,
    color: BchColor.ink72,
    fontFeatures: [FontFeature.tabularFigures()],
  );

  static const caption = TextStyle(
    fontFamily: family,
    fontSize: 12,
    fontWeight: FontWeight.w400,
    height: 1.35,
    color: BchColor.dim,
  );

  static const micro = TextStyle(
    fontFamily: family,
    fontSize: 10,
    fontWeight: FontWeight.w600,
    letterSpacing: 1.2,
    height: 1.2,
    color: BchColor.ink55,
  );

  /// Record/Stop and the report buttons, read at arm's length.
  static const action = TextStyle(
    fontFamily: family,
    fontSize: 18,
    fontWeight: FontWeight.w600,
    height: 1.2,
  );

  static const button = TextStyle(
    fontFamily: family,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    height: 1.2,
    letterSpacing: 0,
  );

  static const chip = TextStyle(
    fontFamily: family,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: 1.2,
  );
}
