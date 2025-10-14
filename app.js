import express from "express";
import { AppStrategy, createClient } from "@wix/sdk";
import { products } from "@wix/stores";
import fetch from "node-fetch";
import Stripe from "stripe";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA41+JsKTD7mHLRFSAsmIN
vFJe26BjtZtCmp+g6vL5NgXGVCovER2QhCQcDIJF6VcLYU5HH3PGYTKa9LSZdOYw
CVMR/hxK8KhXLTFbhMM+Lh+ybQdthOmmcsa0DGVXt/K2C23JR80+r1Wqi4hmB31Q
FDTKN6+PREr2aSMhAw2NMRYaJwjIRe3FX7LF++8sjJd+I2Pu9jFRVpa8r7+nty3t
iUL+I9NjXIcRxIC641DFK1pySfwKh/vBTpACZERmqX5cFC/VwyrV8CfflkGYX4id
iZB0hilqruPAyRu+cURQejucKrLagE1W69QS2di+2u6Ut8B4Th/LL2ilVo63UjpM
7wIDAQAB
-----END PUBLIC KEY-----`;
const APP_ID = "e407600d-a432-49d4-b62f-f99c0ddde8c7";
const APP_SECRET = "aadc0a11-7e19-41dd-a949-8fcf8a6650ed";
const stripe = new Stripe("sk_test_51IgZ1HAy6mgpkkqAlsASKtiU0l36fMJsDktMByiuJg6DYzo9GNHi9ArHeZkcAr9v11rSH3d6T1tqpDGWk3DeKalz00Xtd7jXBM");

const client = createClient({
    auth: AppStrategy({
        appId: APP_ID,
        publicKey: PUBLIC_KEY,
    }),
    modules: { products },
});

/* -------------------------------------------------------------------------- */
/*                              1️⃣ Access Token                               */
/* -------------------------------------------------------------------------- */
async function getAccessToken(instanceId) {
    const tokenBody = {
        grant_type: "client_credentials",
        client_id: APP_ID,
        client_secret: APP_SECRET,
        instance_id: instanceId,
    };

    console.log("tokenBody", tokenBody);

    const tokenResponse = await fetch("https://www.wixapis.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
        console.error("❌ Failed to get access token:", JSON.stringify(tokenData));
        throw new Error("Failed to get access token");
    }

    return tokenData.access_token;
}

async function getStoreCurrency(token) {
    try {
        const response = await fetch("https://www.wixapis.com/stores/v2/general-settings", {
            headers: { Authorization: `Bearer ${token}` },
        });
        const text = await response.text();
        if (!text) {
            console.warn("⚠️ Store settings empty. Defaulting to PKR.");
            return "PKR";
        }
        const data = JSON.parse(text);
        return data.generalSettings?.currency || "PKR";
    } catch (e) {
        console.error("Error fetching store currency:", e);
        return "PKR"; // fallback
    }
};

app.post("/create-payment-intent", async (req, res) => {
    const { amount, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
        amount, // in smallest currency unit, e.g., PKR 130 = 13000
        currency,
        payment_method_types: ["card"]
    });

    res.send({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
});

/* -------------------------------------------------------------------------- */
/*                              4️⃣ Create Order                              */
/* -------------------------------------------------------------------------- */
async function createOrderWithWixRates(instanceId, paymentIntentId) {
    const token = await getAccessToken(instanceId);

    // 5️⃣ Create Wix order
    const response = await fetch("https://www.wixapis.com/ecom/v1/orders", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            order: {
                buyerInfo: {
                    email: "customer@example.com",
                    firstName: "Osama",
                    lastName: "Naeem",
                },
                lineItems: [
                    {
                        productName: { original: "Signal DL" },
                        quantity: 1,
                        price: {
                            amount: "120.00",
                            formattedAmount: "PKR 120.00",
                        },
                        catalogReference: {
                            catalogItemId: "b309d740-88f2-f284-4a37-e39cf8e75666",
                            appId: APP_ID,
                        },
                        itemType: { preset: "PHYSICAL" },
                        totalPriceBeforeTax: {
                            amount: "120.00",
                            formattedAmount: "PKR 120.00",
                        },
                        totalPriceAfterTax: {
                            amount: "120.00",
                            formattedAmount: "PKR 120.00",
                        },
                        taxDetails: {
                            taxRate: "0",
                            totalTax: {
                                amount: "0",
                                formattedAmount: "$0.00"
                            }
                        }
                    },
                ],
                priceSummary: {
                    subtotal: { amount: "120.00", formattedAmount: "PKR 120.00" },
                    shipping: { amount: "10.00", formattedAmount: "PKR 10.00" },
                    tax: { amount: "0.00", formattedAmount: "PKR 0.00" },
                    total: { amount: "130.00", formattedAmount: "PKR 130.00" },
                },
                shippingInfo: {
                    carrierId: "c8a08776-c095-4dec-8553-8f9698d86adc",
                    code: "4a43a709-d4a0-e07e-33e6-9c8618796577",
                    title: "Standard shipping",
                    logistics: {
                        deliveryTime: "3 - 5 business days",
                        shippingDestination: {
                            address: {
                                country: "US",
                                subdivision: "US-NY",
                                city: "New York",
                                postalCode: "10173",
                                addressLine: "525 5th Ave",
                                countryFullname: "United States",
                                subdivisionFullname: "New York"
                            },
                        },
                    },
                },
                paymentInfo: {
                    status: "PAID",
                    type: "EXTERNAL",
                    amount: { amount: 120 + 10, formattedAmount: `PKR ${120 + 10}` },
                    currency: "PKR",
                    paymentId: paymentIntentId,
                    gatewayId: "STRIPE"
                },
                currency: "PKR",
                paymentStatus: "PAID",
                channelInfo: { type: "EXTERNAL" },
                status: "APPROVED",
            }
        }),
    });

    const result = await response.json();
    console.log("✅ Created Wix Order:", JSON.stringify(result, null, 2));
    return result;
}

/* -------------------------------------------------------------------------- */
/*                          5️⃣ Webhook + Test Route                          */
/* -------------------------------------------------------------------------- */
client.products.onProductChanged(async (event) => {
    try {
        console.log("onProductChanged invoked:", event);
        const instanceId = event.metadata.instanceId;
        const productId = event.data.productId;

        const token = await getAccessToken(instanceId);
        const productResponse = await fetch(
            `https://www.wixapis.com/stores-reader/v1/products/${productId}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        );
        const productData = await productResponse.json();
        console.log("📦 Product:", productData);
    } catch (error) {
        console.error("Error handling product change:", error);
    }
});

app.post("/webhook", express.text(), async (req, res) => {
    try {
        await client.webhooks.process(req.body);
        res.status(200).send();
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send(`Webhook error: ${err.message}`);
    }
});

app.post("/create-wix-order", async (req, res) => {
    const { paymentIntentId } = req.body;

    const result = await createOrderWithWixRates("4ec820f7-9fcb-4ede-8496-3cf7e5c525ed", paymentIntentId);
    res.send(result);
});

function calculateTotals(lineItems = []) {
    let totalWeight = 0;
    let totalPrice = 0;

    for (const item of lineItems) {
        const qty = item.quantity || 1;
        const itemWeight = item.weight?.value || 0;
        const itemPrice = item.price?.amount || 0;

        totalWeight += itemWeight * qty;
        totalPrice += itemPrice * qty;
    }

    return { totalWeight, totalPrice };
}

// Helper: generate rates based on logic
function getRates({ destination, totalWeight, totalPrice, currency }) {
    const isDomestic = destination?.country === "US"; // Example country
    const rates = [];

    if (isDomestic) {
        // 🏠 Domestic Shipping Logic
        // Base + per weight cost
        const baseCost = 4.99;
        const perKg = 2.0;
        const weightCost = totalWeight * perKg;

        rates.push({
            code: "STANDARD_DOMESTIC",
            title: "Standard Shipping (3–5 days)",
            deliveryTime: { minDays: 3, maxDays: 5 },
            cost: { amount: baseCost + weightCost, currency },
        });

        // Free shipping for high-value orders
        if (totalPrice >= 100) {
            rates.push({
                code: "FREE_SHIP",
                title: "Free Shipping (Orders over $100)",
                deliveryTime: { minDays: 3, maxDays: 5 },
                cost: { amount: 0, currency },
            });
        }

        // Express Option
        rates.push({
            code: "EXPRESS_DOMESTIC",
            title: "Express Shipping (1–2 days)",
            deliveryTime: { minDays: 1, maxDays: 2 },
            cost: { amount: 12.99 + totalWeight * 1.5, currency },
        });
    } else {
        // 🌍 International Shipping Logic
        const baseIntl = 10.0;
        const perKgIntl = 5.0;
        const intlCost = baseIntl + totalWeight * perKgIntl;

        rates.push({
            code: "INTL_STANDARD",
            title: "International Standard (7–14 days)",
            deliveryTime: { minDays: 7, maxDays: 14 },
            cost: { amount: intlCost, currency },
        });

        if (totalPrice >= 200) {
            rates.push({
                code: "INTL_FREE",
                title: "Free International Shipping (Orders over $200)",
                deliveryTime: { minDays: 7, maxDays: 14 },
                cost: { amount: 0, currency },
            });
        }
    }

    return rates;
}

// Main endpoint for Wix
app.post("/v1/getRates", async (req, res) => {
    try {
        const { destination, lineItems, currency = "USD" } = req.body;
        const { totalWeight, totalPrice } = calculateTotals(lineItems);

        console.log("📦 Calculating rates for order:");
        console.log(`Weight: ${totalWeight} kg, Price: ${totalPrice} ${currency}`);

        const rates = getRates({ destination, totalWeight, totalPrice, currency });

        res.json({ rates });
    } catch (error) {
        console.error("❌ Error calculating rates:", error);
        res.status(500).json({ error: "Failed to calculate shipping rates" });
    }
});

/* -------------------------------------------------------------------------- */
/*                                  Server                                   */
/* -------------------------------------------------------------------------- */
app.listen(3000, () => console.log("🚀 Server started on port 3000"));