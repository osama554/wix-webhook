// import express from "express";
// import fetch from "node-fetch";
// import { AppStrategy, OAuthStrategy, createClient } from "@wix/sdk";
// import { products, productsV3 } from "@wix/stores";
// import dotenv from "dotenv";
// import crypto from "crypto";
// import { saveTokens, getTokensByInstanceId } from "./db.js";

// dotenv.config();
// const app = express();
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// const PORT = process.env.PORT || 3000;

// // ======================
// // 1️⃣ BASE APP CONFIG
// // ======================
// const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
// MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA41+JsKTD7mHLRFSAsmIN
// vFJe26BjtZtCmp+g6vL5NgXGVCovER2QhCQcDIJF6VcLYU5HH3PGYTKa9LSZdOYw
// CVMR/hxK8KhXLTFbhMM+Lh+ybQdthOmmcsa0DGVXt/K2C23JR80+r1Wqi4hmB31Q
// FDTKN6+PREr2aSMhAw2NMRYaJwjIRe3FX7LF++8sjJd+I2Pu9jFRVpa8r7+nty3t
// iUL+I9NjXIcRxIC641DFK1pySfwKh/vBTpACZERmqX5cFC/VwyrV8CfflkGYX4id
// iZB0hilqruPAyRu+cURQejucKrLagE1W69QS2di+2u6Ut8B4Th/LL2ilVo63UjpM
// 7wIDAQAB
// -----END PUBLIC KEY-----`;
// const APP_ID = "e407600d-a432-49d4-b62f-f99c0ddde8c7";
// const APP_SECRET = "aadc0a11-7e19-41dd-a949-8fcf8a6650ed";
// const APP_URL = "https://useful-natural-nail-bulk.trycloudflare.com";
// const REDIRECT_URL = `${APP_URL}/auth/callback`;

// // App-level client (verifies webhook signatures)
// const client = createClient({
//     auth: AppStrategy({
//         appId: APP_ID,
//         publicKey: PUBLIC_KEY,
//     }),
//     modules: { products, productsV3 },
// });

// client.products.onProductChanged((event) => {
//     console.log(`onProductChanged invoked with data:`, event);
//     console.log(`App instance ID:`, event.metadata.instanceId);
//     //
//     // handle your event here
//     //
// });

// // ====== In-memory state store for demo (replace with DB for production) ======
// const stateStore = {};

// // ======================
// // 2️⃣ ROOT ROUTE
// // ======================
// app.get("/", (req, res) => {
//     res.send("✅ Wix app server is running!");
// });

// // ======================
// // 3️⃣ INSTALL ROUTE (redirects user to Wix installer)
// // ======================
// app.get("/install", (req, res) => {
//     const state = crypto.randomBytes(16).toString("hex");
//     stateStore[state] = true;

//     const wixInstallUrl = `https://www.wix.com/installer/install?appId=${APP_ID}&redirectUrl=${encodeURIComponent(
//         REDIRECT_URL
//     )}&state=${state}`;

//     res.redirect(wixInstallUrl);
// });

// // ======================
// // 4️⃣ WEBHOOK HANDLER
// // ======================
// // app.post("/webhook", async (req, res) => {
// //     try {
// //         const event = await client.webhooks.process(req.body);

// //         if (!event) {
// //             console.warn("⚠️ No event received from webhook");
// //             return res.sendStatus(200);
// //         }

// //         const productId = event.data?.productId;
// //         const instanceId = event.metadata?.instanceId;

// //         console.log("\n✅ Webhook Event Type:", event.type);
// //         console.log("🆔 Product ID:", productId);
// //         console.log("🏷️ Instance ID:", instanceId);

// //         const tokens = await getTokensByInstanceId(instanceId);
// //         if (!tokens?.access_token) {
// //             console.warn("⚠️ No access token found for instance:", instanceId);
// //             return res.sendStatus(200);
// //         }

// //         const authorizedClient = createClient({
// //             auth: OAuthStrategy({
// //                 clientId: APP_ID,
// //                 tokens: { accessToken: tokens.access_token },
// //             }),
// //             modules: { products },
// //         });

// //         if (productId) {
// //             const product = await authorizedClient.products.getProduct(productId);
// //             console.log("📦 Full product details:", JSON.stringify(product, null, 2));
// //         }

// //         res.sendStatus(200);
// //     } catch (err) {
// //         console.error("❌ Webhook error:", err);
// //         res.status(500).send(`Webhook error: ${err instanceof Error ? err.message : err}`);
// //     }
// // });

// app.post("/webhook", express.text(), async (request, response) => {
//     try {
//         await client.webhooks.process(request.body);
//     } catch (err) {
//         console.error(err);
//         response
//             .status(500)
//             .send(`Webhook error: ${err instanceof Error ? err.message : err}`);
//         return;
//     }

//     response.status(200).send();
// });

// // ======================
// // 5️⃣ OAUTH CALLBACK
// // ======================
// app.get("/auth/callback", async (req, res) => {
//     const { code, instanceId, state } = req.query;

//     if (!state || !stateStore[state]) {
//         return res.status(400).send("❌ Invalid or missing state parameter");
//     }
//     delete stateStore[state];

//     if (!code) {
//         return res.status(400).send("❌ Missing code query parameter");
//     }

//     const response = await fetch(
//         "https://www.wix.com/_api/applications/v1/oauth/access-token",
//         {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//                 "Accept": "application/json"
//             },
//             body: JSON.stringify({
//                 grant_type: "authorization_code",
//                 client_id: APP_ID,
//                 client_secret: APP_SECRET,
//                 code,
//                 redirect_uri: REDIRECT_URL
//             })
//         }
//     );


//     const text = await response.text();
//     console.log("💡 Wix token response raw:", text);

//     return res.status(200).send(`<pre>${text}</pre>`);

//     // try {
//     //     const response = await fetch(
//     //         "https://www.wix.com/_api/applications/v1/oauth/access-token",
//     //         {
//     //             method: "POST",
//     //             headers: { "Content-Type": "application/json" },
//     //             body: JSON.stringify({
//     //                 grant_type: "authorization_code",
//     //                 client_id: APP_ID,
//     //                 client_secret: APP_SECRET,
//     //                 code,
//     //                 redirect_uri: REDIRECT_URL,
//     //             }),
//     //         }
//     //     );

//     //     const text = await response.text();
//     //     console.log("💡 Wix token response:", text);

//     //     let data;
//     //     try {
//     //         data = JSON.parse(text);
//     //     } catch {
//     //         return res.status(500).send("❌ Failed to parse Wix token response. See server logs.");
//     //     }

//     //     if (!data.access_token) {
//     //         return res.status(400).send("❌ Failed to get access token");
//     //     }

//     //     await saveTokens(instanceId, data);

//     //     const closeUrl = `https://www.wix.com/installer/close-window?access_token=${data.access_token}`;

//     //     res.send(`
//     //   <h2>✅ App Installed Successfully!</h2>
//     //   <p><b>Instance ID:</b> ${instanceId}</p>
//     //   <p><b>Access Token:</b> ${data.access_token}</p>
//     //   <p><b>Refresh Token:</b> ${data.refresh_token}</p>
//     //   <p><a href="${closeUrl}" target="_blank">Close Wix consent window</a></p>
//     //   <small>You can close this window now.</small>
//     // `);
//     // } catch (err) {
//     //     console.error("❌ OAuth token exchange failed:", err);
//     //     res.status(500).send("Internal Server Error");
//     // }
// });

// // ======================
// // 6️⃣ START SERVER
// // ======================
// app.listen(PORT, () => {
//     console.log(`🚀 Server started on ${APP_URL} (port ${PORT})`);
// });

import express from "express";
import { AppStrategy, createClient } from "@wix/sdk";
import { products } from "@wix/stores";
import crypto from "crypto";
const app = express();

const stateStore = {};

// server.ts
//
// Use this sample code to handle webhook events in your
// expressjs typescript server using the Wix SDK package.
// allowing for type checking and auto-completion.
//
// 1) Paste this code into a new file (server.ts)
//
// 2) Install dependencies
//   npm install @wix/sdk
//   npm install @wix/stores
//   npm install express
//
// 3) Run the server on http://localhost:3000
//   npx ts-node server.ts

// consider loading your public key from a file or an environment variable
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
const APP_URL = "https://wix-webhook.vercel.app";
const REDIRECT_URL = `${APP_URL}/auth/callback`;

const client = createClient({
    auth: AppStrategy({
        appId: APP_ID,
        publicKey: PUBLIC_KEY,
    }),
    modules: { products },
});

client.products.onProductChanged((event) => {
    console.log(`onProductChanged invoked with data:`, event);
    console.log(`App instance ID:`, event.metadata.instanceId);
    //
    // handle your event here
    //
});

app.post("/webhook", express.text(), async (request, response) => {
    try {
        await client.webhooks.process(request.body);
    } catch (err) {
        console.error(err);
        response
            .status(500)
            .send(`Webhook error: ${err instanceof Error ? err.message : err}`);
        return;
    }

    response.status(200).send();
});

app.get("/install", (req, res) => {
    // Step 1: Wix sends you here with a token
    const { token } = req.query;
    
    if (!token) {
        return res.status(400).send("❌ Missing token parameter from Wix");
    }

    // Generate state for CSRF protection
    const state = crypto.randomBytes(16).toString("hex");
    stateStore[state] = { timestamp: Date.now() };

    // Step 3: Redirect to Wix installer with the token Wix gave you
    const wixInstallUrl = `https://www.wix.com/installer/install?token=${token}&appId=${APP_ID}&redirectUrl=${encodeURIComponent(
        REDIRECT_URL
    )}&state=${state}`;

    res.redirect(wixInstallUrl);
});

app.get("/auth/callback", async (req, res) => {
    const { code, instanceId, state } = req.query;

    console.log("📥 Received callback with:", { 
        code: code?.substring(0, 20) + '...', 
        instanceId, 
        state 
    });

    // Step 4: Validate state parameter
    if (!state || !stateStore[state]) {
        return res.status(400).send("❌ Invalid or missing state parameter");
    }
    
    // Clean up state after validation
    delete stateStore[state];

    // Validate code and instanceId
    if (!code) {
        return res.status(400).send("❌ Missing code query parameter");
    }

    if (!instanceId) {
        return res.status(400).send("❌ Missing instanceId query parameter");
    }

    try {
        // Step 5: Exchange authorization code for access token
        // CORRECT ENDPOINT: https://www.wixapis.com/oauth2/token
        const tokenRequestBody = {
            grant_type: "authorization_code",
            client_id: APP_ID,
            client_secret: APP_SECRET,
            code: code
        };

        console.log("🔑 Requesting token from wixapis.com...");

        const response = await fetch(
            "https://www.wixapis.com/oauth2/token",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(tokenRequestBody)
            }
        );

        console.log("📡 Response status:", response.status);

        const text = await response.text();
        console.log("💡 Response body:", text);

        if (!response.ok) {
            console.error("❌ Token request failed");
            return res.status(response.status).send(`
                <pre>❌ Failed to exchange authorization code for token

Status: ${response.status}
Response: ${text}

Request Details:
- Endpoint: https://www.wixapis.com/oauth2/token
- Grant Type: authorization_code
- Client ID: ${APP_ID}
- Code (first 20 chars): ${code.substring(0, 20)}...
- Instance ID: ${instanceId}

Please verify:
1. Your APP_SECRET is correct in your .env file
2. The authorization code hasn't expired (valid for 10 minutes)
3. You haven't already used this authorization code
</pre>`);
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("❌ Failed to parse token response:", parseError);
            return res.status(500).send(`<pre>❌ Failed to parse Wix token response:\n${text}</pre>`);
        }

        // Check if token exchange was successful
        if (!data.access_token) {
            console.error("❌ No access token in response:", data);
            return res.status(400).send(`<pre>❌ Failed to get access token:\n${JSON.stringify(data, null, 2)}</pre>`);
        }

        console.log("✅ Successfully received access token");

        // Save tokens to your database
        await saveTokens(instanceId, {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in
        });

        // Step 6 (Optional): Close the consent window
        const closeUrl = `https://www.wix.com/installer/close-window?access_token=${data.access_token}`;

        // Step 7 (Optional): Send BI event to mark app as configured
        try {
            const biResponse = await fetch("https://www.wixapis.com/_api/app-management/v1/bi-event", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": data.access_token
                },
                body: JSON.stringify({
                    eventName: "APP_FINISHED_CONFIGURATION"
                })
            });
            console.log("📊 BI event response status:", biResponse.status);
        } catch (biError) {
            console.error("⚠️ Failed to send BI event:", biError);
        }

        // Return success page with close window option
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Installation Successful</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                    h2 { color: #28a745; }
                    .info { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                    .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <h2>✅ App Installed Successfully!</h2>
                <div class="info">
                    <p><b>Instance ID:</b> ${instanceId}</p>
                    <p><b>Access Token:</b> ${data.access_token.substring(0, 20)}...</p>
                    <p><b>Refresh Token:</b> ${data.refresh_token ? data.refresh_token.substring(0, 20) + '...' : 'N/A'}</p>
                </div>
                <p>Redirecting to close window...</p>
                <a href="${closeUrl}" class="button">Click here if not redirected</a>
                <script>
                    // Auto-redirect after 1 second
                    setTimeout(() => {
                        window.location.href = '${closeUrl}';
                    }, 1000);
                </script>
            </body>
            </html>
        `);

    } catch (err) {
        console.error("❌ OAuth token exchange failed:", err);
        res.status(500).send(`<pre>❌ Internal Server Error:\n${err.message}\n${err.stack}</pre>`);
    }
});

app.listen(3000, () => console.log("Server started on port 3000"))




