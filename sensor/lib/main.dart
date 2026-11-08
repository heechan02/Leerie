// Leerie scanner. A phone carried on a night walk measures exposure-corrected
// light through the camera, tags it with GPS, and writes it straight to Supabase.
//
// Portrait only: the console is laid out for one hand on a walk.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'session/session_controller.dart';
import 'session/settings.dart';
import 'theme/theme.dart';
import 'theme/tokens.dart';
import 'ui/console_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations(
    <DeviceOrientation>[DeviceOrientation.portraitUp],
  );
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    statusBarBrightness: Brightness.dark,
    systemNavigationBarColor: BchColor.bg,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  final settings = await SensorSettings.load();
  runApp(LeerieApp(controller: SessionController(settings)));
}

class LeerieApp extends StatefulWidget {
  const LeerieApp({super.key, required this.controller});

  final SessionController controller;

  @override
  State<LeerieApp> createState() => _LeerieAppState();
}

class _LeerieAppState extends State<LeerieApp> {
  @override
  void initState() {
    super.initState();
    // After the first frame, so the camera and location prompts appear over a
    // drawn console rather than a blank screen.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(widget.controller.start());
    });
  }

  @override
  void dispose() {
    unawaited(widget.controller.shutdown());
    widget.controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Leerie',
      debugShowCheckedModeBanner: false,
      theme: buildLeerieTheme(),
      home: ConsoleScreen(controller: widget.controller),
      builder: (context, child) {
        // The console is read at arm's length on a walk; it does not reflow,
        // so cap the text scale rather than let rows collide.
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: media.textScaler.clamp(maxScaleFactor: 1.15),
          ),
          child: child ?? const SizedBox.shrink(),
        );
      },
    );
  }
}
