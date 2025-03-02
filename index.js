const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
//const path = require("path");
//const cors = require("cors");

//const corsOption = {
//  origin: ["http://localhost:5173", "https://webis.vercel.app/"],
//};
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(cors(corsOption));

// MySQL Connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10, // Number of connections in the pool
  queueLimit: 0,
});

// Handle MySQL Disconnections
pool.on("error", (err) => {
  console.error("MySQL Pool Error: ", err);
  if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
    console.error("Reconnecting to MySQL...");
    pool.getConnection((error, connection) => {
      if (error) {
        console.error("Failed to reconnect:", error);
      } else {
        console.log("Reconnected to MySQL.");
        connection.release();
      }
    });
  }
});

setInterval(() => {
  pool.query("SELECT 1", (err) => {
    if (err) {
      console.error("Keep-alive query failed:", err);
    } else {
      console.log("Keep-alive query executed.");
    }
  });
}, 5 * 60 * 1000); // Runs every 5 minutes

const queryDatabase = (database, query, params, res, retryCount = 0) => {
  database.query(query, params, (err, result) => {
    if (err) {
      console.error("Database error: failed to query database");

      if (err.code === "ECONNRESET" && retryCount < 5) {
        console.warn(`Retrying query... (${retryCount + 1}/5)`);
        return setInterval(
          () => queryDatabase(database, query, params, res, retryCount + 1),
          1000
        );
      }
      res
        .status(500)
        .json({ error: "Database error after nultiple retry attemps" });
    }

    res.json(result);
  });
};

app.get("/", (req, res) => {
  res.send("This is the webis server api");
})

app.get("/api/members", (req, res) => {
  let query = "SELECT * FROM members";
  let division = req.query.division;
  let params = [];

  console.log("api called: GET member data");

  if (division) {
    query += " WHERE division = ?";
    params.push(division);
  }

  queryDatabase(pool, query, params, res);
});

app.get("/api/divisions", (req, res) => {
  const query = "SELECT * FROM division";
  queryDatabase(pool, query, [], res);
});

process.on("SIGINT", (err) => {
  pool.end();
  if (err) console.error("Error when closing pool", err);
  else console.log("pool is closed");

  process.exit(0);
});

module.exports = app;
