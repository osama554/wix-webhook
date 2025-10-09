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

client.products.onProductChanged((event) => {
    console.log(`onProductChanged invoked with data:`, event);
    console.log(`App instance ID:`, event.metadata.instanceId);
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");

    const raw = JSON.stringify({
        "grant_type": "client_credentials",
        "client_id": "e407600d-a432-49d4-b62f-f99c0ddde8c7",
        "client_secret": "aadc0a11-7e19-41dd-a949-8fcf8a6650ed",
        "instance_id": event.metadata.instanceId
    });

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: raw,
        redirect: "follow"
    };

    fetch("https://www.wixapis.com/oauth2/token", requestOptions)
        .then((response) => response.text())
        .then((result) => {
            const myHeaders = new Headers();
            myHeaders.append("Authorization", `Bearer ${result.access_token}`);

            const requestOptions = {
                method: "POST",
                headers: myHeaders,
                redirect: "follow"
            };

            fetch(`https://www.wixapis.com/stores-reader/v1/products/${event.data.productId}`, requestOptions)
                .then((response) => response.text())
                .then((result) => console.log(result))
                .catch((error) => console.error(error));
        })
        .catch((error) => console.error(error));
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
