const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

app.use(
    session({
        secret: process.env.SESSION_SECRET || "ImprezaPrint-Admin-Secret-2026",
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 8 * 60 * 60 * 1000
        }
    })
);

// Frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// =========================
// ADMIN LOGIN
// =========================

app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            success: false,
            message: "Plotëso username dhe password."
        });
    }

    const sql = `
        SELECT *
        FROM admins
        WHERE username = ?
        LIMIT 1
    `;

    db.query(sql, [username], async (err, results) => {
        if (err) {
            console.error("Gabim login:", err);
            return res.status(500).json({
                success: false,
                message: "Gabim me databazën."
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Username ose password gabim."
            });
        }

        const admin = results[0];

        const passwordCorrect = await bcrypt.compare(
            password,
            admin.password
        );

        if (!passwordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Username ose password gabim."
            });
        }

        req.session.admin = {
            id: admin.id,
            username: admin.username
        };

        res.json({
            success: true,
            message: "Login me sukses!"
        });
    });
});

// Kontrollo login
app.get("/api/admin/check", (req, res) => {
    if (!req.session.admin) {
        return res.status(401).json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        admin: req.session.admin
    });
});

// Logout
app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false
            });
        }

        res.json({
            success: true
        });
    });
});

// =========================
// ADMIN PROTECTION
// =========================

function requireAdmin(req, res, next) {
    if (!req.session.admin) {
        return res.status(401).json({
            success: false,
            message: "Nuk je i kyçur si admin."
        });
    }

    next();
}

// =========================
// TEST
// =========================

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "ImprezaPrint backend po punon!"
    });
});

// =========================
// GET ORDERS
// =========================

app.get("/api/orders", requireAdmin, (req, res) => {
    const sql = `
        SELECT *
        FROM orders
        ORDER BY created_at DESC
    `;

    db.query(sql, (err, results) => {
        if (err) {
            console.error("Gabim orders:", err);
            return res.status(500).json({
                success: false,
                message: "Gabim me databazën."
            });
        }

        res.json(results);
    });
});

// =========================
// CREATE ORDER
// =========================

app.post("/api/orders", (req, res) => {
    const {
        product,
        quantity,
        price,
        text,
        image,
        name,
        phone,
        address,
        city
    } = req.body;

    if (
        !product ||
        !quantity ||
        price === undefined ||
        !name ||
        !phone ||
        !address ||
        !city
    ) {
        return res.status(400).json({
            success: false,
            message: "Plotëso të gjitha fushat e nevojshme."
        });
    }

    const sql = `
        INSERT INTO orders
        (
            product,
            quantity,
            price,
            text,
            image,
            name,
            phone,
            address,
            city
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
        sql,
        [
            product,
            quantity,
            price,
            text || "",
            image || "",
            name,
            phone,
            address,
            city
        ],
        (err, result) => {
            if (err) {
                console.error("Gabim krijimi i porosisë:", err);

                return res.status(500).json({
                    success: false,
                    message: "Porosia nuk u ruajt."
                });
            }

            res.json({
                success: true,
                message: "Porosia u ruajt me sukses!",
                orderId: result.insertId
            });
        }
    );
});

// =========================
// UPDATE ORDER STATUS
// =========================

app.put("/api/orders/:id/status", requireAdmin, (req, res) => {
    const orderId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = [
        "E re",
        "Në përpunim",
        "Gati",
        "Dërguar",
        "Përfunduar"
    ];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            success: false,
            message: "Status i pavlefshëm."
        });
    }

    const sql = `
        UPDATE orders
        SET status = ?
        WHERE id = ?
    `;

    db.query(sql, [status, orderId], (err, result) => {
        if (err) {
            console.error("Gabim statusi:", err);

            return res.status(500).json({
                success: false,
                message: "Statusi nuk u ndryshua."
            });
        }

        res.json({
            success: true,
            message: "Statusi u ndryshua."
        });
    });
});

// =========================
// DELETE ORDER
// =========================

app.delete("/api/orders/:id", requireAdmin, (req, res) => {
    const orderId = req.params.id;

    const sql = `
        DELETE FROM orders
        WHERE id = ?
    `;

    db.query(sql, [orderId], (err, result) => {
        if (err) {
            console.error("Gabim fshirjeje:", err);

            return res.status(500).json({
                success: false,
                message: "Porosia nuk u fshi."
            });
        }

        res.json({
            success: true,
            message: "Porosia u fshi."
        });
    });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
    console.log(`🚀 ImprezaPrint po punon në portin ${PORT}`);
    console.log("🔐 Admin Login aktiv!");
});