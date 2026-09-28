import express from "express";
import { createAccount, getAccount, setFrozen } from "./services/accountService.js";
import { transfer } from "./services/transferService.js";
import { generateStatement } from "./services/statementService.js";

const app = express();
app.use(express.json());

app.post("/accounts", (req, res) => {
  const { ownerId, type } = req.body;
  if (!ownerId || !["standard", "premium", "savings"].includes(type)) {
    return res.status(400).json({ error: "ownerId and a valid type are required" });
  }
  res.status(201).json(createAccount(ownerId, type));
});

app.get("/accounts/:id", (req, res) => {
  const account = getAccount(req.params.id);
  if (!account) return res.status(404).json({ error: "Not found" });
  res.json(account);
});

app.post("/accounts/:id/freeze", (req, res) => {
  const account = setFrozen(req.params.id, true);
  if (!account) return res.status(404).json({ error: "Not found" });
  res.json(account);
});

app.post("/transfers", (req, res) => {
  const { fromAccountId, toAccountId, amount, description } = req.body;
  const result = transfer(fromAccountId, toAccountId, amount, description ?? "");
  if (!result.ok) return res.status(400).json({ error: result.error });
  res.status(201).json({ ok: true });
});

app.get("/accounts/:id/statement", (req, res) => {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const statement = generateStatement(req.params.id, periodStart, now);
  if (!statement) return res.status(404).json({ error: "Not found" });
  res.json(statement);
});

const PORT = 3001;
app.listen(PORT, () => console.log(`CoreBank listening on ${PORT}`));
