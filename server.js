const express = require("express");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = 3000;

// Lejon JSON nga website-i
app.use(express.json({ limit: "10mb" }));

// Shërben frontend-in
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Test
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Backend + MySQL po punojnë!"
    });
});

// Merr të gjitha porositë
app.get("/api/orders", (req, res) => {

    const sql = `
        SELECT *
        FROM orders
        ORDER BY created_at DESC
    `;

    db.query(sql, (err, results) => {

        if (err) {
            console.error("Gabim gjatë marrjes së porosive:", err);
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


// Shto porosi të re
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
        !price ||
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


    const values = [
        product,
        quantity,
        price,
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
                "Gabim gjatë ruajtjes së porosisë:",
                err
            );

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

    });

});


// Fshi porosi
app.delete("/api/orders/:id", (req, res) => {

    const id = req.params.id;


    db.query(
        "DELETE FROM orders WHERE id = ?",
        [id],
        (err, result) => {

            if (err) {

                console.error(
                    "Gabim gjatë fshirjes:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Porosia nuk u fshi."
                });

            }


            res.json({
                success: true,
                message: "Porosia u fshi."
            });

        }
    );

});


// Start server
app.listen(PORT, () => {

    console.log(
        `🚀 ImprezaPrint po punon në http://localhost:${PORT}`
    );

});