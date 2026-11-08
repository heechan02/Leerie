// The camera image, cropped to fill a panel or fitted whole for full screen.

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../session/session_controller.dart';
import '../theme/tokens.dart';

class PreviewSurface extends StatelessWidget {
  const PreviewSurface({
    super.key,
    required this.controller,
    required this.camera,
    this.crop = true,
  });

  final SessionController controller;
  final CameraController camera;

  /// True fills the panel and crops the frame; false fits the whole frame in.
  final bool crop;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final boxAspect = constraints.maxWidth / constraints.maxHeight;
        final previewAspect = controller.previewAspect;
        // Cover fills the box on the axis that would otherwise letterbox; contain does the opposite.
        final fillByWidth = crop ? boxAspect > previewAspect : boxAspect <= previewAspect;
        final width = fillByWidth ? constraints.maxWidth : constraints.maxHeight * previewAspect;
        final height = fillByWidth ? constraints.maxWidth / previewAspect : constraints.maxHeight;

        return ClipRect(
          child: OverflowBox(
            minWidth: width,
            maxWidth: width,
            minHeight: height,
            maxHeight: height,
            child: CameraPreview(camera),
          ),
        );
      },
    );
  }
}

/// The same camera stream, full screen. Tap anywhere to close.
class CameraFullscreen extends StatelessWidget {
  const CameraFullscreen({super.key, required this.controller});

  final SessionController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => Navigator.of(context).pop(),
        child: Semantics(
          button: true,
          label: 'Full screen camera. Tap to close.',
          child: ListenableBuilder(
            listenable: controller,
            builder: (context, _) {
              final camera = controller.camera;
              if (camera == null || !camera.value.isInitialized) {
                return Center(
                  child: Text(
                    controller.cameraStatus.label,
                    style: BchType.body.copyWith(color: BchColor.white70),
                  ),
                );
              }
              return PreviewSurface(controller: controller, camera: camera, crop: false);
            },
          ),
        ),
      ),
    );
  }
}
