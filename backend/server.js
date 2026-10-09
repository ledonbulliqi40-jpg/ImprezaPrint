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
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders'
         AND COLUMN_NAME IN ('country', 'shipping')`
    );
    const existing = new Set(columns.map(column => column.COLUMN_NAME));
    if (!existing.has("country")) {
        await db.query("ALTER TABLE orders ADD COLUMN country VARCHAR(80) NULL");
    }
    if (!existing.has("shipping")) {
        await db.query("ALTER TABLE orders ADD COLUMN shipping DECIMAL(10,2) NOT NULL DEFAULT 0.00");
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

app.use(express.json({ limit: "15mb" }));

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

        const sql = `
            INSERT INTO orders
            (
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
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            product,
            phoneModel || "",
            country || "Kosovë",
            Number(shipping) || 2,
            Number(quantity),
            Number(price),
            calculatedTotal,
            paymentMethod || "cash_on_delivery",
            text || "",
            image || "",
            name,
            phone,
            address,
            city
        ];

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
            message: "Porosia nuk u ruajt."
        });
    }
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
