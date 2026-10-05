package app.penny.expenses;

import com.android.billingclient.api.*;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Native checkout only. Entitlements are verified and acknowledged on the server. */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billing;
    private final Map<String, ProductDetails> products = new HashMap<>();
    private final Map<String, String> paidMonthlyOffers = new HashMap<>();
    private final List<Runnable> connectionQueue = new ArrayList<>();
    private final List<PluginCall> connectionCalls = new ArrayList<>();
    private boolean connecting = false;
    private PluginCall purchaseCall;

    @Override public void load() {
        billing = BillingClient.newBuilder(getContext()).setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection().build();
    }

    private void ready(PluginCall call, Runnable task) {
        getActivity().runOnUiThread(() -> {
            if (billing.isReady()) { task.run(); return; }
            connectionQueue.add(task); connectionCalls.add(call);
            if (connecting) return;
            connecting = true;
            billing.startConnection(new BillingClientStateListener() {
                @Override public void onBillingSetupFinished(BillingResult result) {
                    connecting = false;
                    List<Runnable> queued = new ArrayList<>(connectionQueue);
                    List<PluginCall> callers = new ArrayList<>(connectionCalls);
                    connectionQueue.clear(); connectionCalls.clear();
                    if (result.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                        for (Runnable runnable : queued) runnable.run();
                    } else for (PluginCall waiting : callers) waiting.reject("Google Play Billing is unavailable. Install the app from Google Play and try again.");
                }
                @Override public void onBillingServiceDisconnected() { connecting = false; }
            });
        });
    }

    @PluginMethod public void getProduct(PluginCall call) {
        String productId = call.getString("productId");
        if (productId == null) { call.reject("Missing subscription product."); return; }
        ready(call, () -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder().setProductList(Collections.singletonList(
                QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(BillingClient.ProductType.SUBS).build()
            )).build();
            billing.queryProductDetailsAsync(params, (result, response) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK || response.getProductDetailsList().isEmpty()) {
                    call.reject("Subscription is not available. Check the Google Play product configuration."); return;
                }
                ProductDetails details = response.getProductDetailsList().get(0);
                List<ProductDetails.SubscriptionOfferDetails> offers = details.getSubscriptionOfferDetails();
                if (offers != null) for (ProductDetails.SubscriptionOfferDetails offer : offers) {
                    List<ProductDetails.PricingPhase> phases = offer.getPricingPhases().getPricingPhaseList();
                    if (offer.getOfferId() != null || phases.size() != 1) continue; // No undisclosed trial or intro offer.
                    ProductDetails.PricingPhase phase = phases.get(0);
                    if (!"P1M".equals(phase.getBillingPeriod()) || phase.getRecurrenceMode() != ProductDetails.RecurrenceMode.INFINITE_RECURRING || phase.getPriceAmountMicros() <= 0) continue;
                    products.put(productId, details);
                    paidMonthlyOffers.put(productId, offer.getOfferToken());
                    JSObject data = new JSObject(); data.put("productId", productId); data.put("title", details.getTitle());
                    data.put("price", phase.getFormattedPrice()); data.put("offerToken", offer.getOfferToken()); data.put("billingPeriod", phase.getBillingPeriod());
                    call.resolve(data); return;
                }
                call.reject("Configure an active monthly auto-renewing base plan without a trial.");
            });
        });
    }

    @PluginMethod public void purchase(PluginCall call) {
        String productId = call.getString("productId"), offerToken = call.getString("offerToken"), accountId = call.getString("accountId");
        ProductDetails product = products.get(productId);
        if (product == null || offerToken == null || !offerToken.equals(paidMonthlyOffers.get(productId)) || accountId == null || !accountId.matches("[a-f0-9]{64}")) { call.reject("Load the paid monthly subscription and sign in before purchasing."); return; }
        if (purchaseCall != null) { call.reject("A checkout is already open."); return; }
        ready(call, () -> {
            BillingFlowParams.ProductDetailsParams item = BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(product).setOfferToken(offerToken).build();
            BillingFlowParams params = BillingFlowParams.newBuilder().setProductDetailsParamsList(Collections.singletonList(item)).setObfuscatedAccountId(accountId).build();
            purchaseCall = call;
            BillingResult result = billing.launchBillingFlow(getActivity(), params);
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { purchaseCall = null; call.reject("Google Play could not open checkout. Try restoring an existing purchase."); }
        });
    }

    private JSObject purchaseData(Purchase purchase, String product) {
        JSObject value = new JSObject(); value.put("purchaseToken", purchase.getPurchaseToken()); value.put("productId", product);
        value.put("pending", purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED || purchase.isSuspended()); return value;
    }

    @Override public void onPurchasesUpdated(BillingResult result, List<Purchase> purchases) {
        PluginCall call = purchaseCall; purchaseCall = null;
        if (result.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            Purchase purchase = purchases.get(0);
            String product = purchase.getProducts().isEmpty() ? "" : purchase.getProducts().get(0);
            JSObject data = purchaseData(purchase, product);
            if (call != null) call.resolve(data);
            notifyListeners("purchaseUpdated", data, true);
        } else if (call != null) {
            call.reject(result.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED ? "Checkout canceled. Nothing changed in Penny." : "Purchase did not complete. Try Restore purchase if you were charged.");
        }
    }

    @PluginMethod public void restore(PluginCall call) {
        ready(call, () -> billing.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (result, purchases) -> {
            if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject("Could not restore purchases. Check your connection."); return; }
            JSArray items = new JSArray();
            for (Purchase purchase : purchases) for (String product : purchase.getProducts()) items.put(purchaseData(purchase, product));
            JSObject response = new JSObject(); response.put("purchases", items); call.resolve(response);
        }));
    }

    @Override protected void handleOnDestroy() {
        if (purchaseCall != null) { purchaseCall.reject("Checkout was interrupted. Restore purchase when you reopen Penny."); purchaseCall = null; }
        if (billing != null) billing.endConnection();
        super.handleOnDestroy();
    }
}
