const express = require("express");
const path = require("path");
const cors = require("cors");
const db = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;

const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

// Shton kolonat e transportit pa fshirë ose ndryshuar porositë ekzistuese.
async function ensureOrderShippingColumns() {
    const [columns] = await db.query(
        `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
         AND COLUMN_NAME IN ('phoneModel', 'country', 'shipping', 'image', 'total', 'paymentStatus')`
    );
    const existing = new Set(columns.map(column => column.COLUMN_NAME));
    if (!existing.has("phoneModel")) {
        await db.query("ALTER TABLE orders ADD COLUMN phoneModel VARCHAR(120) NULL");
    }
    if (!existing.has("country")) {
        await db.query("ALTER TABLE orders ADD COLUMN country VARCHAR(80) NULL");
    }
    if (!existing.has("shipping")) {
        await db.query("ALTER TABLE orders ADD COLUMN shipping DECIMAL(10,2) NOT NULL DEFAULT 0.00");
    }
    if (!existing.has("total")) {
        await db.query("ALTER TABLE orders ADD COLUMN total DECIMAL(10,2) NOT NULL DEFAULT 0.00");
    }
    if (!existing.has("paymentStatus")) {
        await db.query("ALTER TABLE orders ADD COLUMN paymentStatus VARCHAR(30) NOT NULL DEFAULT 'pending'");
    }

    // Fotot e ngarkuara mund të kalojnë kufirin e TEXT.
    const imageColumn = columns.find(
        column => String(column.COLUMN_NAME).toLowerCase() === "image"
    );
    if (imageColumn && String(imageColumn.DATA_TYPE).toLowerCase() !== "longtext") {
        await db.query("ALTER TABLE orders MODIFY COLUMN image LONGTEXT NULL");
    }
}

/* =========================
   CORS
========================= */

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

/* =========================
   LOGGER
========================= */

app.use((req, res, next) => {
    console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
    );

    next();
});

/* =========================
   JSON
========================= */

app.use(express.json({ limit: "20mb" }));

/* =========================
   TEST
========================= */

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "ImprezaPrint backend po punon!"
    });
});

/* =========================
   ADMIN LOGIN
========================= */

app.post("/api/admin/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    const ADMIN_USERNAME = "admin";
    const ADMIN_PASSWORD = "ImprezaPrint2026!";

    if (
        username !== ADMIN_USERNAME ||
        password !== ADMIN_PASSWORD
    ) {
        return res.status(401).json({
            success: false,
            message: "Username ose password gabim."
        });
    }

    res.json({
        success: true,
        message: "Login u krye me sukses!",
        user: {
            username: ADMIN_USERNAME,
            role: "admin"
        }
    });
});

/* =========================
   GET ORDERS
========================= */

app.get("/api/orders", async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT *
            FROM orders
            ORDER BY created_at DESC
        `);

        res.json({
            success: true,
            orders: results
        });
    } catch (error) {
        console.error(
            "❌ Gabim gjatë marrjes së porosive:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Gabim me databazën."
        });
    }
});

/* =========================
   CREATE ORDER
========================= */

app.post("/api/orders", async (req, res) => {
    try {
        const {
            product,
            phoneModel,
            country,
            shipping,
            quantity,
            price,
            total,
            paymentMethod,
            text,
            image,
            name,
            phone,
            address,
            city
        } = req.body;

        console.log("🛒 Porosi e re:");
        console.log("Product:", product);
        console.log("Model:", phoneModel);
        console.log("Quantity:", quantity);
        console.log("Price:", price);
        console.log("Total:", total);
        console.log("Customer:", name);
        console.log("Phone:", phone);
        console.log("Address:", address);
        console.log("City:", city);
        console.log("Payment:", paymentMethod);
        console.log(
            "Photo:",
            image
                ? `${String(image).length} chars`
                : "No photo"
        );

        if (
            !product ||
            !quantity ||
            price === undefined ||
            price === null ||
            !name ||
            !phone ||
            !address ||
            !city
        ) {
            return res.status(400).json({
                success: false,
                message: "Mungojnë disa të dhëna."
            });
        }

        const calculatedTotal =
            total !== undefined &&
            total !== null &&
            total !== ""
                ? Number(total)
                : Number(price) * Number(quantity);

        await ensureOrderShippingColumns();

        // Përdor emrat realë të kolonave të databazës, sepse skemat e vjetra mund të kenë emra të ndryshëm.
        const [schemaColumns] = await db.query(
            `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'`
        );
        const actualColumns = new Map(
            schemaColumns.map(column => [String(column.COLUMN_NAME).toLowerCase(), String(column.COLUMN_NAME)])
        );

        const fields = [
            [["product"], product],
            [["phonemodel", "phone_model", "model"], phoneModel || ""],
            [["country"], country || "Kosovë"],
            [["shipping", "shippingcost", "shipping_cost"], Number(shipping) || 2],
            [["quantity", "qty"], Number(quantity)],
            [["price", "unitprice", "unit_price"], Number(price)],
            [["total", "ordertotal", "order_total"], calculatedTotal],
            [["paymentmethod", "payment_method", "payment"], paymentMethod || "card_pending"],
            [["text", "customtext", "custom_text", "personalizedtext"], text || ""],
            [["image", "photo", "productimage", "product_image"], image || ""],
            [["name", "customername", "customer_name"], name],
            [["phone", "customerphone", "customer_phone"], phone],
            [["address", "customeraddress", "customer_address"], address],
            [["city", "customercity", "customer_city"], city]
        ];

        const insertFields = fields
            .map(([aliases, value]) => {
                const actualName = aliases.map(alias => actualColumns.get(alias)).find(Boolean);
                return actualName ? { name: actualName, value } : null;
            })
            .filter(Boolean);

        const requiredAliases = [
            ["product"], ["quantity", "qty"], ["price", "unitprice", "unit_price"],
            ["total", "ordertotal", "order_total"], ["name", "customername", "customer_name"],
            ["phone", "customerphone", "customer_phone"], ["address", "customeraddress", "customer_address"],
            ["city", "customercity", "customer_city"]
        ];
        const missingRequired = requiredAliases
            .filter(aliases => !aliases.some(alias => actualColumns.has(alias)))
            .map(aliases => aliases[0]);

        if (missingRequired.length) {
            console.error("Orders table is missing required columns:", missingRequired.join(", "));
            return res.status(500).json({
                success: false,
                message: "Databaza e porosive ka kolona që mungojnë: " + missingRequired.join(", ")
            });
        }

        const sql = `INSERT INTO orders (${insertFields.map(field => "`" + field.name.replace(/`/g, "``") + "`").join(", ")})
                     VALUES (${insertFields.map(() => "?").join(", ")})`;
        const values = insertFields.map(field => field.value);

        const [result] = await db.query(sql, values);

        console.log(
            "✅ Porosia u ruajt. Order ID:",
            result.insertId
        );

        res.status(201).json({
            success: true,
            message: "Porosia u ruajt me sukses!",
            orderId: result.insertId
        });

    } catch (error) {
        console.error(
            "❌ Gabim gjatë ruajtjes së porosisë:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Porosia nuk u ruajt. Kodi i gabimit: " + (error.code || "SERVER_ERROR")
        });
    }
});

app.post("/api/paysera/create-payment", async (req, res) => {
    try {
        const projectId = String(process.env.PAYSERA_PROJECT_ID || "").trim();
        const password = String(process.env.PAYSERA_PROJECT_PASSWORD || "");
        if (!projectId || !password) {
            return res.status(503).json({ success: false, message: "Paysera nuk është konfiguruar ende në Railway." });
        }
        const orderId = Number(req.body && req.body.orderId);
        if (!Number.isSafeInteger(orderId) || orderId <= 0) {
            return res.status(400).json({ success: false, message: "Numri i porosisë është i pavlefshëm." });
        }
        const [rows] = await db.query("SELECT * FROM orders WHERE id = ? LIMIT 1", [orderId]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Porosia nuk u gjet." });
        const order = rows[0];
        const totalKey = Object.keys(order).find(k => ["total", "ordertotal", "order_total"].includes(k.toLowerCase()));
        const amount = Math.round(Number(totalKey ? order[totalKey] : 0) * 100);
        if (!Number.isSafeInteger(amount) || amount < 1) {
            return res.status(400).json({ success: false, message: "Totali i porosisë është i pavlefshëm." });
        }
        const baseUrl = String(process.env.PUBLIC_BASE_URL || "https://imprezaprint-production.up.railway.app").replace(/\/$/, "");
        const data = new URLSearchParams({
            projectid: projectId,
            orderid: String(orderId),
            amount: String(amount),
            currency: "EUR",
            accepturl: baseUrl + "/paysera/return?result=success",
            cancelurl: baseUrl + "/paysera/return?result=cancel",
            callbackurl: baseUrl + "/api/paysera/callback",
            version: "1.8",
            test: process.env.PAYSERA_TEST_MODE === "true" ? "1" : "0"
        }).toString();
        const encoded = Buffer.from(data, "utf8").toString("base64").replace(/\//g, "_").replace(/\+/g, "-");
        const sign = require("crypto").createHash("md5").update(encoded + password, "utf8").digest("hex");
        const paymentUrl = "https://www.paysera.com/pay/?" + new URLSearchParams({ data: encoded, sign }).toString();
        return res.json({ success: true, paymentUrl });
    } catch (error) {
        console.error("Paysera payment creation error:", error);
        return res.status(500).json({ success: false, message: "Nuk u krijua lidhja e pagesës Paysera." });
    }
});

app.get("/paysera/return", (req, res) => {
    const success = req.query.result === "success";
    res.status(200).type("html").send("<!doctype html><html lang='sq'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>ImprezaPrint</title><body style='font-family:Arial,sans-serif;max-width:620px;margin:60px auto;padding:24px'><h1>" + (success ? "Faleminderit për porosinë!" : "Pagesa u anulua") + "</h1><p>" + (success ? "Kontrolli i pagesës do të përditësohet nga Paysera." : "Pagesa u anulua. Mund të kthehesh në dyqan.") + "</p><a href='/'>Kthehu te ImprezaPrint</a></body></html>");
});

/* =========================
   UPDATE ORDER STATUS
========================= */

app.put("/api/orders/:id/status", async (req, res) => {
    try {
        const id = req.params.id;
        const status = String(
            req.body?.status || ""
        ).trim();

        const allowedStatuses = [
            "E re",
            "Në përpunim",
            "Përfunduar",
            "Anuluar"
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status i pavlefshëm."
            });
        }

        const [result] = await db.query(
            "UPDATE orders SET status = ? WHERE id = ?",
            [status, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Porosia nuk u gjet."
            });
        }

        res.json({
            success: true,
            message: "Statusi u ndryshua me sukses!"
        });

    } catch (error) {
        console.error(
            "❌ Gabim gjatë ndryshimit të statusit:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Statusi nuk u ndryshua."
        });
    }
});

/* =========================
   DELETE ORDER
========================= */

app.delete("/api/orders/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const [result] = await db.query(
            "DELETE FROM orders WHERE id = ?",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Porosia nuk u gjet."
            });
        }

        res.json({
            success: true,
            message: "Porosia u fshi."
        });

    } catch (error) {
        console.error(
            "❌ Gabim gjatë fshirjes:",
            error
        );

        res.status(500).json({
            success: false,
            message: "Porosia nuk u fshi."
        });
    }
});

/* =========================
   FRONTEND
========================= */

app.use(express.static(FRONTEND_PATH));

app.get("/", (req, res) => {
    res.sendFile(
        path.join(FRONTEND_PATH, "index.html")
    );
});

/* =========================
   API 404
========================= */

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "API route nuk ekziston."
    });
});

/* =========================
   GLOBAL ERROR
========================= */

app.use((err, req, res, next) => {
    console.error("❌ Gabim global:", err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        success: false,
        message: "Gabim i brendshëm në server."
    });
});

/* =========================
   START SERVER
========================= */

const server = app.listen(PORT, () => {
    console.log("");
    console.log("================================");
    console.log(
        `🚀 ImprezaPrint po punon në portin ${PORT}`
    );
    console.log("🔐 Admin Login aktiv!");
    console.log("🛒 Orders API aktiv!");
    console.log("🌐 CORS aktiv!");
    console.log("================================");
});

server.on("error", (error) => {
    console.error("❌ Server error:", error);
});

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
});
