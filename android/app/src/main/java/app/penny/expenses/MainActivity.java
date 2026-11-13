package app.penny.expenses;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        registerPlugin(PennySecurityPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
