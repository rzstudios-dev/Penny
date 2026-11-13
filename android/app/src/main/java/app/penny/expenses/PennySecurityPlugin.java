package app.penny.expenses;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PennySecurity")
public class PennySecurityPlugin extends Plugin {
    @PluginMethod public void availability(PluginCall call) {
        boolean available = BiometricManager.from(getContext()).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS;
        JSObject result = new JSObject(); result.put("available", available); call.resolve(result);
    }

    @PluginMethod public void authenticate(PluginCall call) {
        if (BiometricManager.from(getContext()).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Fingerprint or face unlock is unavailable on this device."); return;
        }
        getActivity().runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt((FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        JSObject value = new JSObject(); value.put("authenticated", true); call.resolve(value);
                    }
                    @Override public void onAuthenticationError(int code, CharSequence message) {
                        call.reject(message.toString());
                    }
                });
            prompt.authenticate(new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock Penny")
                .setSubtitle("Use your fingerprint or face")
                .setNegativeButtonText("Use Penny PIN")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build());
        });
    }
}
