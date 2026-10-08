const express = require("express");
const path = require("path");
const cors = require("cors");
const db = require("./db");

const app = express();

const PORT = process.env.PORT || 3000;

const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

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
   REQUEST LOGGER
========================= */

app.use((req, res, next) => {
    console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
    );

    next();
});

/* =========================
   TIMEOUT
========================= */

app.use((req, res, next) => {
    res.setTimeout(30000, () => {
        console.error("⏱️ Request timeout:", req.method, req.originalUrl);

        if (!res.headersSent) {
            res.status(408).json({
                success: false,
                message: "Kërkesa mori shumë kohë."
            });
        }
    });

    next();
});

/* =========================
   JSON
========================= */

app.use(express.json({ limit: "15mb" }));

/* =========================
   TEST API
========================= */

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Backend + MySQL po punojnë!"
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

    return res.json({
        success: true,
        message: "Login u krye me sukses!",
        user: {
            username: ADMIN_USERNAME,
            role: "admin"
        }
    });
});

/* =========================
   GET ALL ORDERS
========================= */

app.get("/api/orders", (req, res) => {
    const sql = `
        SELECT *
        FROM orders
        ORDER BY created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error(
                "❌ Gabim gjatë marrjes së porosive:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Gabim me databazën."
            });
        }

        res.json({
            success: true,
            orders: results
        });
    });
});

/* =========================
   CREATE ORDER
========================= */

app.post("/api/orders", (req, res) => {
    const {
        product,
        phoneModel,
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
        image ? `${String(image).length} chars` : "No photo"
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

    const sql = `
        INSERT INTO orders
        (
            product,
            phoneModel,
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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const calculatedTotal =
        total !== undefined &&
        total !== null &&
        total !== ""
            ? Number(total)
            : Number(price) * Number(quantity);

    const values = [
        product,
        phoneModel || "",
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

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error(
                "❌ Gabim gjatë ruajtjes së porosisë:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Porosia nuk u ruajt."
            });
        }

        console.log(
            "✅ Porosia u ruajt. Order ID:",
            result.insertId
        );

        res.status(201).json({
            success: true,
            message: "Porosia u ruajt me sukses!",
            orderId: result.insertId
        });
    });
});

/* =========================
   UPDATE ORDER STATUS
========================= */

app.put("/api/orders/:id/status", (req, res) => {
    const id = req.params.id;
    const status = String(req.body?.status || "").trim();

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

    db.query(
        "UPDATE orders SET status = ? WHERE id = ?",
        [status, id],
        (err, result) => {
            if (err) {
                console.error(
                    "❌ Gabim gjatë ndryshimit të statusit:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Statusi nuk u ndryshua."
                });
            }

            res.json({
                success: true,
                message: "Statusi u ndryshua me sukses!"
            });
        }
    );
});

/* =========================
   DELETE ORDER
========================= */

app.delete("/api/orders/:id", (req, res) => {
    const id = req.params.id;

    db.query(
        "DELETE FROM orders WHERE id = ?",
        [id],
        (err, result) => {
            if (err) {
                console.error(
                    "❌ Gabim gjatë fshirjes:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Porosia nuk u fshi."
                });
            }

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
        }
    );
});

/* =========================
   STATIC FRONTEND
========================= */

app.use(express.static(FRONTEND_PATH));

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
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
   GLOBAL ERROR HANDLER
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

/* =========================
   SERVER ERRORS
========================= */

server.on("error", (error) => {
    console.error("❌ Server error:", error);
});

server.on("listening", () => {
    const address = server.address();

    if (address && typeof address === "object") {
        console.log(
            `🌐 Server listening on port ${address.port}`
        );
    }
});

/* =========================
   UNCAUGHT ERRORS
========================= */

process.on("uncaughtException", (error) => {
    console.error("❌ Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason) => {
    console.error("❌ Unhandled Rejection:", reason);
});
