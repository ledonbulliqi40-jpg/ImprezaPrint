```javascript
const mysql = require("mysql2/promise");

const db = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
});

async function testDatabase() {
    try {
        await db.query("SELECT 1");
        console.log("MySQL u lidh me sukses!");
    } catch (error) {
        console.error("Gabim me MySQL:", error.message);
    }
}

testDatabase();

module.exports = db;
```
