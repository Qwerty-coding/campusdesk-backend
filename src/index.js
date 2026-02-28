require("dotenv").config();
const express = require("express");
const cors = require("cors");
const requestsRouter = require("./routes/requests");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "CampusDesk API is running" });
});

app.use("/api/requests", requestsRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
