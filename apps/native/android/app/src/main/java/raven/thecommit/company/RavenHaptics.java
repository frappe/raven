package raven.thecommit.company;

import android.content.Context;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;

/**
 * The page's haptic kinds (apps/web/src/utils/haptics.ts) as Android's own effects, shaped
 * like iOS's: tick / click / heavy click for impacts, a double click for warning, three
 * clicks for error, soft-then-firm for success. Older Android gets matching waveforms.
 */
final class RavenHaptics {
    // Asked once: the device's click primitive support never changes.
    private static Boolean clickPrimitive;

    private RavenHaptics() {}

    static void play(Context context, String kind) {
        Vibrator vibrator = vibrator(context);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        // Haptics are decoration: an OEM vibrator that rejects an effect must not fail the call.
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                vibratePre26(vibrator, fallbackPattern(kind));
                return;
            }
            VibrationEffect effect = effect(vibrator, kind);
            // As touch feedback, so the system's haptics setting applies.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH));
            } else {
                vibrator.vibrate(effect);
            }
        } catch (RuntimeException ignored) {
            // Nothing to fall back to.
        }
    }

    private static Vibrator vibrator(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return manager == null ? null : manager.getDefaultVibrator();
        }
        return deprecatedVibrator(context);
    }

    @SuppressWarnings("deprecation")
    private static Vibrator deprecatedVibrator(Context context) {
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    private static VibrationEffect effect(Vibrator vibrator, String kind) {
        if (hasClickPrimitive(vibrator)) {
            if ("error".equals(kind)) {
                return VibrationEffect.startComposition()
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK)
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1f, 70)
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1f, 70)
                    .compose();
            }
            if ("success".equals(kind)) {
                return VibrationEffect.startComposition()
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 0.5f)
                    .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1f, 70)
                    .compose();
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            switch (kind) {
                case "light": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK);
                case "heavy": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_HEAVY_CLICK);
                case "warning":
                case "success": return VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK);
                // No predefined triple: a three-pulse waveform.
                case "error": return VibrationEffect.createWaveform(fallbackPattern(kind), -1);
                default: return VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK);
            }
        }
        return VibrationEffect.createWaveform(fallbackPattern(kind), -1);
    }

    private static boolean hasClickPrimitive(Vibrator vibrator) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return false;
        if (clickPrimitive == null) clickPrimitive = vibrator.areAllPrimitivesSupported(VibrationEffect.Composition.PRIMITIVE_CLICK);
        return clickPrimitive;
    }

    // Off / on durations: one pulse per tap, longer for a firmer one.
    private static long[] fallbackPattern(String kind) {
        switch (kind) {
            case "light": return new long[] { 0, 10 };
            case "heavy": return new long[] { 0, 30 };
            case "warning":
            case "success": return new long[] { 0, 20, 80, 20 };
            case "error": return new long[] { 0, 20, 70, 20, 70, 20 };
            default: return new long[] { 0, 18 };
        }
    }

    @SuppressWarnings("deprecation")
    private static void vibratePre26(Vibrator vibrator, long[] pattern) {
        vibrator.vibrate(pattern, -1);
    }
}
