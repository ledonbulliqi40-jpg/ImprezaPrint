const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "10mb" }));

app.use(session({
secret: "ImprezaPrint-Admin-Secret-2026",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
secure: false,
maxAge: 1000 * 60 * 60 * 8
}
}));

app.use(express.static(path.join(__dirname, "..", "frontend")));

/* ADMIN LOGIN */

app.post("/api/admin/login", (req, res) => {

```
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
        console.error("Gabim gjatë login:", err);

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

    req.session.adminId = admin.id;
    req.session.adminUsername = admin.username;

    res.json({
        success: true,
        message: "Login u krye me sukses!"
    });

});
```

});

/* CHECK LOGIN */

app.get("/api/admin/check", (req, res) => {

```
if (!req.session.adminId) {
    return res.json({
        loggedIn: false
    });
}

res.json({
    loggedIn: true,
    username: req.session.adminUsername
});
```

});

/* ADMIN LOGOUT */

app.post("/api/admin/logout", (req, res) => {

```
req.session.destroy(() => {
    res.json({
        success: true,
        message: "U çkyçe me sukses."
    });
});
```

});

/* TEST */

app.get("/api/test", (req, res) => {

```
res.json({
    success: true,
    message: "Backend + MySQL po punojnë!"
});
```

});

/* ADMIN MIDDLEWARE */

function requireAdmin(req, res, next) {

```
if (!req.session.adminId) {
    return res.status(401).json({
        success: false,
        message: "Duhet të kyçesh si admin."
    });
}

next();
```

}

/* GET ORDERS */

app.get("/api/orders", requireAdmin, (req, res) => {

```
const sql = `
    SELECT *
    FROM orders
    ORDER BY created_at DESC
`;

db.query(sql, (err, results) => {

    if (err) {
        console.error(
            "Gabim gjatë marrjes së porosive:",
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
```

});

/* CREATE ORDER */

app.post("/api/orders", (req, res) => {

```
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
```

});

/* UPDATE ORDER STATUS */

app.put("/api/orders/:id/status", requireAdmin, (req, res) => {

```
const id = req.params.id;
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

db.query(sql, [status, id], (err, result) => {

    if (err) {
        console.error(
            "Gabim gjatë ndryshimit të statusit:",
            err
        );

        return res.status(500).json({
            success: false,
            message: "Statusi nuk u ndryshua."
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
        message: "Statusi u ndryshua me sukses."
    });

});
```

});

/* DELETE ORDER */

app.delete("/api/orders/:id", requireAdmin, (req, res) => {

```
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
```

});

/* START SERVER */

app.listen(PORT, () => {

```
console.log(
    `🚀 ImprezaPrint po punon në portin ${PORT}`
);

console.log(
    "🔐 Admin Login aktiv!"
);
```

});
