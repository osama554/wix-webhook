import express from "express";
import { AppStrategy, createClient } from "@wix/sdk";
import { products } from "@wix/stores";
import fetch from "node-fetch";
import Stripe from "stripe";
import cors from "cors";
import App from "./models/app.js";
import "dotenv/config";
import { connectDB } from "./utils/db.js";

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
        console.error("❌ Failed to get access token:", JSON.stringify(tokenData));
        throw new Error("Failed to get access token");
    }

    return { token: tokenData.access_token };
}

async function createOrderWithWixRates(token, paymentIntentId) {
    const response = await fetch("https://www.wixapis.com/ecom/v1/orders", {
        method: "POST",
        headers: {
            Authorization: token,
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
                    subtotal: { amount: "140.00", formattedAmount: "PKR 140.00" },
                    shipping: { amount: "10.00", formattedAmount: "PKR 10.00" },
                    tax: { amount: "10.00", formattedAmount: "PKR 10.00" },
                    total: { amount: "130.00", formattedAmount: "PKR 130.00" },
                },
                shippingInfo: {
                    carrierId: "45c44b27-ca7b-4891-8c0d-1747d588b835",
                    code: "635ae3a7-7e78-448a-b0f0-2f84e34e0709",
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
    return result;
}

const getProduct = async (token, productId) => {
    const productResponse = await fetch(
        `https://www.wixapis.com/stores-reader/v1/products/${productId}`,
        {
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
        }
    );
    const productData = await productResponse.json();

    return productData;
}

client.products.onProductChanged(async (event) => {
    try {
        await connectDB();
        const instanceId = event.metadata.instanceId;
        const productId = event.data.productId;
        const accessToken = await getAccessToken(instanceId);
        const products = await getProduct(accessToken.token, productId);
        await App.findOneAndUpdate(
            { instanceId, "products.productId": productId },
            { $set: { "products.$": products.product } },
            { new: true }
        );
    } catch (error) {
        console.error("Error handling product change:", error);
    }
});

const getShipment = async (token) => {
    try {
        const profilesRes = await fetch(
            "https://manage.wix.com/ecom/v1/delivery-profiles/query",
            {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({}),
            }
        );

        const profilesData = await profilesRes.json();
        const mergedProfiles = await Promise.all(
            profilesData.deliveryProfiles.map(async (profile) => {
                const carriersRes = await fetch(
                    `https://manage.wix.com/ecom/v1/delivery-profiles/${profile.id}/delivery-carriers`,
                    {
                        method: "POST",
                        headers: {
                            Authorization: token,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            appIds: [
                                ...new Set(
                                    profile.deliveryRegions.flatMap((r) =>
                                        r.deliveryCarriers.map((c) => c.appId)
                                    )
                                ),
                            ],
                            deliveryProfileId: profile.id,
                        }),
                    }
                );

                const carriersData = await carriersRes.json();
                const shippingResults = carriersData?.results?.[0]?.deliveryCarrierRegionalSettings || [];

                const enrichedRegions = profile.deliveryRegions.map((region) => {
                    const shippingInfo = shippingResults.find(
                        (s) => s.deliveryRegionId === region.id
                    );

                    let shipping = null;
                    if (shippingInfo) {
                        const firstTable = shippingInfo.dashboardTables?.[0];
                        const firstRow = firstTable?.rows?.[0];
                        if (firstRow) {
                            shipping = {
                                key: firstRow.key,
                                data: firstRow.data,
                                active: firstRow.active,
                            };
                        }
                    }

                    return {
                        ...region,
                        ...(shipping ? { shipping } : {}),
                    };
                });

                return {
                    ...profile,
                    deliveryRegions: enrichedRegions,
                };
            })
        );

        const mergedResponse = {
            deliveryProfiles: mergedProfiles,
            pagingMetadata: profilesData.pagingMetadata,
        };

        return mergedResponse;
    } catch (error) {
        console.error("❌ Error calculating rates:", error);
        res.status(500).json({ error: "Failed to calculate shipping rates" });
    }
}

const calculateTax = async (token, taxGroupId, body) => {
    const lineItems = body.lineItems.map((item) => ({
        ...item,
        taxGroupId: taxGroupId
    }))

    const calculateTaxResponse = await fetch(
        "https://www.wixapis.com/billing/v1/calculate-tax",
        {
            method: "POST",
            headers: {
                Authorization: token,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                "externalId": body.externalId,
                "currency": body.currency,
                "addresses": body.addresses,
                "lineItems": lineItems
            }),
        }
    );

    const taxData = await calculateTaxResponse.json();

    return taxData;
}

const getTaxGroups = async (token, body) => {
    try {
        const taxGroupResponse = await fetch(
            "https://www.wixapis.com/billing/v1/tax-groups/default-tax-groups",
            {
                method: "GET",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
            }
        );
        const taxGroupData = await taxGroupResponse.json();
        const productKey = taxGroupData.taxGroups.filter((group) => group.name === "Products")[0];
        const taxResult = await calculateTax(token, productKey.id, body);
        return taxResult;
    } catch (err) {
        console.error("❌", err);
    }
};

function parseRate(value) {
    if (!value) return 0;
    if (Array.isArray(value)) return parseRate(value[0]);
    return Number(value.replace(/[^0-9.]/g, "")) || 0;
}

function detectCurrency(value) {
    if (!value) return "USD";
    if (value.includes("PKR")) return "PKR";
    if (value.includes("$")) return "USD";
    return "USD";
}

function getRateByWeight(shippingData, productWeightKg) {
    if (!shippingData?.rate) return null;

    const rates = Array.isArray(shippingData.rate)
        ? shippingData.rate
        : [shippingData.rate];

    const rateRanges = Array.isArray(shippingData["rate-range"])
        ? shippingData["rate-range"]
        : [];

    // If multiple weight ranges are defined, pick the correct one
    if (rateRanges.length > 0) {
        for (let i = 0; i < rateRanges.length; i++) {
            const range = rateRanges[i];
            const [min, max] = range
                .split("-")
                .map(v => parseFloat(v.replace(/[^0-9.]/g, "")));

            if (productWeightKg >= min && productWeightKg <= max) {
                return rates[i];
            }
        }
        // fallback to first
        return rates[0];
    }

    // single flat rate
    return rates[0];
}

function generateShippingFromWix(deliveryProfiles = [], productWeightKg = 1) {
    const rates = [];

    deliveryProfiles.forEach(profile => {
        profile.deliveryRegions.forEach(region => {
            if (!region.active || !region.shipping?.data) return;
            const shipping = region.shipping.data;

            const destinations = region.destinations?.length
                ? region.destinations
                : [{ countryCode: "ALL", subdivisions: ["ALL"] }];

            destinations.forEach(dest => {
                const country = dest.countryCode || "ALL";
                const subdivisions =
                    dest.subdivisions?.length > 0 ? dest.subdivisions : ["ALL"];
                const method = shipping.name || region.name || "Standard";

                const selectedRate = getRateByWeight(shipping, productWeightKg);
                const price = parseRate(selectedRate);
                const currency = detectCurrency(selectedRate);

                subdivisions.forEach(sub =>
                    rates.push(
                        `${country}:${sub}:${method}:${price.toFixed(2)} ${currency}`
                    )
                );
            });
        });
    });

    return rates.join(", ");
}

const getCategories = async (token) => {
    try {
        const categoriesResponse = await fetch(
            "https://www.wixapis.com/stores/v1/collections/query",
            {
                method: "POST",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
            }
        );
        const categoriesData = await categoriesResponse.json();
        const categoriesTransform = categoriesData.collections.map((cat) => ({
            id: cat.id,
            name: cat.name
        }))

        return categoriesTransform;
    } catch (err) {
        console.error(err);
    }
}

function generateOpenAIProductFeed(product, variants = [], deliveryProfiles = [], categories = [], checkoutLinks) {
    if (!product) throw new Error("Product object is required.");

    const priceData = product.priceData || product.price || {};
    const stockData = product.stock || {};
    const weight = product.weightRange?.minValue || 1;

    const shippingString = generateShippingFromWix(deliveryProfiles, weight);

    const formattedCategories = categories
        .filter((item) => product.collectionIds.includes(item.id) && item.name !== "All Products")
        .map((cat) => `${cat.name} > ${product.name}`)?.[0];

    const feed = {
        enable_search: "true",
        enable_checkout: "true",
        id: product.id,
        title: product.name,
        description: product.description || "No description available.",
        price: `${priceData.price} ${priceData.currency}`,
        currency: priceData.currency,
        availability: stockData.inStock ? "in_stock" : "out_of_stock",
        inventory_quantity: stockData.quantity ?? 0,
        seller_name: "Chiizu Store",
        seller_url: product.productPageUrl?.base || "",
        image_link: product.media?.mainMedia?.image?.url || "",
        link: `${product.productPageUrl?.base}${product.productPageUrl?.path || ""}`,
        brand: product.brand,
        condition: "new",
        product_category: formattedCategories,
        weight: `${weight} kg`,
        shipping: shippingString,
        seller_privacy_policy: checkoutLinks.privacyPolicy.content,
        seller_tos: checkoutLinks.termsAndConditions.content,
        return_policy: checkoutLinks.returnPolicy.content,
        return_window: 30,
    };

    if (variants?.length) {
        feed.item_group_id = `product_${product.id}`;
        feed.item_group_title = product.name;
        feed.variants = variants.map((variant) => ({
            id: variant.id,
            title: `${product.name} - ${variant.name || variant.title || ""}`.trim(),
            sku: variant.sku || `SKU-${variant.id}`,
            offer_id: `${variant.id}-${priceData.price}`,
            color: variant.color || "Black",
            size: variant.size || variant.name || "",
            price: `${variant.priceData?.price || priceData.price} ${priceData.currency}`,
            availability: variant.stock?.inStock ? "in_stock" : "out_of_stock",
            inventory_quantity: variant.stock?.quantity ?? 0,
            purchase_link: `${product.productPageUrl?.base}${product.productPageUrl?.path}?variant=${variant.id}`,
        }));
    }

    return feed;
};

const getcheckoutLinks = async (token) => {
    try {
        const checkoutLinks = await fetch(
            "https://manage.wix.com/ecom/v1/checkout-settings",
            {
                method: "GET",
                headers: {
                    Authorization: token,
                    "Content-Type": "application/json",
                },
            }
        );
        const checkoutLinksData = await checkoutLinks.json();

        return checkoutLinksData.checkoutSettings.checkoutPolicies;
    } catch (err) {
        console.error(err);
    }
}

app.post("/getOpenAIProduct", async (req, res) => {
    const product = await getProduct(req.headers.authorization, req.body.productId);
    const shippment = await getShipment(req.headers.authorization);
    const categories = await getCategories(req.headers.authorization);
    const checkoutLinks = await getcheckoutLinks(req.headers.authorization);
    console.log(checkoutLinks);
    const result = generateOpenAIProductFeed(product.product, product.product.variants, shippment.deliveryProfiles, categories);
    res.send(result);
});

app.post("/getToken", async (req, res) => {
    const token = await getAccessToken(req.body.instanceId);
    res.send(token);
})

app.post("/create-payment-intent", async (req, res) => {
    const { amount, currency } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
        amount, // in smallest currency unit, e.g., PKR 130 = 13000
        currency,
        payment_method_types: ["card"]
    });

    res.send({ clientSecret: paymentIntent.client_secret, id: paymentIntent.id });
});

app.post("/getTax", async (req, res) => {
    const result = await getTaxGroups(req.headers.authorization, req.body);
    res.send(result);
});

app.post("/getShipment", async (req, res) => {
    const result = await getShipment(req.headers.authorization);
    res.send(result);
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

app.get("/getProduct/:id", async (req, res) => {
    const productId = req.params.id
    const products = await getProduct(req.headers.authorization, productId);
    res.send(products);
})

app.post("/create-wix-order", async (req, res) => {
    const { paymentIntentId } = req.body;

    const result = await createOrderWithWixRates(req.headers.authorization, paymentIntentId);
    res.send(result);
});

app.post("/addProducts/:instanceId", async (req, res) => {
    try {
        await connectDB();
        let data = req.body;
        if (!Array.isArray(data)) {
            data = [data];
        }
        const products = data.map((product) => ({
            ...product
        }));
        const updatedApp = await App.findOneAndUpdate(
            { instanceId: req.params.instanceId },
            { $push: { products: { $each: products } } },
            { new: true }
        );

        if (!updatedApp) {
            return res.status(404).json({ success: false, message: "App not found for this instanceId" });
        }

        res.json({
            success: true,
            message: `${products.length} product(s) added successfully`,
            app: updatedApp,
        });
    } catch (error) {
        console.error("Error adding products:", error);
        res
            .status(500)
            .json({ success: false, message: "Server error", error: error.message });
    }
});

app.post("/addApp", async (req, res) => {
    await connectDB();
    try {
        const body = req.body;
        const app = await App.findOne({ instanceId: body.instanceId });
        if (app) {
            res.json({ success: true, data: app })
        } else {
            await App.create(body);
            res.json({ success: true, message: "App added" })
        }
    } catch (e) {
        console.log(e);
    }
});

app.listen(3000, () => console.log("🚀 Server started on port 3000"));