// The camera image, cropped to fill its panel.

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../session/session_controller.dart';

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
