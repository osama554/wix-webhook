import express from "express";
import { AppStrategy, createClient } from "@wix/sdk";
import { products } from "@wix/stores";
import fetch from "node-fetch";

const app = express();
app.use(express.json()); // To parse JSON request bodies

const PUBLIC_KEY = process.env.PUBLIC_KEY;
const APP_ID = process.env.WIX_APP_ID;
const APP_SECRET = process.env.WIX_APP_SECRET;

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

    const tokenResponse = await fetch("https://www.wixapis.com/oauth2/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenBody),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
        console.error("❌ Failed to get access token:", tokenData);
        throw new Error("Failed to get access token");
    }

    return tokenData.access_token;
}

async function getStoreCurrency(token) {
    const response = await fetch("https://www.wixapis.com/stores/v2/general-settings", {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    return data.generalSettings.currency || "PKR";
}

/* -------------------------------------------------------------------------- */
/*                           2️⃣ Shipping Calculation                          */
/* -------------------------------------------------------------------------- */
async function getShippingRates(instanceId, items, destination) {
    const token = await getAccessToken(instanceId);

    const body = {
        lineItems: items.map((i) => ({
            catalogItemId: i.productId,
            quantity: i.quantity,
        })),
        destination: {
            address: {
                country: destination.country,
                city: destination.city,
                postalCode: destination.postalCode,
            },
        },
    };

    const response = await fetch(
        "https://www.wixapis.com/stores/v2/calculate-shipping-rates",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }
    );

    const data = await response.json();
    if (!data.shippingRates?.length) {
        throw new Error("No shipping rates returned from Wix");
    }

    console.log("🚚 Shipping rates:", data.shippingRates);
    return data;
}

/* -------------------------------------------------------------------------- */
/*                               3️⃣ Tax Calculation                           */
/* -------------------------------------------------------------------------- */
async function getTax(instanceId, items, destination) {
    const token = await getAccessToken(instanceId);

    const body = {
        lineItems: items.map((i) => ({
            catalogItemId: i.productId,
            quantity: i.quantity,
            price: { amount: i.price },
        })),
        destination: {
            address: destination,
        },
    };

    const response = await fetch(
        "https://www.wixapis.com/stores/v2/calculate-taxes",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        }
    );

    const data = await response.json();
    console.log("💸 Tax result:", data);
    return data;
}

/* -------------------------------------------------------------------------- */
/*                              4️⃣ Create Order                              */
/* -------------------------------------------------------------------------- */
async function createOrderWithWixRates(instanceId, orderInput) {
    const token = await getAccessToken(instanceId);

    // Get store currency
    const currency = await getStoreCurrency(token);

    // 1️⃣ Shipping
    const shippingData = await getShippingRates(token, orderInput.items, orderInput.address);
    const shipping = shippingData.shippingRates?.[0];
    if (!shipping) throw new Error("No shipping rates found");

    // 2️⃣ Tax
    const taxData = await getTax(token, orderInput.items, orderInput.address);
    const totalTax = taxData.taxSummary?.totalTax || 0;

    // 3️⃣ Totals
    const subtotal = orderInput.items.reduce(
        (acc, i) => acc + i.price * i.quantity,
        0
    );
    const total = subtotal + totalTax + shipping.price.amount;

    // 4️⃣ Build order
    const orderData = {
        channelType: "EXTERNAL",
        currency,
        buyerInfo: orderInput.buyerInfo,
        lineItems: orderInput.items.map((i) => ({
            catalogReference: {
                appId: APP_ID,
                catalogItemId: i.productId,
            },
            quantity: i.quantity,
            price: { amount: i.price },
        })),
        shippingInfo: {
            shipmentDetails: {
                deliveryOption: shipping.title,
                estimatedDeliveryTime: shipping.deliveryTime,
            },
            priceData: { amount: shipping.price.amount },
            address: orderInput.address,
        },
        priceSummary: {
            subtotal,
            tax: totalTax,
            shipping: shipping.price.amount,
            total,
        },
        paymentStatus: "PAID",
    };

    // 5️⃣ Create Wix order
    const response = await fetch("https://www.wixapis.com/ecom/v1/orders", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
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

// Test route to create order manually (POST JSON body)
app.post("/create-order", async (req, res) => {
    try {
        const { instanceId, orderInput } = req.body;
        const result = await createOrderWithWixRates(instanceId, orderInput);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

/* -------------------------------------------------------------------------- */
/*                                  Server                                   */
/* -------------------------------------------------------------------------- */
app.listen(3000, () => console.log("🚀 Server started on port 3000"));