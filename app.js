import express from "express";
import { AppStrategy, createClient } from "@wix/sdk";
import { products } from "@wix/stores";
import fetch from "node-fetch";
const app = express();

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

const client = createClient({
    auth: AppStrategy({
        appId: APP_ID,
        publicKey: PUBLIC_KEY,
    }),
    modules: { products },
});

client.products.onProductChanged(async (event) => {
    try {
        console.log("onProductChanged invoked with data:", event);
        console.log("App instance ID:", event.metadata.instanceId);

        const tokenBody = {
            grant_type: "client_credentials",
            client_id: "e407600d-a432-49d4-b62f-f99c0ddde8c7",
            client_secret: "aadc0a11-7e19-41dd-a949-8fcf8a6650ed",
            instance_id: event.metadata.instanceId
        };

        const tokenResponse = await fetch("https://www.wixapis.com/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(tokenBody)
        });

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        if (!accessToken) {
            throw new Error("Failed to get access token");
        }

        // Fetch product details
        const productResponse = await fetch(
            `https://www.wixapis.com/stores-reader/v1/products/${event.data.productId}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const productData = await productResponse.json();
        console.log("Full product object:", JSON.stringify(productData, null, 2));
    } catch (error) {
        console.error("Error handling product change:", error);
    }
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

app.listen(3000, () => console.log("Server started on port 3000"))